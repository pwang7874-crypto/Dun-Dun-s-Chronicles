import { contentTypeFromSignature } from '../src/infrastructure/media/imageSignature';

const bytes = (...values: number[]): string => String.fromCharCode(...values);

describe('image file signatures', () => {
  it('recognizes JPEG and PNG by bytes rather than filename', () => {
    expect(contentTypeFromSignature(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(
      'image/jpeg',
    );
    expect(
      contentTypeFromSignature(
        bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
      ),
    ).toBe('image/png');
  });

  it('recognizes HEIC/HEIF brands and rejects disguised files', () => {
    expect(contentTypeFromSignature(`${bytes(0, 0, 0, 24)}ftypheic`)).toBe(
      'image/heic',
    );
    expect(contentTypeFromSignature(`${bytes(0, 0, 0, 24)}ftypmif1`)).toBe(
      'image/heif',
    );
    expect(() => contentTypeFromSignature('not an image')).toThrow(
      '真实格式暂时不支持',
    );
  });
});
