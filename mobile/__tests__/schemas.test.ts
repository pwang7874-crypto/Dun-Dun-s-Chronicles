import type { DrinkRecordV1, PhotoAssetV1 } from '../src/domain/models';
import {
  drinkRecordSchema,
  editRecipeSchema,
  importedPhotoSchema,
  photoAssetSchema,
} from '../src/domain/schemas';

const recordId = '11111111-1111-4111-8111-111111111111';
const originalId = '22222222-2222-4222-8222-222222222222';
const recipeId = '33333333-3333-4333-8333-333333333333';
const timestamp = '2026-09-02T08:00:00.000Z';

describe('domain schemas', () => {
  it('accepts an honest text-only record without a placeholder asset id', () => {
    const parsed = drinkRecordSchema.parse({
        id: recordId,
        schemaVersion: 1,
        lifecycle: 'saved',
        occurredAt: timestamp,
        note: '今天只留一句话',
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    expect(parsed.note).toBe('今天只留一句话');
    expect(parsed.originalAssetId).toBeUndefined();
  });

  it('normalizes optional record text without weakening required fields', () => {
    const record = drinkRecordSchema.parse({
      id: recordId,
      schemaVersion: 1,
      lifecycle: 'draft',
      occurredAt: timestamp,
      beverageName: '  桂花拿铁  ',
      shopName: '   ',
      sugarLevel: '五分糖',
      temperature: '少冰',
      originalAssetId: originalId,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    expect(record.beverageName).toBe('桂花拿铁');
    expect(record.shopName).toBeUndefined();
    expect(record.sugarLevel).toBe('五分糖');
    expect(record.temperature).toBe('少冰');
  });

  it('rejects unknown sugar and temperature choices', () => {
    expect(() =>
      drinkRecordSchema.parse({
        id: recordId,
        schemaVersion: 1,
        lifecycle: 'saved',
        occurredAt: timestamp,
        sugarLevel: '二分糖',
        temperature: '微冰',
        originalAssetId: originalId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ).toThrow();
  });

  it('accepts 正常冰 as a first-class ice choice', () => {
    const parsed = drinkRecordSchema.parse({
      id: recordId,
      schemaVersion: 1,
      lifecycle: 'saved',
      occurredAt: timestamp,
      temperature: '正常冰',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    expect(parsed.temperature).toBe('正常冰');
  });

  it('rejects unknown schema versions and unsafe asset paths', () => {
    expect(() =>
      drinkRecordSchema.parse({
        id: recordId,
        schemaVersion: 2,
        lifecycle: 'draft',
        occurredAt: timestamp,
        originalAssetId: originalId,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    ).toThrow();

    expect(() =>
      photoAssetSchema.parse({
        id: originalId,
        schemaVersion: 1,
        recordId,
        kind: 'original',
        relativePath: '../private/photo.jpg',
        contentType: 'image/jpeg',
        pixelWidth: 100,
        pixelHeight: 100,
        byteCount: 100,
        sha256: 'a'.repeat(64),
        createdAt: timestamp,
      }),
    ).toThrow();
  });

  it('enforces the photo safety limits', () => {
    expect(() =>
      importedPhotoSchema.parse({
        uri: 'file:///large.jpg',
        contentType: 'image/jpeg',
        pixelWidth: 9000,
        pixelHeight: 6000,
        byteCount: 2_000_000,
      }),
    ).toThrow('48MP');

    expect(() =>
      importedPhotoSchema.parse({
        uri: 'file:///large.jpg',
        contentType: 'image/jpeg',
        pixelWidth: 4000,
        pixelHeight: 3000,
        byteCount: 100 * 1024 * 1024 + 1,
      }),
    ).toThrow('100MB');
  });

  it('accepts photos exactly on both safety boundaries', () => {
    expect(
      importedPhotoSchema.parse({
        uri: 'file:///boundary.jpg',
        contentType: 'image/jpeg',
        pixelWidth: 8000,
        pixelHeight: 6000,
        byteCount: 100 * 1024 * 1024,
      }),
    ).toMatchObject({ pixelWidth: 8000, pixelHeight: 6000 });
  });

  it('accepts a complete V1 aggregate payload', () => {
    const asset: PhotoAssetV1 = {
      id: originalId,
      schemaVersion: 1,
      recordId,
      kind: 'original',
      relativePath: `media/originals/${recordId}/${originalId}.jpg`,
      contentType: 'image/jpeg',
      pixelWidth: 1200,
      pixelHeight: 1600,
      byteCount: 1000,
      sha256: 'a'.repeat(64),
      createdAt: timestamp,
    };
    const record: DrinkRecordV1 = {
      id: recordId,
      schemaVersion: 1,
      lifecycle: 'saved',
      occurredAt: timestamp,
      originalAssetId: originalId,
      editRecipeId: recipeId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    expect(photoAssetSchema.parse(asset)).toEqual(asset);
    expect(drinkRecordSchema.parse(record)).toEqual(record);
    expect(
      editRecipeSchema.parse({
        id: recipeId,
        recordId,
        schemaVersion: 1,
        presetId: 'cream-morning',
        presetVersion: '1.0.0',
        intensity: 0.7,
        brightness: 0,
        contrast: 0,
        saturation: 0,
        warmth: 0,
        cropAspect: 'original',
        rotationDegrees: 0,
        straightenDegrees: 0,
        flipHorizontal: false,
        flipVertical: false,
        renderer: 'skia',
        rendererVersion: 1,
        sourceAssetId: originalId,
        outputColorSpace: 'sRGB',
        outputFormat: 'jpeg',
        createdAt: timestamp,
      }).intensity,
    ).toBe(0.7);
  });
});
