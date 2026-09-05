import { filterPresetIds } from '../src/domain/models';
import {
  IDENTITY_COLOR_MATRIX,
  colorMatrixForPreset,
  colorMatrixForRecipe,
  filterCatalog,
  makeFilterRecipe,
} from '../src/infrastructure/rendering/filters';

describe('free filter catalog', () => {
  it('ships exactly six unique, versioned presets', () => {
    expect(filterCatalog).toHaveLength(6);
    expect(new Set(filterCatalog.map(item => item.id)).size).toBe(6);
    expect(filterCatalog.map(item => item.id)).toEqual([...filterPresetIds]);
    expect(filterCatalog.every(item => item.matrix.length === 20)).toBe(true);
  });

  it.each(filterPresetIds)('%s blends from identity to its full matrix', id => {
    expect(colorMatrixForPreset(id, 0)).toEqual([...IDENTITY_COLOR_MATRIX]);
    expect(colorMatrixForPreset(id, 1)).toEqual(
      filterCatalog.find(item => item.id === id)?.matrix,
    );
  });

  it('uses Skia-normalized channel offsets so exports do not clip to white', () => {
    const offsetIndexes = [4, 9, 14, 19];
    for (const preset of filterCatalog) {
      expect(
        offsetIndexes.every(index => {
          const offset = preset.matrix[index];
          return (
            offset !== undefined &&
            Number.isFinite(offset) &&
            Math.abs(offset) <= 1
          );
        }),
      ).toBe(true);
    }
  });

  it('persists the selected preset and clamps intensity', () => {
    const recipe = makeFilterRecipe({
      id: '33333333-3333-4333-8333-333333333333',
      recordId: '11111111-1111-4111-8111-111111111111',
      sourceAssetId: '22222222-2222-4222-8222-222222222222',
      presetId: 'night-neon',
      intensity: -2,
      createdAt: '2026-09-03T08:00:00.000Z',
    });
    expect(recipe.presetId).toBe('night-neon');
    expect(recipe.intensity).toBe(0);
    expect(recipe.rotationDegrees).toBe(0);
    expect(recipe.straightenDegrees).toBe(0);
    expect(recipe.cropAspect).toBe('original');
  });

  it('combines free manual adjustments into a finite color matrix', () => {
    const matrix = colorMatrixForRecipe({
      presetId: 'rainy-cafe',
      intensity: 0.6,
      brightness: 0.2,
      contrast: -0.1,
      saturation: 0.35,
      warmth: -0.25,
    });
    expect(matrix).toHaveLength(20);
    expect(matrix.every(Number.isFinite)).toBe(true);
    expect(matrix).not.toEqual(colorMatrixForPreset('rainy-cafe', 0.6));
  });

  it.each([
    ['brightness', { brightness: 0.7 }],
    ['contrast', { contrast: 0.7 }],
    ['saturation', { saturation: -0.7 }],
    ['warmth', { warmth: 0.7 }],
  ] as const)('%s changes the rendered color matrix on its own', (_name, patch) => {
    const base = {
      presetId: 'cream-morning' as const,
      intensity: 0.75,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      warmth: 0,
    };
    expect(colorMatrixForRecipe({ ...base, ...patch })).not.toEqual(
      colorMatrixForRecipe(base),
    );
  });
});
