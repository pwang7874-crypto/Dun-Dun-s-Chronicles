import type { AiArtService, AiEntitlement, InviteRedeemResult, RemoteAiGeneration } from '../../domain/ports';
import type { ImportedPhoto } from '../../domain/models';

interface CreateGenerationResponse {
  jobId: string;
  status?: RemoteAiGeneration['status'];
  errorCode?: string;
  errorMessage?: string;
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

const cleanBaseUrl = (value: string) => value.trim().replace(/\/+$/, '');

export class AiArtError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'AiArtError';
  }
}

const REDEEM_RESULT_KEYS = ['creditsGranted', 'inviteCreditsRemaining'] as const;

export class HttpAiArtService implements AiArtService {
  readonly isConfigured: boolean;
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly getAccessToken: () => Promise<string | null> = async () => null,
  ) {
    this.baseUrl = cleanBaseUrl(baseUrl);
    try {
      const url = new URL(this.baseUrl);
      this.isConfigured = url.protocol === 'https:' && !url.username && !url.password &&
        !url.search && !url.hash && url.pathname === '/';
    } catch {
      this.isConfigured = false;
    }
  }

  async createGeneration(input: {
    jobId: string;
    recordId: string;
    styleId: string;
    imageUri: string;
    contentType?: 'image/jpeg' | 'image/png';
  }): Promise<RemoteAiGeneration> {
    const token = await this.requireToken();
    const body = new FormData();
    body.append('idempotency_key', input.jobId);
    body.append('record_id', input.recordId);
    body.append('style_id', input.styleId);
    body.append('image', {
      uri: input.imageUri,
      name: `${input.recordId}.jpg`,
      type: input.contentType ?? 'image/jpeg',
    } as unknown as Blob);
    const payload = await this.requestJson<Partial<CreateGenerationResponse>>(
      '/api/v1/ai/generations',
      {
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        body,
      },
      180000,
    );
    return this.parseGeneration(payload);
  }

  async getGeneration(remoteJobId: string): Promise<RemoteAiGeneration> {
    this.validateJobId(remoteJobId);
    const token = await this.requireToken();
    return this.parseGeneration(await this.requestJson<Partial<CreateGenerationResponse>>(
      `/api/v1/ai/generations/${encodeURIComponent(remoteJobId)}`,
      { method: 'GET', headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } },
    ));
  }

  async downloadGeneration(remoteJobId: string): Promise<ImportedPhoto> {
    this.validateJobId(remoteJobId);
    const token = await this.requireToken();
    const { downloadAiImage } = await import('../media/NativeAiImageDownload');
    // Never forward the user's bearer token to an arbitrary outputUrl returned by a provider.
    return downloadAiImage(`${this.baseUrl}/api/v1/ai/generations/${encodeURIComponent(remoteJobId)}/image`, token);
  }

  async releaseDownload(uri: string): Promise<void> {
    const { releaseAiImageDownload } = await import('../media/NativeAiImageDownload');
    await releaseAiImageDownload(uri);
  }

  private validateJobId(value: unknown): asserts value is string {
    if (typeof value !== 'string' || !/^[A-Za-z0-9-]{1,80}$/.test(value)) {
      throw new AiArtError('AI_SERVICE_INVALID_RESPONSE', '服务暂时没有正确回应，请稍后再试。');
    }
  }

  private parseGeneration(payload: Partial<CreateGenerationResponse>): RemoteAiGeneration {
    this.validateJobId(payload?.jobId);
    const status = payload.status ?? 'processing';
    if (!['queued', 'processing', 'completed', 'failed'].includes(status)) {
      throw new AiArtError('AI_SERVICE_INVALID_RESPONSE', '服务暂时没有正确回应，请稍后再试。');
    }
    return { remoteJobId: payload.jobId, status,
      ...(payload.errorCode && /^[A-Z0-9_]{1,80}$/.test(payload.errorCode) ? { errorCode: payload.errorCode } : {}),
      ...(payload.errorMessage && payload.errorMessage.length <= 300 ? { errorMessage: payload.errorMessage } : {}),
    };
  }

  async getEntitlement(): Promise<AiEntitlement> {
    const token = await this.requireToken();
    const payload = await this.requestJson<Record<string, unknown>>(
      '/api/v1/me/entitlements',
      {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      },
    );
    return this.parseEntitlement(payload);
  }

  async redeemInvite(code: string): Promise<InviteRedeemResult> {
    const normalized = code.trim();
    if (!normalized) {
      throw new AiArtError('INVITE_CODE_EMPTY', '请先输入邀请码。');
    }
    const token = await this.requireToken();
    const payload = await this.requestJson<Record<string, unknown>>(
      '/api/v1/invite/redeem',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: normalized }),
      },
    );
    if (typeof payload.creditsGranted !== 'number' || typeof payload.inviteCreditsRemaining !== 'number') {
      throw new AiArtError('AI_SERVICE_INVALID_RESPONSE', '服务暂时没有正确回应，请稍后再试。');
    }
    return { creditsGranted: payload.creditsGranted, inviteCreditsRemaining: payload.inviteCreditsRemaining };
  }

  private async requireToken(): Promise<string> {
    if (!this.isConfigured) {
      throw new AiArtError('AI_SERVICE_NOT_CONFIGURED', 'AI 服务端还没有配置。');
    }
    const token = await this.getAccessToken();
    if (!token) {
      throw new AiArtError('AI_AUTH_REQUIRED', '请先登录，再开始 AI 创作。');
    }
    return token;
  }

  private async requestJson<T>(path: string, init: RequestInit, timeoutMs = 30000): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, { ...init, signal: controller.signal });
      let payload: unknown = null;
      try { payload = await response.json(); } catch { /* Validate below, including malformed gateway responses. */ }
      if (controller.signal.aborted) throw new AiArtError('AI_TIMEOUT', '还没有收到结果，可以稍后继续查看这次创作。');
      if (!response.ok) {
        const error = (payload as ErrorBody | null)?.error;
        const code = error?.code && /^[A-Z0-9_]{1,80}$/.test(error.code) ? error.code : `AI_SERVICE_HTTP_${response.status}`;
        throw new AiArtError(code, error?.message && error.message.length <= 300 ? error.message : '这一步暂时没完成，请稍后再试。');
      }
      return payload as T;
    } catch (error) {
      if (error instanceof AiArtError) throw error;
      throw new AiArtError(controller.signal.aborted ? 'AI_TIMEOUT' : 'AI_NETWORK_UNAVAILABLE',
        '暂时没有收到回应，可以稍后继续查看这次创作。');
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseEntitlement(payload: Record<string, unknown>): AiEntitlement {
    const tier = payload.membershipTier === 'member' ? 'member' : 'free';
    const kind = payload.entitlementKind === 'invite' || payload.entitlementKind === 'daily'
      ? payload.entitlementKind
      : 'none';
    return {
      membershipTier: tier,
      aiRemainingToday: typeof payload.aiRemainingToday === 'number' ? payload.aiRemainingToday : 0,
      entitlementKind: kind,
      inviteCreditsRemaining: typeof payload.inviteCreditsRemaining === 'number'
        ? payload.inviteCreditsRemaining
        : 0,
    };
  }
}

export const isRedeemResult = (value: unknown): value is InviteRedeemResult =>
  typeof value === 'object' && value !== null &&
  REDEEM_RESULT_KEYS.every(key => typeof (value as Record<string, unknown>)[key] === 'number');
