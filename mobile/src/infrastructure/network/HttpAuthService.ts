import { z } from 'zod';

import {
  AuthError,
  type AuthService,
  type AuthSession,
  type SmsChallenge,
  type StoredAuthSession,
  type TokenStore,
} from '../../domain/auth';

const challengeSchema = z.object({
  challengeId: z.string().min(1).max(256),
  expiresIn: z.number().int().positive().max(86400),
});
const loginSchema = z.object({
  accessToken: z.string().min(1).max(16384).regex(/^\S+$/),
  tokenType: z.literal('bearer'),
  expiresIn: z.number().int().positive().max(31536000),
  phoneMasked: z.string().min(1).max(64),
});
const errorSchema = z.object({
  error: z.object({
    code: z.string().min(1).max(100),
    message: z.string().min(1).max(300),
  }),
});

export class HttpAuthService implements AuthService {
  constructor(
    private readonly baseUrl: string,
    private readonly tokenStore: TokenStore,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async requestSmsCode(phone: string): Promise<SmsChallenge> {
    if (!/^1\d{10}$/.test(phone)) {
      throw new AuthError('INVALID_PHONE', '请输入 11 位中国大陆手机号。');
    }
    this.apiUrl('/auth/sms/request');
    await this.tokenStore.read();
    return this.post('/auth/sms/request', { phone }, challengeSchema);
  }

  async verifySmsCode(challengeId: string, code: string): Promise<AuthSession> {
    if (!challengeId || !/^\d{6}$/.test(code)) {
      throw new AuthError('INVALID_CODE', '请先获取验证码，再输入短信里的 6 位数字。');
    }
    const result = await this.post('/auth/sms/verify', { challengeId, code }, loginSchema);
    const session: StoredAuthSession = {
      accessToken: result.accessToken,
      phoneMasked: result.phoneMasked,
      expiresAt: this.now() + result.expiresIn * 1000,
    };
    await this.tokenStore.write(session);
    return { phoneMasked: session.phoneMasked, expiresAt: session.expiresAt };
  }

  async loginWithInvite(code: string): Promise<AuthSession> {
    if (!code.trim()) {
      throw new AuthError('INVALID_CODE', '请先输入邀请码。');
    }
    const result = await this.post('/auth/invite', { code: code.trim() }, loginSchema);
    const session: StoredAuthSession = {
      accessToken: result.accessToken,
      phoneMasked: result.phoneMasked,
      expiresAt: this.now() + result.expiresIn * 1000,
    };
    await this.tokenStore.write(session);
    return { phoneMasked: session.phoneMasked, expiresAt: session.expiresAt };
  }

  async getSession(): Promise<AuthSession | null> {
    const session = await this.activeSession();
    return session ? { phoneMasked: session.phoneMasked, expiresAt: session.expiresAt } : null;
  }

  async getAccessToken(): Promise<string | null> {
    return (await this.activeSession())?.accessToken ?? null;
  }

  async signOut(): Promise<void> {
    await this.tokenStore.clear();
  }

  private async activeSession(): Promise<StoredAuthSession | null> {
    const session = await this.tokenStore.read();
    if (session && session.expiresAt <= this.now()) {
      await this.tokenStore.clear();
      return null;
    }
    return session;
  }

  private apiUrl(path: string): string {
    try {
      const url = new URL(this.baseUrl);
      if (url.protocol !== 'https:' || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) {
        throw new Error('Invalid origin');
      }
      return `${url.origin}/api/v1${path}`;
    } catch {
      throw new AuthError('SERVICE_NOT_CONFIGURED', '登录服务正在准备中，本机记录可以继续使用。');
    }
  }

  private async post<T>(path: string, body: object, schema: z.ZodType<T>): Promise<T> {
    const url = this.apiUrl(path);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await this.fetcher(url, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new AuthError('INVALID_RESPONSE', '登录服务暂时没有正确回应，请稍后重试。');
      }
      if (!response.ok) {
        const parsed = errorSchema.safeParse(payload);
        if (parsed.success) {
          throw new AuthError(parsed.data.error.code, parsed.data.error.message);
        }
        throw new AuthError('REQUEST_FAILED', '暂时没有完成，请稍后重试。');
      }
      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        throw new AuthError('INVALID_RESPONSE', '登录服务暂时没有正确回应，请稍后重试。');
      }
      return parsed.data;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError(
        controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_UNAVAILABLE',
        controller.signal.aborted ? '等得有点久，请稍后再试一次。' : '网络暂时没连上，请检查网络后重试。',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
