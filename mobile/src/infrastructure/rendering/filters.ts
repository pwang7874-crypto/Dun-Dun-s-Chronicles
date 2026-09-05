import type { EditRecipeV1, FilterPresetId } from '../../domain/models';
import filterCatalogData from '../../assets/filters/filter-presets-v1.json';

export const IDENTITY_COLOR_MATRIX = [
  1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
] as const;

export interface FilterPreset {
  id: FilterPresetId;
  version: '1.0.0';
  name: string;
  description: string;
  matrix: number[];
}

const isMatrix = (value: number[]): boolean =>
  value.length === 20 && value.every(Number.isFinite);

export const filterCatalog: FilterPreset[] = filterCatalogData.presets.map(
  preset => {
    if (!isMatrix(preset.matrix)) {
      throw new Error(`Filter preset ${preset.id} has an invalid matrix`);
    }
    return preset as FilterPreset;
  },
);

export const getFilterPreset = (id: FilterPresetId): FilterPreset => {
  const preset = filterCatalog.find(item => item.id === id);
  if (!preset) {
    throw new Error(`Unknown filter preset ${id}`);
  }
  return preset;
};

export const colorMatrixForPreset = (
  presetId: FilterPresetId,
  intensity: number,
): number[] => {
  const amount = Math.max(0, Math.min(1, intensity));
  const matrix = getFilterPreset(presetId).matrix;
  if (amount === 0) {
    return [...IDENTITY_COLOR_MATRIX];
  }
  if (amount === 1) {
    return [...matrix];
  }
  return IDENTITY_COLOR_MATRIX.map(
    (identity, index) => identity + (matrix[index]! - identity) * amount,
  );
};

const multiplyColorMatrices = (after: number[], before: number[]): number[] => {
  const out = Array<number>(20).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 5; column += 1) {
      if (column === 4) {
        out[row * 5 + column] = after[row * 5 + 4]!;
      }
      for (let index = 0; index < 4; index += 1) {
        const beforeValue = column === 4
          ? before[index * 5 + 4]!
          : before[index * 5 + column]!;
        out[row * 5 + column]! += after[row * 5 + index]! * beforeValue;
      }
    }
  }
  return out;
};

const clampUnit = (value: number): number => Math.max(-1, Math.min(1, value));

export const colorMatrixForRecipe = (recipe: Pick<EditRecipeV1,
  'presetId' | 'intensity' | 'brightness' | 'contrast' | 'saturation' | 'warmth'>): number[] => {
  const brightness = clampUnit(recipe.brightness);
  const contrast = 1 + clampUnit(recipe.contrast) * 0.75;
  const saturation = 1 + clampUnit(recipe.saturation);
  const warmth = clampUnit(recipe.warmth);
  const inverseSaturation = 1 - saturation;
  const rw = 0.2126 * inverseSaturation;
  const gw = 0.7152 * inverseSaturation;
  const bw = 0.0722 * inverseSaturation;
  const adjustment = [
    rw + saturation, gw, bw, 0, brightness * 0.18 + warmth * 0.08,
    rw, gw + saturation, bw, 0, brightness * 0.18,
    rw, gw, bw + saturation, 0, brightness * 0.18 - warmth * 0.08,
    0, 0, 0, 1, 0,
  ];
  const contrastMatrix = [
    contrast, 0, 0, 0, (1 - contrast) * 0.5,
    0, contrast, 0, 0, (1 - contrast) * 0.5,
    0, 0, contrast, 0, (1 - contrast) * 0.5,
    0, 0, 0, 1, 0,
  ];
  return multiplyColorMatrices(
    contrastMatrix,
    multiplyColorMatrices(adjustment, colorMatrixForPreset(recipe.presetId, recipe.intensity)),
  );
};

export const makeFilterRecipe = (params: {
  id: string;
  recordId: string;
  sourceAssetId: string;
  presetId: FilterPresetId;
  intensity: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  warmth?: number;
  cropAspect?: EditRecipeV1['cropAspect'];
  rotationDegrees?: EditRecipeV1['rotationDegrees'];
  straightenDegrees?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  createdAt: string;
}): EditRecipeV1 => ({
  id: params.id,
  recordId: params.recordId,
  schemaVersion: 1,
  presetId: params.presetId,
  presetVersion: '1.0.0',
  intensity: Math.max(0, Math.min(1, params.intensity)),
  brightness: clampUnit(params.brightness ?? 0),
  contrast: clampUnit(params.contrast ?? 0),
  saturation: clampUnit(params.saturation ?? 0),
  warmth: clampUnit(params.warmth ?? 0),
  cropAspect: params.cropAspect ?? 'original',
  rotationDegrees: params.rotationDegrees ?? 0,
  straightenDegrees: Math.max(-15, Math.min(15, params.straightenDegrees ?? 0)),
  flipHorizontal: params.flipHorizontal ?? false,
  flipVertical: params.flipVertical ?? false,
  renderer: 'skia',
  rendererVersion: 1,
  sourceAssetId: params.sourceAssetId,
  outputColorSpace: 'sRGB',
  outputFormat: 'jpeg',
  createdAt: params.createdAt,
});
