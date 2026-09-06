import { remakeJournalSticker } from '../src/features/record-editor/remakeJournalSticker';
import type { JournalSticker, PhotoAssetV1 } from '../src/domain/models';

const source = { id: 'original', recordId: 'record' } as PhotoAssetV1;
const old = { id: 'old-cutout' } as PhotoAssetV1;
const fresh = { id: 'new-cutout', recordId: 'record' } as PhotoAssetV1;
const sticker = { id: 'sticker', recordId: 'record', label: '我的蛋糕', rotationDegrees: 12 } as JournalSticker;
const setup = () => ({
  assetStore: {
    saveOriginal: jest.fn(async () => fresh),
    resolveUri: jest.fn(() => 'file:///original.jpg'),
    remove: jest.fn(async () => undefined),
  } as never,
  subjectCutoutService: {
    isSupported: true,
    extractSubject: jest.fn(async () => ({ uri: 'file:///temporary.png', contentType: 'image/png' as const, pixelWidth: 600, pixelHeight: 800 })),
    releaseTemporary: jest.fn(async () => undefined),
  },
  creativeRepository: { replaceJournalStickerCutout: jest.fn(async () => old) } as never,
  now: () => new Date('2026-09-06T00:00:00Z'),
});

it('replaces only the generated asset, preserving the source and sticker identity', async () => {
  const deps = setup();
  await remakeJournalSticker(sticker, source, deps);
  expect(deps.creativeRepository).toEqual(expect.objectContaining({ replaceJournalStickerCutout: expect.any(Function) }));
  expect((deps.creativeRepository as { replaceJournalStickerCutout: jest.Mock }).replaceJournalStickerCutout)
    .toHaveBeenCalledWith('sticker', fresh, '2026-09-06T00:00:00.000Z');
  expect((deps.assetStore as { remove: jest.Mock }).remove).toHaveBeenCalledWith(old);
  expect((deps.assetStore as { remove: jest.Mock }).remove).not.toHaveBeenCalledWith(source);
  expect(deps.subjectCutoutService.releaseTemporary).toHaveBeenCalledWith('file:///temporary.png');
});

it('removes a new orphan on database failure, without deleting the old sticker or source', async () => {
  const deps = setup();
  (deps.creativeRepository as { replaceJournalStickerCutout: jest.Mock }).replaceJournalStickerCutout.mockRejectedValue(new Error('offline db'));
  await expect(remakeJournalSticker(sticker, source, deps)).rejects.toThrow('offline db');
  expect((deps.assetStore as { remove: jest.Mock }).remove).toHaveBeenCalledTimes(1);
  expect((deps.assetStore as { remove: jest.Mock }).remove).toHaveBeenCalledWith(fresh);
  expect(deps.subjectCutoutService.releaseTemporary).toHaveBeenCalled();
});

it('cleans temporary cutouts if copying fails', async () => {
  const deps = setup();
  (deps.assetStore as { saveOriginal: jest.Mock }).saveOriginal.mockRejectedValue(new Error('disk full'));
  await expect(remakeJournalSticker(sticker, source, deps)).rejects.toThrow('disk full');
  expect(deps.subjectCutoutService.releaseTemporary).toHaveBeenCalled();
  expect((deps.creativeRepository as { replaceJournalStickerCutout: jest.Mock }).replaceJournalStickerCutout).not.toHaveBeenCalled();
});
