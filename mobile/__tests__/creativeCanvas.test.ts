import type { CreativeProject, JournalSticker } from '../src/domain/models';
import {
  createCatalogCanvasElement,
  hydrateCreativeCanvasElements,
  parseCreativeCanvasElements,
  removeCanvasElement,
} from '../src/domain/creativeCanvas';

const project = (patch: Partial<CreativeProject> = {}): CreativeProject => ({
  recordId: 'record-1',
  selectedTool: 'sticker',
  filterPresetId: 'cream-morning',
  filterIntensity: 0.75,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  cropAspect: 'original',
  rotationDegrees: 0,
  straightenDegrees: 0,
  flipHorizontal: false,
  flipVertical: false,
  stickerId: 'heart',
  layoutId: 'plain',
  photoPositionX: 0.1,
  photoPositionY: -0.1,
  photoScale: 1.2,
  photoRotationDegrees: 4,
  stickerPositionX: 0.2,
  stickerPositionY: 0.3,
  stickerScale: 1.4,
  stickerRotationDegrees: -8,
  updatedAt: '2026-09-04T00:00:00.000Z',
  ...patch,
});

const journalSticker = (id = 'life-1'): JournalSticker => ({
  id,
  recordId: 'record-1',
  category: 'food',
  label: '今日美食',
  sourceAssetId: 'asset-1',
  cutoutAssetId: 'asset-2',
  cutoutStatus: 'ready',
  associationScope: 'record',
  positionX: 0.5,
  positionY: 0.4,
  scale: 1.3,
  rotationDegrees: 12,
  createdAt: '2026-09-04T00:00:00.000Z',
  updatedAt: '2026-09-04T00:00:00.000Z',
});

describe('creative canvas elements', () => {
  it('hydrates legacy photo, single catalog sticker and journal stickers', () => {
    const hydrated = hydrateCreativeCanvasElements(project(), [journalSticker()]);

    expect(hydrated.map(item => item.kind)).toEqual([
      'photo',
      'catalog-sticker',
      'journal-sticker',
    ]);
    expect(hydrated[0]).toMatchObject({ positionX: 0.1, scale: 1.2 });
    expect(hydrated[1]).toMatchObject({ stickerId: 'heart', scale: 1.4 });
  });

  it('keeps hidden journal tombstones hidden when rehydrating', () => {
    const initial = hydrateCreativeCanvasElements(project(), [journalSticker()]);
    const hidden = removeCanvasElement(initial, 'journal-life-1');
    const restored = hydrateCreativeCanvasElements(project({ canvasElements: hidden }), [journalSticker()]);

    expect(restored.filter(item => item.kind === 'journal-sticker')).toHaveLength(1);
    expect(restored.find(item => item.id === 'journal-life-1')).toMatchObject({ visible: false });
  });

  it('drops a stale journal element after its source photo is removed', () => {
    const initial = hydrateCreativeCanvasElements(project(), [journalSticker()]);
    const refreshed = hydrateCreativeCanvasElements(project({ canvasElements: initial }), []);

    expect(refreshed.some(item => item.kind === 'journal-sticker')).toBe(false);
  });

  it('creates independent instances and removes only the selected catalog instance', () => {
    const base = hydrateCreativeCanvasElements(project({ stickerId: 'none' }), []);
    const first = createCatalogCanvasElement('a', 'star', base);
    const second = createCatalogCanvasElement('b', 'star', [...base, first]);
    const remaining = removeCanvasElement([...base, first, second], first.id);

    expect(first.id).not.toBe(second.id);
    expect(remaining.some(item => item.id === first.id)).toBe(false);
    expect(remaining.some(item => item.id === second.id)).toBe(true);
  });

  it('rejects malformed persisted JSON instead of crashing the editor', () => {
    expect(parseCreativeCanvasElements('{oops')).toBeUndefined();
    expect(parseCreativeCanvasElements('[{"kind":"photo"}]')).toBeUndefined();
  });
});
