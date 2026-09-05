import type { DrinkRecordV1 } from '../../domain/models';
import type {
  DrinkRecordRepository,
  LocalAssetStore,
  PhotoImporter,
  PhotoSource,
} from '../../domain/ports';

interface Dependencies {
  photoImporter: PhotoImporter;
  assetStore: LocalAssetStore;
  repository: DrinkRecordRepository;
  now: () => Date;
  createId: () => string;
}

type TextDraftDependencies = Pick<
  Dependencies,
  'repository' | 'now' | 'createId'
>;

export const createTextOnlyDraft = async (
  dependencies: TextDraftDependencies,
): Promise<string> => {
  const recordId = dependencies.createId();
  const timestamp = dependencies.now().toISOString();
  const record: DrinkRecordV1 = {
    id: recordId,
    schemaVersion: 1,
    lifecycle: 'draft',
    occurredAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await dependencies.repository.createDraft(record);
  return recordId;
};

export const createDraftFromSource = async (
  source: PhotoSource,
  dependencies: Dependencies,
): Promise<string | null> => {
  const photo = await dependencies.photoImporter.importPhoto(source);
  if (!photo) {
    return null;
  }

  const recordId = dependencies.createId();
  const original = await dependencies.assetStore.saveOriginal(photo, recordId);
  const timestamp = dependencies.now().toISOString();
  const record: DrinkRecordV1 = {
    id: recordId,
    schemaVersion: 1,
    lifecycle: 'draft',
    occurredAt: timestamp,
    originalAssetId: original.id,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  try {
    await dependencies.repository.createDraft(record, original);
  } catch (error) {
    // SQLite and the file system cannot share one transaction. If the draft
    // transaction fails, compensate by removing the unreferenced original.
    try {
      await dependencies.assetStore.remove(original);
    } catch {
      // Preserve the persistence error; cleanup is best-effort.
    }
    throw error;
  }
  return recordId;
};
