jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));

import { responseToPhoto } from '../src/infrastructure/media/NativePhotoImporter';

describe('native photo response adapter bad cases', () => {
  it('treats picker cancellation as a neutral result', () => {
    expect(responseToPhoto({ didCancel: true })).toBeNull();
  });

  it.each([
    [
      'camera_unavailable' as const,
      'CAMERA_UNAVAILABLE',
      '当前设备无法使用相机，可以改从相册选择。',
    ],
    [
      'permission' as const,
      'CAMERA_PERMISSION_DENIED',
      '需要相机权限才能拍照，也可以直接从相册选择。',
    ],
  ])('maps %s without leaking the native error', (errorCode, code, message) => {
    expect(() => responseToPhoto({ errorCode })).toThrow(
      expect.objectContaining({ code, userMessage: message }),
    );
  });

  it('rejects incomplete picker assets', () => {
    expect(() =>
      responseToPhoto({ assets: [{ uri: 'file:///photo.jpg', width: 1200 }] }),
    ).toThrow(
      expect.objectContaining({
        code: 'PHOTO_UNSUPPORTED',
        userMessage: '这张照片缺少必要信息，请换一张。',
      }),
    );
  });

  it('normalizes image/jpg and accepts a safe image', () => {
    expect(
      responseToPhoto({
        assets: [
          {
            uri: 'file:///photo.jpg',
            width: 1200,
            height: 1600,
            type: 'image/jpg',
            fileSize: 1024,
          },
        ],
      }),
    ).toMatchObject({ contentType: 'image/jpeg', pixelWidth: 1200 });
  });

  it.each([
    [{ width: 8001, height: 6000, fileSize: 2_000_000 }, '48MP'],
    [
      { width: 1200, height: 1600, fileSize: 100 * 1024 * 1024 + 1 },
      '100MB',
    ],
  ])('rejects an unsafe image before file import', (unsafe, causeText) => {
    try {
      responseToPhoto({
        assets: [
          {
            uri: 'file:///unsafe.jpg',
            type: 'image/jpeg',
            ...unsafe,
          },
        ],
      });
      throw new Error('Expected the unsafe image to be rejected');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'PHOTO_TOO_LARGE',
        userMessage: '图片尺寸过大，当前设备无法安全处理，请换一张。',
      });
      expect((error as { cause?: Error }).cause?.message).toContain(causeText);
    }
  });
});
