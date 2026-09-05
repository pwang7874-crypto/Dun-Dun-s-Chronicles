import { addJournalStickerFromLibrary } from '../src/features/record-editor/addJournalSticker';

const source = {
  id: '10000000-0000-4000-8000-000000000001',
  schemaVersion: 1 as const,
  recordId: '20000000-0000-4000-8000-000000000001',
  kind: 'original' as const,
  relativePath: 'media/originals/source.png',
  contentType: 'image/png' as const,
  pixelWidth: 800,
  pixelHeight: 1000,
  byteCount: 123,
  sha256: 'a'.repeat(64),
  createdAt: '2026-09-03T08:00:00.000Z',
};

describe('addJournalStickerFromLibrary', () => {
  it('allows repeated uploads in the same category', async () => {
    const addJournalSticker = jest.fn();
    let assetNumber = 1;
    let stickerNumber = 1;
    const dependencies = {
      photoImporter: {
        importPhoto: jest.fn(async () => ({
          uri: 'file://portrait.png',
          contentType: 'image/png',
          pixelWidth: 800,
          pixelHeight: 1000,
        })),
      },
      assetStore: {
        initialize: jest.fn(),
        saveOriginal: jest.fn(async () => ({
          ...source,
          id: `10000000-0000-4000-8000-${String(assetNumber++).padStart(12, '0')}`,
        })),
        saveRendered: jest.fn(),
        resolveUri: jest.fn(() => 'file://private/portrait.png'),
        verify: jest.fn(),
        remove: jest.fn(),
      },
      subjectCutoutService: { isSupported: false, extractSubject: jest.fn() },
      creativeRepository: { addJournalSticker } as never,
      now: () => new Date('2026-09-03T08:00:00.000Z'),
      createId: () => `30000000-0000-4000-8000-${String(stickerNumber++).padStart(12, '0')}`,
    };

    const first = await addJournalStickerFromLibrary(source.recordId, 'outfit', dependencies);
    const second = await addJournalStickerFromLibrary(source.recordId, 'outfit', dependencies);

    expect(first?.sticker.id).not.toBe(second?.sticker.id);
    expect(addJournalSticker).toHaveBeenCalledTimes(2);
    expect(addJournalSticker.mock.calls.every(call => call[0].category === 'outfit')).toBe(true);
  });

  it('persists an on-device transparent cutout without replacing the source', async () => {
    const cutout = { ...source, id: '10000000-0000-4000-8000-000000000002' };
    const addJournalSticker = jest.fn();
    const result = await addJournalStickerFromLibrary(source.recordId, 'outfit', {
      photoImporter: { importPhoto: jest.fn(async () => ({ uri: 'file://source.png', contentType: 'image/png', pixelWidth: 800, pixelHeight: 1000 })) },
      assetStore: {
        initialize: jest.fn(),
        saveOriginal: jest.fn().mockResolvedValueOnce(source).mockResolvedValueOnce(cutout),
        saveRendered: jest.fn(),
        resolveUri: jest.fn(() => 'file://private/source.png'),
        verify: jest.fn(),
        remove: jest.fn(),
      },
      subjectCutoutService: {
        isSupported: true,
        extractSubject: jest.fn(async () => ({ uri: 'file://cutout.png', contentType: 'image/png', pixelWidth: 500, pixelHeight: 900 })),
      },
      creativeRepository: { addJournalSticker } as never,
      now: () => new Date('2026-09-03T08:00:00.000Z'),
      createId: () => '30000000-0000-4000-8000-000000000001',
    });

    expect(result?.autoCutout).toBe(true);
    expect(result?.sticker.cutoutAssetId).toBe(cutout.id);
    expect(addJournalSticker).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'outfit', cutoutStatus: 'ready' }),
      [source, cutout],
    );
  });

  it('keeps the upload as an explicitly framed photo card when cutout is unavailable', async () => {
    const addJournalSticker = jest.fn();
    const remove = jest.fn();
    const result = await addJournalStickerFromLibrary(source.recordId, 'food', {
      photoImporter: { importPhoto: jest.fn(async () => ({ uri: 'file://food.png', contentType: 'image/png', pixelWidth: 800, pixelHeight: 1000 })) },
      assetStore: {
        initialize: jest.fn(),
        saveOriginal: jest.fn(async () => source),
        saveRendered: jest.fn(),
        resolveUri: jest.fn(() => 'file://private/food.png'),
        verify: jest.fn(),
        remove,
      },
      subjectCutoutService: { isSupported: false, extractSubject: jest.fn() },
      creativeRepository: { addJournalSticker } as never,
      now: () => new Date('2026-09-03T08:00:00.000Z'),
      createId: () => '30000000-0000-4000-8000-000000000001',
    });

    expect(result).toMatchObject({
      autoCutout: false,
      sticker: { cutoutStatus: 'source-only', cutoutAssetId: undefined },
    });
    expect(addJournalSticker).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'food', cutoutStatus: 'source-only' }),
      [source],
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it('keeps the upload as a photo card when extraction finds no usable subject', async () => {
    const addJournalSticker = jest.fn();
    const remove = jest.fn();
    const result = await addJournalStickerFromLibrary(source.recordId, 'outfit', {
      photoImporter: { importPhoto: jest.fn(async () => ({ uri: 'file://busy-background.png', contentType: 'image/png', pixelWidth: 800, pixelHeight: 1000 })) },
      assetStore: {
        initialize: jest.fn(),
        saveOriginal: jest.fn(async () => source),
        saveRendered: jest.fn(),
        resolveUri: jest.fn(() => 'file://private/busy-background.png'),
        verify: jest.fn(),
        remove,
      },
      subjectCutoutService: {
        isSupported: true,
        extractSubject: jest.fn(async () => { throw new Error('no subject'); }),
      },
      creativeRepository: { addJournalSticker } as never,
      now: () => new Date('2026-09-03T08:00:00.000Z'),
      createId: () => '30000000-0000-4000-8000-000000000001',
    });

    expect(result?.autoCutout).toBe(false);
    expect(result?.sticker.cutoutStatus).toBe('source-only');
    expect(addJournalSticker).toHaveBeenCalledWith(
      expect.objectContaining({ cutoutStatus: 'source-only' }),
      [source],
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it('removes orphaned files when persistence fails', async () => {
    const cutout = { ...source, id: '10000000-0000-4000-8000-000000000002' };
    const remove = jest.fn();
    const action = addJournalStickerFromLibrary(source.recordId, 'food', {
      photoImporter: { importPhoto: jest.fn(async () => ({ uri: 'file://food.png', contentType: 'image/png', pixelWidth: 800, pixelHeight: 1000 })) },
      assetStore: {
        initialize: jest.fn(),
        saveOriginal: jest.fn().mockResolvedValueOnce(source).mockResolvedValueOnce(cutout),
        saveRendered: jest.fn(),
        resolveUri: jest.fn(() => 'file://private/food.png'),
        verify: jest.fn(),
        remove,
      },
      subjectCutoutService: {
        isSupported: true,
        extractSubject: jest.fn(async () => ({ uri: 'file://cutout.png', contentType: 'image/png', pixelWidth: 500, pixelHeight: 900 })),
      },
      creativeRepository: {
        addJournalSticker: jest.fn(async () => { throw new Error('database unavailable'); }),
      } as never,
      now: () => new Date('2026-09-03T08:00:00.000Z'),
      createId: () => '30000000-0000-4000-8000-000000000001',
    });

    await expect(action).rejects.toThrow('database unavailable');
    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledWith(source);
    expect(remove).toHaveBeenCalledWith(cutout);
  });
});
