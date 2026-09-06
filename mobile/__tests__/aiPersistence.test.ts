import type { DB } from '@op-engineering/op-sqlite';
import { SQLiteDrinkRecordRepository } from '../src/infrastructure/persistence/sqlite/SQLiteDrinkRecordRepository';
import type { AiGenerationJob, PhotoAssetV1 } from '../src/domain/models';
jest.mock('@op-engineering/op-sqlite', () => ({ open: jest.fn() }));
const recordId = '11111111-1111-4111-8111-111111111111';
const assetId = '22222222-2222-4222-8222-222222222222';
const jobId = '33333333-3333-4333-8333-333333333333';
const time = '2026-09-06T00:00:00.000Z';
const output: PhotoAssetV1 = { id: assetId, recordId, kind: 'filtered', schemaVersion: 1, relativePath: `media/filtered/${recordId}/${assetId}.jpg`,
  contentType: 'image/jpeg', pixelWidth: 2048, pixelHeight: 2048, byteCount: 1000, sha256: 'a'.repeat(64), createdAt: time };
const job: AiGenerationJob = { id: jobId, recordId, status: 'succeeded', styleId: 'cream-poster', outputAssetId: assetId, remoteJobId: 'remote', createdAt: time, updatedAt: time };
const fixture = (status = 'processing', owned = true) => {
  const execute = jest.fn(async (sql: string) => ({ rowsAffected: 1, rows: sql.startsWith('SELECT') ? owned ? [{ record_id: recordId, status, id: assetId }] : [] : [] }));
  const db = { execute: jest.fn(), transaction: jest.fn(async callback => callback({ execute })) };
  return { repository: new SQLiteDrinkRecordRepository(db as unknown as DB), execute, db };
};
describe('AI persistence', () => {
  it('commits the output, job, and selected photo in one transaction, without touching the original pointer', async () => {
    const { repository, execute, db } = fixture();
    await repository.completeAiJob(job, output);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    const statements = execute.mock.calls.map(call => call[0]);
    expect(statements.some(sql => sql.includes('INSERT') && sql.includes('photo_assets'))).toBe(true);
    expect(statements.some(sql => sql.includes('display_asset_id = ?'))).toBe(true);
    expect(statements.some(sql => sql.includes('filter_intensity = 0'))).toBe(true);
    expect(statements.some(sql => sql.includes('SET original_asset_id'))).toBe(false);
    expect(statements.some(sql => /DELETE|DROP/.test(sql))).toBe(false);
  });
  it('does not overwrite an already completed job', async () => {
    const { repository, execute } = fixture('succeeded');
    await expect(repository.completeAiJob(job, output)).rejects.toThrow('already changed');
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('rejects selecting another record’s photo', async () => {
    const { repository, execute } = fixture('processing', false);
    await expect(repository.selectStudioPhoto(recordId, assetId, time)).rejects.toThrow('not a saved result');
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
