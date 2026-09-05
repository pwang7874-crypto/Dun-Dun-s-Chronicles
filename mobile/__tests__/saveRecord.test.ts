import type {
  DrinkRecordV1,
  EditRecipeV1,
  PhotoAssetV1,
  RecordAggregate,
  RenderedImage,
} from '../src/domain/models';
import type {
  DrinkRecordRepository,
  ImageRenderer,
  LocalAssetStore,
} from '../src/domain/ports';
import { saveRecord } from '../src/features/record-editor/saveRecord';

const recordId = '11111111-1111-4111-8111-111111111111';
const originalId = '22222222-2222-4222-8222-222222222222';
const recipeId = '33333333-3333-4333-8333-333333333333';
const filteredId = '44444444-4444-4444-8444-444444444444';
const thumbnailId = '55555555-5555-4555-8555-555555555555';
const timestamp = '2026-09-02T08:00:00.000Z';

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

const record: DrinkRecordV1 = {
  id: recordId,
  schemaVersion: 1,
  lifecycle: 'draft',
  occurredAt: timestamp,
  originalAssetId: originalId,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const rendered = (
  id: string,
  kind: 'filtered' | 'thumbnail',
): PhotoAssetV1 => ({
  ...original,
  id,
  kind,
  sourceAssetId: originalId,
  relativePath: `media/${kind}/${recordId}/${id}.jpg`,
  contentType: 'image/jpeg',
});

describe('saveRecord', () => {
  it('updates the same record and never replaces its original asset', async () => {
    const saved: Array<{
      record: DrinkRecordV1;
      recipe: EditRecipeV1 | undefined;
      assets: PhotoAssetV1[];
    }> = [];
    const repository: DrinkRecordRepository = {
      initialize: jest.fn(),
      createDraft: jest.fn(),
      save: jest.fn(async (nextRecord, recipe, assets) => {
        saved.push({ record: nextRecord, recipe, assets });
      }),
      findById: jest.fn(),
      findSavedInRange: jest.fn(),
      findLatestDraft: jest.fn(),
    };
    const assetStore: LocalAssetStore = {
      initialize: jest.fn(),
      saveOriginal: jest.fn(),
      saveRendered: jest
        .fn()
        .mockResolvedValueOnce(rendered(filteredId, 'filtered'))
        .mockResolvedValueOnce(rendered(thumbnailId, 'thumbnail')),
      resolveUri: jest.fn(() => 'file:///private/original.jpg'),
      verify: jest.fn(),
      remove: jest.fn(),
    };
    const image: RenderedImage = {
      base64: 'encoded',
      contentType: 'image/jpeg',
      pixelWidth: 600,
      pixelHeight: 800,
    };
    const imageRenderer: ImageRenderer = {
      render: jest.fn(async () => image),
    };
    const aggregate: RecordAggregate = { record, assets: [original] };

    const result = await saveRecord(
      {
        aggregate,
        intensity: 0.68,
        form: {
          occurredAt: timestamp,
          beverageName: '桂花拿铁',
          category: '咖啡',
          shopName: '街角咖啡',
          sugarLevel: '无糖',
          temperature: '热',
        },
      },
      {
        repository,
        assetStore,
        imageRenderer,
        now: () => new Date(timestamp),
        createId: () => recipeId,
      },
    );

    expect(result.id).toBe(recordId);
    expect(result.originalAssetId).toBe(originalId);
    expect(result.lifecycle).toBe('saved');
    expect(result.displayAssetId).toBe(filteredId);
    expect(result.thumbnailAssetId).toBe(thumbnailId);
    expect(result.sugarLevel).toBe('无糖');
    expect(result.temperature).toBe('热');
    expect(assetStore.verify).toHaveBeenCalledWith(original);
    expect(imageRenderer.render).toHaveBeenNthCalledWith(
      1,
      'file:///private/original.jpg',
      original,
      expect.objectContaining({ intensity: 0.68 }),
      4096,
    );
    expect(imageRenderer.render).toHaveBeenNthCalledWith(
      2,
      'file:///private/original.jpg',
      original,
      expect.any(Object),
      640,
    );
    expect(saved).toHaveLength(1);
    expect(saved[0]?.recipe).toBeDefined();
    expect(saved[0]?.assets.map(asset => asset.id)).toEqual([
      filteredId,
      thumbnailId,
    ]);
  });

  it('saves a text-only record without rendering or manufacturing an asset', async () => {
    const textRecord: DrinkRecordV1 = {
      id: recordId,
      schemaVersion: 1,
      lifecycle: 'draft',
      occurredAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const repository: DrinkRecordRepository = {
      initialize: jest.fn(),
      createDraft: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findSavedInRange: jest.fn(),
      findLatestDraft: jest.fn(),
    };
    const assetStore: LocalAssetStore = {
      initialize: jest.fn(),
      saveOriginal: jest.fn(),
      saveRendered: jest.fn(),
      resolveUri: jest.fn(),
      verify: jest.fn(),
      remove: jest.fn(),
    };
    const imageRenderer: ImageRenderer = { render: jest.fn() };

    const result = await saveRecord(
      {
        aggregate: { record: textRecord, assets: [] },
        intensity: 0.7,
        form: { occurredAt: timestamp, note: '只写一句也要保存' },
      },
      {
        repository,
        assetStore,
        imageRenderer,
        now: () => new Date(timestamp),
        createId: () => recipeId,
      },
    );

    expect(result).toMatchObject({
      lifecycle: 'saved',
      note: '只写一句也要保存',
    });
    expect(result.originalAssetId).toBeUndefined();
    expect(repository.save).toHaveBeenCalledWith(result, undefined, []);
    expect(assetStore.verify).not.toHaveBeenCalled();
    expect(imageRenderer.render).not.toHaveBeenCalled();
    expect(assetStore.saveRendered).not.toHaveBeenCalled();
  });

  it('stops before rendering when original integrity verification fails', async () => {
    const integrityError = new Error('checksum mismatch');
    const repository: DrinkRecordRepository = {
      initialize: jest.fn(),
      createDraft: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findSavedInRange: jest.fn(),
      findLatestDraft: jest.fn(),
    };
    const assetStore: LocalAssetStore = {
      initialize: jest.fn(),
      saveOriginal: jest.fn(),
      saveRendered: jest.fn(),
      resolveUri: jest.fn(),
      verify: jest.fn(async () => {
        throw integrityError;
      }),
      remove: jest.fn(),
    };
    const imageRenderer: ImageRenderer = { render: jest.fn() };

    await expect(
      saveRecord(
        {
          aggregate: { record, assets: [original] },
          intensity: 0.7,
          form: { occurredAt: timestamp },
        },
        {
          repository,
          assetStore,
          imageRenderer,
          now: () => new Date(timestamp),
          createId: () => recipeId,
        },
      ),
    ).rejects.toBe(integrityError);
    expect(imageRenderer.render).not.toHaveBeenCalled();
    expect(assetStore.saveRendered).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('does not mutate the recoverable draft when persistence fails', async () => {
    const repository: DrinkRecordRepository = {
      initialize: jest.fn(),
      createDraft: jest.fn(),
      save: jest.fn(async () => {
        throw new Error('disk full');
      }),
      findById: jest.fn(),
      findSavedInRange: jest.fn(),
      findLatestDraft: jest.fn(),
    };
    const assetStore: LocalAssetStore = {
      initialize: jest.fn(),
      saveOriginal: jest.fn(),
      saveRendered: jest
        .fn()
        .mockResolvedValueOnce(rendered(filteredId, 'filtered'))
        .mockResolvedValueOnce(rendered(thumbnailId, 'thumbnail')),
      resolveUri: jest.fn(() => 'file:///private/original.jpg'),
      verify: jest.fn(),
      remove: jest.fn(),
    };
    const failedSaveImage: RenderedImage = {
        base64: 'encoded',
        contentType: 'image/jpeg',
        pixelWidth: 600,
        pixelHeight: 800,
    };
    const imageRenderer: ImageRenderer = {
      render: jest.fn(async () => failedSaveImage),
    };
    const draftBefore = { ...record };

    await expect(
      saveRecord(
        {
          aggregate: { record, assets: [original] },
          intensity: 0.7,
          form: { occurredAt: timestamp, note: '不会丢失' },
        },
        {
          repository,
          assetStore,
          imageRenderer,
          now: () => new Date(timestamp),
          createId: () => recipeId,
        },
      ),
    ).rejects.toThrow('disk full');
    expect(record).toEqual(draftBefore);
    expect(record.lifecycle).toBe('draft');
    expect(assetStore.remove).toHaveBeenCalledTimes(2);
    expect(assetStore.remove).toHaveBeenCalledWith(
      expect.objectContaining({ id: filteredId }),
    );
    expect(assetStore.remove).toHaveBeenCalledWith(
      expect.objectContaining({ id: thumbnailId }),
    );
  });

  it('removes the first derived file if thumbnail rendering fails', async () => {
    const repository: DrinkRecordRepository = {
      initialize: jest.fn(),
      createDraft: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      findSavedInRange: jest.fn(),
      findLatestDraft: jest.fn(),
    };
    const assetStore: LocalAssetStore = {
      initialize: jest.fn(),
      saveOriginal: jest.fn(),
      saveRendered: jest.fn(async () => rendered(filteredId, 'filtered')),
      resolveUri: jest.fn(() => 'file:///private/original.jpg'),
      verify: jest.fn(),
      remove: jest.fn(),
    };
    const renderError = new Error('thumbnail render failed');
    const imageRenderer: ImageRenderer = {
      render: jest
        .fn()
        .mockResolvedValueOnce({
          base64: 'encoded',
          contentType: 'image/jpeg',
          pixelWidth: 600,
          pixelHeight: 800,
        })
        .mockRejectedValueOnce(renderError),
    };

    await expect(
      saveRecord(
        {
          aggregate: { record, assets: [original] },
          intensity: 0.7,
          form: { occurredAt: timestamp },
        },
        {
          repository,
          assetStore,
          imageRenderer,
          now: () => new Date(timestamp),
          createId: () => recipeId,
        },
      ),
    ).rejects.toBe(renderError);

    expect(assetStore.remove).toHaveBeenCalledTimes(1);
    expect(assetStore.remove).toHaveBeenCalledWith(
      expect.objectContaining({ id: filteredId }),
    );
    expect(repository.save).not.toHaveBeenCalled();
  });
});
