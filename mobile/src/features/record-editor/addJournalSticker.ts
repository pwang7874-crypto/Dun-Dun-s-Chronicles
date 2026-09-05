import type {
  JournalSticker,
  JournalStickerCategory,
  PhotoAssetV1,
} from '../../domain/models';
import type {
  CreativeRepository,
  LocalAssetStore,
  PhotoImporter,
  SubjectCutoutService,
} from '../../domain/ports';

interface Dependencies {
  photoImporter: PhotoImporter;
  assetStore: LocalAssetStore;
  subjectCutoutService: SubjectCutoutService;
  creativeRepository: CreativeRepository;
  now: () => Date;
  createId: () => string;
  associationScope?: JournalSticker['associationScope'];
  associationDateKey?: string;
}

const defaults = {
  outfit: { label: '今日穿搭', positionX: 0.2, positionY: 0.38, rotationDegrees: -4 },
  food: { label: '今日美食', positionX: 0.72, positionY: 0.68, rotationDegrees: 3 },
} as const;

export interface AddedJournalSticker {
  sticker: JournalSticker;
  autoCutout: boolean;
}

export const addJournalStickerFromLibrary = async (
  recordId: string,
  category: JournalStickerCategory,
  dependencies: Dependencies,
): Promise<AddedJournalSticker | null> => {
  const photo = await dependencies.photoImporter.importPhoto('library');
  if (!photo) {
    return null;
  }

  const savedAssets: PhotoAssetV1[] = [];
  try {
    const source = await dependencies.assetStore.saveOriginal(photo, recordId);
    savedAssets.push(source);

    let cutout: PhotoAssetV1 | undefined;
    if (dependencies.subjectCutoutService.isSupported) {
      try {
        const cutoutPhoto = await dependencies.subjectCutoutService.extractSubject(
          dependencies.assetStore.resolveUri(source),
        );
        cutout = await dependencies.assetStore.saveOriginal(cutoutPhoto, recordId);
        savedAssets.push(cutout);
      } catch {
        // A chosen photo is still useful even when the on-device subject model
        // cannot isolate it. Persist it honestly as a framed photo card; the UI
        // never applies the paper-cutout treatment to source-only entries.
      }
    }

    const timestamp = dependencies.now().toISOString();
    const fallback = defaults[category];
    const sticker: JournalSticker = {
      id: dependencies.createId(),
      recordId,
      category,
      label: fallback.label,
      sourceAssetId: source.id,
      cutoutAssetId: cutout?.id,
      cutoutStatus: cutout ? 'ready' : 'source-only',
      associationScope: dependencies.associationScope ?? 'record',
      associationDateKey: dependencies.associationScope === 'day'
        ? dependencies.associationDateKey
        : undefined,
      positionX: fallback.positionX,
      positionY: fallback.positionY,
      scale: 1,
      rotationDegrees: fallback.rotationDegrees,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await dependencies.creativeRepository.addJournalSticker(sticker, savedAssets);
    return { sticker, autoCutout: Boolean(cutout) };
  } catch (error) {
    await Promise.allSettled(savedAssets.map(asset => dependencies.assetStore.remove(asset)));
    throw error;
  }
};
