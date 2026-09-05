import type {
  DrinkRecordV1,
  EditRecipeV1,
  FilterPresetId,
  PhotoAssetV1,
  RecordAggregate,
  RecordFormValues,
} from '../../domain/models';
import type {
  DrinkRecordRepository,
  ImageRenderer,
  LocalAssetStore,
} from '../../domain/ports';
import { drinkRecordSchema } from '../../domain/schemas';
import { makeFilterRecipe } from '../../infrastructure/rendering/filters';

interface SaveRecordDependencies {
  repository: DrinkRecordRepository;
  assetStore: LocalAssetStore;
  imageRenderer: ImageRenderer;
  now: () => Date;
  createId: () => string;
}

interface SaveRecordInput {
  aggregate: RecordAggregate;
  form: RecordFormValues;
  intensity: number;
  presetId?: FilterPresetId;
  edits?: Pick<EditRecipeV1,
    'brightness' | 'contrast' | 'saturation' | 'warmth' | 'cropAspect' |
    'rotationDegrees' | 'straightenDegrees' | 'flipHorizontal' | 'flipVertical'>;
}

export const saveRecord = async (
  input: SaveRecordInput,
  dependencies: SaveRecordDependencies,
): Promise<DrinkRecordV1> => {
  const { aggregate, form, intensity, presetId = 'cream-morning', edits } = input;
  const { repository, assetStore, imageRenderer, now, createId } = dependencies;
  const original = aggregate.assets.find(
    asset => asset.id === aggregate.record.originalAssetId,
  );
  if (aggregate.record.originalAssetId && !original) {
    throw new Error('Original asset is missing from the aggregate');
  }

  const timestamp = now().toISOString();
  if (!original) {
    const textOnlyRecord = drinkRecordSchema.parse({
      ...aggregate.record,
      ...form,
      lifecycle: 'saved',
      displayAssetId: undefined,
      thumbnailAssetId: undefined,
      editRecipeId: undefined,
      updatedAt: timestamp,
    });
    await repository.save(textOnlyRecord, undefined, []);
    return textOnlyRecord;
  }

  await assetStore.verify(original);
  const recipe = makeFilterRecipe({
    id: createId(),
    recordId: aggregate.record.id,
    sourceAssetId: original.id,
    presetId,
    intensity,
    ...edits,
    createdAt: timestamp,
  });
  const sourceUri = assetStore.resolveUri(original);
  const createdAssets: PhotoAssetV1[] = [];

  try {
    const displayImage = await imageRenderer.render(
      sourceUri,
      original,
      recipe,
      4096,
    );
    const displayAsset = await assetStore.saveRendered(
      displayImage,
      original,
      aggregate.record.id,
      'filtered',
    );
    createdAssets.push(displayAsset);
    const thumbnailImage = await imageRenderer.render(
      sourceUri,
      original,
      recipe,
      640,
    );
    const thumbnailAsset = await assetStore.saveRendered(
      thumbnailImage,
      original,
      aggregate.record.id,
      'thumbnail',
    );
    createdAssets.push(thumbnailAsset);
    const record = drinkRecordSchema.parse({
      ...aggregate.record,
      ...form,
      lifecycle: 'saved',
      displayAssetId: displayAsset.id,
      thumbnailAssetId: thumbnailAsset.id,
      editRecipeId: recipe.id,
      updatedAt: timestamp,
    });
    await repository.save(record, recipe, createdAssets);
    return record;
  } catch (error) {
    // Best-effort compensation: these files have not been committed to the
    // database, so removing them cannot affect the existing draft or original.
    await Promise.allSettled(
      createdAssets.map(asset => assetStore.remove(asset)),
    );
    throw error;
  }
};
