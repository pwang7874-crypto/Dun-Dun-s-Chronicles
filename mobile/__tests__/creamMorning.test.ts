import {
  CREAM_MORNING_COLOR_MATRIX,
  IDENTITY_COLOR_MATRIX,
  colorMatrixForIntensity,
  makeCreamMorningRecipe,
} from '../src/infrastructure/rendering/creamMorning';

describe('奶油晨光 filter recipe', () => {
  it('returns the identity at zero and full preset at one', () => {
    expect(colorMatrixForIntensity(0)).toEqual([...IDENTITY_COLOR_MATRIX]);
    expect(colorMatrixForIntensity(1)).toEqual([...CREAM_MORNING_COLOR_MATRIX]);
  });

  it('clamps intensity for persistence', () => {
    const recipe = makeCreamMorningRecipe({
      id: '33333333-3333-4333-8333-333333333333',
      recordId: '11111111-1111-4111-8111-111111111111',
      sourceAssetId: '22222222-2222-4222-8222-222222222222',
      intensity: 1.8,
      createdAt: '2026-09-02T08:00:00.000Z',
    });
    expect(recipe.intensity).toBe(1);
  });
});
