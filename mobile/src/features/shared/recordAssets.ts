import type { JournalSticker, PhotoAssetV1, RecordAggregate } from '../../domain/models';

export const archiveStart = new Date(2000, 0, 1).toISOString();
export const archiveEnd = new Date(2100, 0, 1).toISOString();

export const previewAssetFor = (
  aggregate: RecordAggregate,
): PhotoAssetV1 | undefined =>
  aggregate.assets.find(
    asset => asset.id === aggregate.record.thumbnailAssetId,
  ) ??
  aggregate.assets.find(
    asset => asset.id === aggregate.record.displayAssetId,
  ) ??
  aggregate.assets.find(
    asset => asset.id === aggregate.record.originalAssetId,
  );

export const displayAssetFor = (
  aggregate: RecordAggregate,
): PhotoAssetV1 | undefined =>
  aggregate.assets.find(
    asset => asset.id === aggregate.record.displayAssetId,
  ) ??
  aggregate.assets.find(
    asset => asset.id === aggregate.record.originalAssetId,
  );

/** Edit the selected source, not a second pass over its already-filtered display derivative. */
export const studioSourceAssetFor = (aggregate: RecordAggregate): PhotoAssetV1 | undefined =>
  aggregate.assets.find(asset => asset.id === aggregate.recipe?.sourceAssetId) ??
  (!aggregate.recipe ? displayAssetFor(aggregate) : undefined) ??
  aggregate.assets.find(asset => asset.id === aggregate.record.originalAssetId);

export const journalStickerAssetFor = (
  aggregate: RecordAggregate,
  sticker: JournalSticker,
): PhotoAssetV1 | undefined => {
  // A "ready" sticker must render the transparent cutout. Falling back to the
  // opaque source photo would make corrupt/legacy data look like a rectangular
  // card wrapped in a white border instead of an actual contour sticker.
  const assetId =
    sticker.cutoutStatus === 'ready'
      ? sticker.cutoutAssetId
      : sticker.sourceAssetId;

  return assetId
    ? aggregate.assets.find(asset => asset.id === assetId)
    : undefined;
};
