import type { AiGenerationJob, PhotoAssetV1 } from '../src/domain/models';
import { AiArtError } from '../src/infrastructure/network/HttpAiArtService';
import { continueAiCreation, prepareAiCreation } from '../src/features/create-studio/aiCreation';

const timestamp = '2026-09-06T00:00:00.000Z';
const source: PhotoAssetV1 = { id: 'original', recordId: 'record', schemaVersion: 1,
  kind: 'original', relativePath: 'original.jpg', contentType: 'image/jpeg', pixelWidth: 4000,
  pixelHeight: 3000, byteCount: 1000, sha256: 'a'.repeat(64), createdAt: timestamp };
const job: AiGenerationJob = { id: 'same-key', recordId: 'record', styleId: 'cream-poster',
  status: 'queued', createdAt: timestamp, updatedAt: timestamp };
const fixture = () => {
  const ai = { isConfigured: true, getEntitlement: jest.fn().mockResolvedValue({ aiRemainingToday: 0, inviteCreditsRemaining: 1 }),
    createGeneration: jest.fn().mockResolvedValue({ remoteJobId: 'remote', status: 'completed' }),
    getGeneration: jest.fn().mockResolvedValue({ remoteJobId: 'remote', status: 'completed' }),
    downloadGeneration: jest.fn().mockResolvedValue({ uri: 'file:///cache/result.jpg', contentType: 'image/jpeg', pixelWidth: 2048, pixelHeight: 2048, byteCount: 100 }),
    releaseDownload: jest.fn().mockResolvedValue(undefined), redeemInvite: jest.fn() };
  const store = { initialize: jest.fn(), verify: jest.fn(), resolveUri: jest.fn(asset => `file:///${asset.relativePath}`),
    saveRendered: jest.fn().mockResolvedValue({ ...source, id: 'input', kind: 'filtered', sourceAssetId: source.id }),
    saveOriginal: jest.fn().mockResolvedValue({ ...source, id: 'output' }), remove: jest.fn().mockResolvedValue(undefined) };
  const repository = { createAiJob: jest.fn(), updateAiJob: jest.fn().mockResolvedValue(undefined), completeAiJob: jest.fn() };
  const renderer = { render: jest.fn().mockResolvedValue({ base64: 'image', contentType: 'image/jpeg', pixelWidth: 2048, pixelHeight: 1536 }) };
  const deps = { aiArtService: ai, assetStore: store, creativeRepository: repository,
    imageRenderer: renderer, now: () => new Date(timestamp), createId: () => 'new-id', sleep: jest.fn().mockResolvedValue(undefined) };
  return { ai, store, repository, renderer, deps: deps as unknown as Parameters<typeof continueAiCreation>[2] };
};

describe('recoverable AI creation', () => {
  it('freezes one neutral bounded input and persists it with the task before uploading', async () => {
    const { deps, repository, renderer } = fixture();
    const prepared = await prepareAiCreation('record', 'cream-poster', source, deps);
    expect(renderer.render).toHaveBeenCalledWith('file:///original.jpg', source, expect.objectContaining({ intensity: 0 }), 2048);
    expect(prepared.job.inputAssetId).toBe('input');
    expect(repository.createAiJob).toHaveBeenCalledWith(prepared.job, prepared.input);
  });
  it('does not prepare or upload when there are no credits', async () => {
    const { deps, ai, renderer } = fixture();
    ai.getEntitlement.mockResolvedValue({ aiRemainingToday: 0, inviteCreditsRemaining: 0 });
    await expect(prepareAiCreation('record', 'cream-poster', source, deps)).rejects.toMatchObject({ code: 'AI_QUOTA_EXHAUSTED' });
    expect(renderer.render).not.toHaveBeenCalled(); expect(ai.createGeneration).not.toHaveBeenCalled();
  });
  it('handles a synchronous completed response, saves locally, and atomically selects the main photo', async () => {
    const { deps, repository, ai, store } = fixture(); const phase = jest.fn();
    const result = await continueAiCreation(job, source, deps, phase);
    expect(phase.mock.calls).toEqual([['painting'], ['saving']]);
    expect(ai.createGeneration).toHaveBeenCalledTimes(1);
    expect(repository.completeAiJob).toHaveBeenCalledWith(expect.objectContaining({ remoteJobId: 'remote', status: 'succeeded', outputAssetId: 'output' }), result);
    expect(result).toMatchObject({ id: 'output', kind: 'filtered', sourceAssetId: 'original' });
    expect(store.remove).not.toHaveBeenCalled(); expect(ai.releaseDownload).toHaveBeenCalled();
  });
  it('polls a processing result instead of generating again', async () => {
    const { deps, ai } = fixture();
    ai.createGeneration.mockResolvedValue({ remoteJobId: 'remote', status: 'processing' });
    await continueAiCreation(job, source, deps, jest.fn());
    expect(ai.createGeneration).toHaveBeenCalledTimes(1); expect(ai.getGeneration).toHaveBeenCalledWith('remote');
  });
  it('keeps the same key after an upload timeout and never automatically starts another paid call', async () => {
    const { deps, ai, repository } = fixture();
    ai.createGeneration.mockRejectedValue(new AiArtError('AI_TIMEOUT', '暂时未收到结果'));
    await expect(continueAiCreation(job, source, deps, jest.fn())).rejects.toMatchObject({ pending: true, job: { id: 'same-key', status: 'processing' } });
    expect(ai.createGeneration).toHaveBeenCalledTimes(1);
    expect(repository.updateAiJob).toHaveBeenCalledWith(expect.objectContaining({ id: 'same-key', status: 'processing' }));
  });
  it('resumes download by remote id without spending another generation credit', async () => {
    const { deps, ai } = fixture();
    await continueAiCreation({ ...job, remoteJobId: 'remote', status: 'processing' }, source, deps, jest.fn());
    expect(ai.createGeneration).not.toHaveBeenCalled(); expect(ai.getGeneration).toHaveBeenCalledWith('remote');
    expect(ai.downloadGeneration).toHaveBeenCalledWith('remote');
  });
  it('keeps a completed remote job recoverable if image download fails', async () => {
    const { deps, ai, repository } = fixture();
    ai.downloadGeneration.mockRejectedValue(new AiArtError('AI_DOWNLOAD_PENDING', '下载中断'));
    await expect(continueAiCreation(job, source, deps, jest.fn())).rejects.toMatchObject({ pending: true, job: { remoteJobId: 'remote', status: 'processing' } });
    expect(repository.completeAiJob).not.toHaveBeenCalled();
  });
  it('marks a real server failure as failed, without replacing the original', async () => {
    const { deps, ai, repository } = fixture();
    ai.createGeneration.mockResolvedValue({ remoteJobId: 'remote', status: 'failed', errorCode: 'ARK_GENERATION_FAILED' });
    await expect(continueAiCreation(job, source, deps, jest.fn())).rejects.toMatchObject({ pending: false, job: { status: 'failed' } });
    expect(repository.completeAiJob).not.toHaveBeenCalled(); expect(ai.downloadGeneration).not.toHaveBeenCalled();
  });
  it('cleans only the new uncommitted file if local persistence fails', async () => {
    const { deps, repository, store, ai } = fixture();
    repository.completeAiJob.mockRejectedValue(new Error('disk full'));
    await expect(continueAiCreation(job, source, deps, jest.fn())).rejects.toMatchObject({ pending: true });
    expect(store.remove).toHaveBeenCalledTimes(1); expect(store.remove).toHaveBeenCalledWith(expect.objectContaining({ id: 'output' }));
    expect(ai.releaseDownload).toHaveBeenCalled();
  });
});
