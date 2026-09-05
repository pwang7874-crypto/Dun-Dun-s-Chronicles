import {
  IDENTITY_COLOR_MATRIX,
  colorMatrixForPreset,
  getFilterPreset,
  makeFilterRecipe,
} from './filters';

export { IDENTITY_COLOR_MATRIX };
export const CREAM_MORNING_COLOR_MATRIX =
  getFilterPreset('cream-morning').matrix;
export const colorMatrixForIntensity = (intensity: number): number[] =>
  colorMatrixForPreset('cream-morning', intensity);
export const makeCreamMorningRecipe = (
  params: Omit<Parameters<typeof makeFilterRecipe>[0], 'presetId'>,
) => makeFilterRecipe({ ...params, presetId: 'cream-morning' });
