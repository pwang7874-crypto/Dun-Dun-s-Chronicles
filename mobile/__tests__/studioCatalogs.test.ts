import { journalLayouts } from '../src/features/create-studio/layoutCatalog';
import { cuteStickers, stickerSymbol } from '../src/features/create-studio/stickerCatalog';

describe('creative studio catalogs', () => {
  it('ships a varied cute sticker collection with stable identifiers', () => {
    expect(cuteStickers).toHaveLength(18);
    expect(new Set(cuteStickers.map(item => item.id)).size).toBe(cuteStickers.length);
    expect(stickerSymbol('bear')).toBe('🧸');
  });

  it('ships twelve visually distinct journal layouts', () => {
    expect(journalLayouts).toHaveLength(12);
    expect(new Set(journalLayouts.map(item => item.id)).size).toBe(journalLayouts.length);
    expect(new Set(journalLayouts.map(item => item.paper)).size).toBeGreaterThan(7);
  });
});

