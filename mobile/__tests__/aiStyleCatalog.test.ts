import { aiStyleCategories, aiStyles } from '../src/features/create-studio/aiStyleCatalog';

describe('AI art style catalog', () => {
  it('offers twelve unique server-safe style ids in compact categories', () => {
    expect(aiStyles).toHaveLength(12);
    expect(new Set(aiStyles.map(style => style.id)).size).toBe(12);
    expect(aiStyleCategories).toEqual(['全部', '手帐', '插画', '影像']);
    expect(aiStyles.every(style => style.name && style.note && style.category)).toBe(true);
  });
});
