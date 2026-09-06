import type {
  JournalSticker,
  PhotoAssetV1,
  RecordAggregate,
} from '../src/domain/models';
import { journalStickerAssetFor, studioSourceAssetFor } from '../src/features/shared/recordAssets';
import { makeFilterRecipe } from '../src/infrastructure/rendering/filters';

const recordId = '11111111-1111-4111-8111-111111111111';
const sourceAssetId = '22222222-2222-4222-8222-222222222222';
const cutoutAssetId = '33333333-3333-4333-8333-333333333333';
const stickerId = '44444444-4444-4444-8444-444444444444';
const timestamp = '2026-09-05T08:00:00.000Z';

const asset = (id: string, kind: PhotoAssetV1['kind']): PhotoAssetV1 => ({
  id,
  schemaVersion: 1,
  recordId,
  kind,
  relativePath: `media/${kind}/${recordId}/${id}.png`,
  contentType: 'image/png',
  pixelWidth: 900,
  pixelHeight: 1200,
  byteCount: 1000,
  sha256: 'a'.repeat(64),
  createdAt: timestamp,
});

const aggregate = {
  record: {
    id: recordId,
    schemaVersion: 1,
    lifecycle: 'saved',
    occurredAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  },
  assets: [asset(sourceAssetId, 'original'), asset(cutoutAssetId, 'filtered')],
  journalStickers: [],
} as RecordAggregate;

const sticker: JournalSticker = {
  id: stickerId,
  recordId,
  category: 'food',
  label: '今天的美食',
  sourceAssetId,
  cutoutAssetId,
  cutoutStatus: 'ready',
  associationScope: 'record',
  positionX: 0.5,
  positionY: 0.5,
  scale: 1,
  rotationDegrees: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
};

describe('journalStickerAssetFor', () => {
  it('uses the selected AI output in creation while preserving the original pointer', () => {
    const value = { ...aggregate, record: { ...aggregate.record, originalAssetId: sourceAssetId, displayAssetId: cutoutAssetId } };
    expect(studioSourceAssetFor(value)?.id).toBe(cutoutAssetId);
    expect(value.record.originalAssetId).toBe(sourceAssetId);
  });
  it('edits the recipe source rather than filtering the already rendered display twice', () => {
    const value = { ...aggregate, record: { ...aggregate.record, originalAssetId: sourceAssetId, displayAssetId: cutoutAssetId },
      recipe: makeFilterRecipe({ id: stickerId, recordId, sourceAssetId, presetId: 'cream-morning', intensity: 0.7, createdAt: timestamp }) };
    expect(studioSourceAssetFor(value)?.id).toBe(sourceAssetId);
  });
  it('uses the transparent asset for a ready paper sticker', () => {
    expect(journalStickerAssetFor(aggregate, sticker)?.id).toBe(cutoutAssetId);
  });

  it('does not turn an opaque source photo into a fake ready sticker', () => {
    expect(
      journalStickerAssetFor(aggregate, {
        ...sticker,
        cutoutAssetId: undefined,
      }),
    ).toBeUndefined();
  });

  it('uses the source photo only for the honest source-only fallback card', () => {
    expect(
      journalStickerAssetFor(aggregate, {
        ...sticker,
        cutoutAssetId: undefined,
        cutoutStatus: 'source-only',
      })?.id,
    ).toBe(sourceAssetId);
  });
});
