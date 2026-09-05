import { AppError } from '../../domain/errors';
import type { PhotoAssetV1 } from '../../domain/models';

type SupportedContentType = PhotoAssetV1['contentType'];

const bytesEqual = (value: string, expected: number[]): boolean =>
  expected.every((byte, index) => value.charCodeAt(index) === byte);

export const contentTypeFromSignature = (
  firstBytes: string,
): SupportedContentType => {
  if (bytesEqual(firstBytes, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
  }
  if (
    bytesEqual(firstBytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return 'image/png';
  }
  if (firstBytes.slice(4, 8) === 'ftyp') {
    const brands = firstBytes.slice(8, 32);
    if (/(heic|heix|hevc|hevx)/.test(brands)) {
      return 'image/heic';
    }
    if (/(mif1|msf1)/.test(brands)) {
      return 'image/heif';
    }
  }
  throw new AppError(
    'PHOTO_UNSUPPORTED',
    '这张图片的真实格式暂时不支持，请选择 JPEG、PNG、HEIC 或 HEIF。',
  );
};
