import type { JournalSticker, PhotoAssetV1 } from '../../domain/models';
import type { CreativeRepository, LocalAssetStore, SubjectCutoutService } from '../../domain/ports';

/** Replace only the generated cutout. The original, name and canvas placement survive. */
export const remakeJournalSticker = async (
  sticker: JournalSticker,
  source: PhotoAssetV1,
  dependencies: {
    assetStore: LocalAssetStore;
    subjectCutoutService: SubjectCutoutService;
    creativeRepository: CreativeRepository;
    now: () => Date;
  },
): Promise<void> => {
  const { assetStore, subjectCutoutService, creativeRepository } = dependencies;
  const photo = await subjectCutoutService.extractSubject(assetStore.resolveUri(source));
  let asset: PhotoAssetV1 | undefined;
  try {
    asset = await assetStore.saveOriginal(photo, sticker.recordId);
    let oldAsset: PhotoAssetV1 | undefined;
    try {
      oldAsset = await creativeRepository.replaceJournalStickerCutout(sticker.id, asset, dependencies.now().toISOString());
    } catch (error) {
      await assetStore.remove(asset).catch(() => undefined);
      throw error;
    }
    if (oldAsset) await assetStore.remove(oldAsset).catch(() => undefined);
  } finally {
    await subjectCutoutService.releaseTemporary?.(photo.uri).catch(() => undefined);
  }
};
