import type { AiGenerationJob, PhotoAssetV1 } from '../../domain/models';
import type { AiArtService, CreativeRepository, ImageRenderer, LocalAssetStore } from '../../domain/ports';
import { AiArtError } from '../../infrastructure/network/HttpAiArtService';
import { makeFilterRecipe } from '../../infrastructure/rendering/filters';

export type AiCreationPhase = 'preparing' | 'painting' | 'saving';
type Dependencies = {
  aiArtService: AiArtService;
  creativeRepository: CreativeRepository;
  assetStore: LocalAssetStore;
  imageRenderer: ImageRenderer;
  now: () => Date;
  createId: () => string;
  sleep?: (ms: number) => Promise<void>;
};

export class AiCreationIssue extends Error {
  constructor(public readonly code: string, public readonly pending: boolean,
    public readonly job: AiGenerationJob | undefined, message: string) { super(message); }
}

/** Freeze a bounded JPEG once so retries use exactly the same input and idempotency key. */
export const prepareAiCreation = async (
  recordId: string, styleId: string, source: PhotoAssetV1, deps: Dependencies,
): Promise<{ job: AiGenerationJob; input: PhotoAssetV1 }> => {
  const entitlement = await deps.aiArtService.getEntitlement();
  if (entitlement.aiRemainingToday <= 0 && entitlement.inviteCreditsRemaining <= 0) {
    throw new AiArtError('AI_QUOTA_EXHAUSTED', '当前没有可用创作次数，可以去兑换邀请码。');
  }
  await deps.assetStore.verify(source);
  const timestamp = deps.now().toISOString();
  const recipe = makeFilterRecipe({ id: deps.createId(), recordId, sourceAssetId: source.id,
    presetId: 'cream-morning', intensity: 0, createdAt: timestamp });
  const image = await deps.imageRenderer.render(deps.assetStore.resolveUri(source), source, recipe, 2048);
  const input = await deps.assetStore.saveRendered(image, source, recordId, 'filtered');
  const job: AiGenerationJob = { id: deps.createId(), recordId, styleId, inputAssetId: input.id,
    status: 'queued', createdAt: timestamp, updatedAt: timestamp };
  try {
    if (input.byteCount > 10 * 1024 * 1024) throw new AiArtError('IMAGE_TOO_LARGE', '照片仍然偏大，请先裁切后再创作。');
    await deps.creativeRepository.createAiJob(job, input);
    return { job, input };
  } catch (error) {
    await deps.assetStore.remove(input).catch(() => undefined);
    throw error;
  }
};

export const continueAiCreation = async (
  initialJob: AiGenerationJob, input: PhotoAssetV1, deps: Dependencies,
  onPhase: (phase: AiCreationPhase) => void,
): Promise<PhotoAssetV1> => {
  let job = { ...initialJob };
  let remoteFailed = false;
  const sleep = deps.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  try {
    onPhase('painting');
    let remote = job.remoteJobId
      ? await deps.aiArtService.getGeneration(job.remoteJobId)
      : await deps.aiArtService.createGeneration({ jobId: job.id, recordId: job.recordId,
        styleId: job.styleId, imageUri: deps.assetStore.resolveUri(input),
        contentType: input.contentType === 'image/png' ? 'image/png' : 'image/jpeg' });
    job = { ...job, remoteJobId: remote.remoteJobId, status: 'processing', errorMessage: undefined, updatedAt: deps.now().toISOString() };
    await deps.creativeRepository.updateAiJob(job);
    for (let attempt = 0; remote.status === 'queued' || remote.status === 'processing'; attempt++) {
      if (attempt >= 40) throw new AiArtError('AI_TIMEOUT', '这次绘制还在进行，可以稍后回来继续收取。');
      await sleep(3000);
      remote = await deps.aiArtService.getGeneration(remote.remoteJobId);
    }
    if (remote.status === 'failed') {
      remoteFailed = true;
      throw new AiArtError(remote.errorCode ?? 'AI_GENERATION_FAILED', remote.errorMessage ?? '这次绘制未完成，原图还在。');
    }
    onPhase('saving');
    const photo = await deps.aiArtService.downloadGeneration(remote.remoteJobId);
    let output: PhotoAssetV1 | undefined;
    try {
      const saved = await deps.assetStore.saveOriginal(photo, job.recordId);
      output = { ...saved, kind: 'filtered', sourceAssetId: input.sourceAssetId ?? input.id };
      await deps.creativeRepository.completeAiJob({ ...job, status: 'succeeded', outputAssetId: output.id,
        errorMessage: undefined, updatedAt: deps.now().toISOString() }, output);
      return output;
    } catch (error) {
      if (output) await deps.assetStore.remove(output).catch(() => undefined);
      throw error;
    } finally {
      await deps.aiArtService.releaseDownload?.(photo.uri).catch(() => undefined);
    }
  } catch (error) {
    const code = error instanceof AiArtError ? error.code : 'AI_SAVE_PENDING';
    const definitive = remoteFailed || code === 'AI_JOB_NOT_FOUND' || !job.remoteJobId && /^(AI_AUTH_REQUIRED|AI_QUOTA_EXHAUSTED|AI_STYLE_NOT_FOUND|IMAGE_[A-Z_]+|ARK_GENERATION_FAILED|ARK_NOT_CONFIGURED|AI_GENERATION_FAILED)$/.test(code);
    job = { ...job, status: definitive ? 'failed' : 'processing',
      errorMessage: error instanceof AiArtError ? error.message : '作品暂时没收好，可以继续收取。', updatedAt: deps.now().toISOString() };
    await deps.creativeRepository.updateAiJob(job).catch(() => undefined);
    throw new AiCreationIssue(code, !definitive, job, job.errorMessage!);
  }
};
