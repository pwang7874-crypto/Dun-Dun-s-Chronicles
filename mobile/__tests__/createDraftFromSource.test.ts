import type { ImportedPhoto, PhotoAssetV1 } from '../src/domain/models';
import type {
  DrinkRecordRepository,
  LocalAssetStore,
  PhotoImporter,
} from '../src/domain/ports';
import {
  createDraftFromSource,
  createTextOnlyDraft,
} from '../src/features/photo-source/createDraftFromSource';

const recordId = '11111111-1111-4111-8111-111111111111';
const originalId = '22222222-2222-4222-8222-222222222222';
const timestamp = '2026-09-02T08:00:00.000Z';

const photo: ImportedPhoto = {
  uri: 'file:///picker/photo.jpg',
  contentType: 'image/jpeg',
  pixelWidth: 1200,
  pixelHeight: 1600,
  byteCount: 1000,
};

const original: PhotoAssetV1 = {
  id: originalId,
  schemaVersion: 1,
  recordId,
  kind: 'original',
  relativePath: `media/originals/${recordId}/${originalId}.jpg`,
  contentType: 'image/jpeg',
  pixelWidth: 1200,
  pixelHeight: 1600,
  byteCount: 1000,
  sha256: 'a'.repeat(64),
  createdAt: timestamp,
};

const repository = (): DrinkRecordRepository => ({
  initialize: jest.fn(),
  createDraft: jest.fn(),
  save: jest.fn(),
  findById: jest.fn(),
  findSavedInRange: jest.fn(),
  findLatestDraft: jest.fn(),
});

const assetStore = (): LocalAssetStore => ({
  initialize: jest.fn(),
  saveOriginal: jest.fn(async () => original),
  saveRendered: jest.fn(),
  resolveUri: jest.fn(),
  verify: jest.fn(),
  remove: jest.fn(),
});

describe('createDraftFromSource', () => {
  it('creates a recoverable draft without manufacturing a photo', async () => {
    const records = repository();

    const result = await createTextOnlyDraft({
      repository: records,
      now: () => new Date(timestamp),
      createId: () => recordId,
    });

    expect(result).toBe(recordId);
    expect(records.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        id: recordId,
        lifecycle: 'draft',
      }),
    );
    const savedDraft = (records.createDraft as jest.Mock).mock.calls[0]?.[0];
    expect(savedDraft.originalAssetId).toBeUndefined();
  });

  it('does nothing when the system picker is cancelled', async () => {
    const photoImporter: PhotoImporter = {
      importPhoto: jest.fn(async () => null),
    };
    const store = assetStore();
    const records = repository();

    const result = await createDraftFromSource('library', {
      photoImporter,
      assetStore: store,
      repository: records,
      now: () => new Date(timestamp),
      createId: () => recordId,
    });

    expect(result).toBeNull();
    expect(store.saveOriginal).not.toHaveBeenCalled();
    expect(records.createDraft).not.toHaveBeenCalled();
  });

  it('persists the original before creating a recoverable draft', async () => {
    const calls: string[] = [];
    const photoImporter: PhotoImporter = {
      importPhoto: jest.fn(async () => photo),
    };
    const store = assetStore();
    store.saveOriginal = jest.fn(async () => {
      calls.push('original');
      return original;
    });
    const records = repository();
    records.createDraft = jest.fn(async savedRecord => {
      calls.push('draft');
      expect(savedRecord.originalAssetId).toBe(originalId);
      expect(savedRecord.lifecycle).toBe('draft');
    });

    const result = await createDraftFromSource('camera', {
      photoImporter,
      assetStore: store,
      repository: records,
      now: () => new Date(timestamp),
      createId: () => recordId,
    });

    expect(result).toBe(recordId);
    expect(calls).toEqual(['original', 'draft']);
  });

  it('removes an unreferenced original when the draft transaction fails', async () => {
    const persistenceError = new Error('database unavailable');
    const photoImporter: PhotoImporter = {
      importPhoto: jest.fn(async () => photo),
    };
    const store = assetStore();
    const records = repository();
    records.createDraft = jest.fn(async () => {
      throw persistenceError;
    });

    await expect(
      createDraftFromSource('library', {
        photoImporter,
        assetStore: store,
        repository: records,
        now: () => new Date(timestamp),
        createId: () => recordId,
      }),
    ).rejects.toBe(persistenceError);

    expect(store.remove).toHaveBeenCalledWith(original);
  });
});
