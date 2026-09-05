import { z } from 'zod';

import {
  beverageCategories,
  drinkTemperatures,
  filterPresetIds,
  type JournalStickerCategory,
  sugarLevels,
} from './models';

const uuid = z.string().uuid();
const isoDateTime = z.string().datetime({ offset: true });
const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform(value => value || undefined)
    .optional();

export const drinkRecordSchema = z
  .object({
    id: uuid,
    schemaVersion: z.literal(1),
    lifecycle: z.enum(['draft', 'saved']),
    occurredAt: isoDateTime,
    beverageName: optionalTrimmed(80),
    category: z.enum(beverageCategories).optional(),
    shopName: optionalTrimmed(120),
    sugarLevel: z.enum(sugarLevels).optional(),
    temperature: z.enum(drinkTemperatures).optional(),
    city: optionalTrimmed(80),
    mood: optionalTrimmed(32),
    note: optionalTrimmed(500),
    originalAssetId: uuid.optional(),
    displayAssetId: uuid.optional(),
    thumbnailAssetId: uuid.optional(),
    editRecipeId: uuid.optional(),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();

export const photoAssetSchema = z
  .object({
    id: uuid,
    schemaVersion: z.literal(1),
    recordId: uuid,
    kind: z.enum(['original', 'filtered', 'thumbnail']),
    sourceAssetId: uuid.optional(),
    relativePath: z
      .string()
      .min(1)
      .refine(path => !path.startsWith('/') && !path.includes('..'), {
        message: 'Asset path must remain inside the private root',
      }),
    contentType: z.enum([
      'image/jpeg',
      'image/png',
      'image/heic',
      'image/heif',
    ]),
    pixelWidth: z.number().int().positive(),
    pixelHeight: z.number().int().positive(),
    byteCount: z.number().int().positive(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    createdAt: isoDateTime,
  })
  .strict();

export const editRecipeSchema = z
  .object({
    id: uuid,
    recordId: uuid,
    schemaVersion: z.literal(1),
    presetId: z.enum(filterPresetIds),
    presetVersion: z.literal('1.0.0'),
    intensity: z.number().min(0).max(1),
    brightness: z.number().min(-1).max(1),
    contrast: z.number().min(-1).max(1),
    saturation: z.number().min(-1).max(1),
    warmth: z.number().min(-1).max(1),
    cropAspect: z.enum(['original', '1:1', '4:5', '9:16']),
    rotationDegrees: z.union([
      z.literal(0),
      z.literal(90),
      z.literal(180),
      z.literal(270),
    ]),
    straightenDegrees: z.number().min(-15).max(15),
    flipHorizontal: z.boolean(),
    flipVertical: z.boolean(),
    renderer: z.literal('skia'),
    rendererVersion: z.literal(1),
    sourceAssetId: uuid,
    outputColorSpace: z.literal('sRGB'),
    outputFormat: z.literal('jpeg'),
    createdAt: isoDateTime,
  })
  .strict();

export const importedPhotoSchema = z
  .object({
    uri: z.string().min(1),
    contentType: z.string().min(1),
    fileName: z.string().optional(),
    pixelWidth: z.number().int().positive(),
    pixelHeight: z.number().int().positive(),
    byteCount: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((photo, context) => {
    if (photo.pixelWidth * photo.pixelHeight > 48_000_000) {
      context.addIssue({
        code: 'custom',
        message: 'Photo exceeds the 48MP safety limit',
      });
    }
    if (photo.byteCount && photo.byteCount > 100 * 1024 * 1024) {
      context.addIssue({
        code: 'custom',
        message: 'Photo exceeds the 100MB safety limit',
      });
    }
  });

export const journalStickerSchema = z
  .object({
    id: uuid,
    recordId: uuid,
    category: z.enum(['outfit', 'food'] satisfies JournalStickerCategory[]),
    label: z.string().trim().min(1).max(40),
    sourceAssetId: uuid,
    cutoutAssetId: uuid.optional(),
    cutoutStatus: z.enum(['ready', 'source-only']),
    associationScope: z.enum(['record', 'day']),
    associationDateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    positionX: z.number().min(0).max(1),
    positionY: z.number().min(0).max(1),
    scale: z.number().min(0.35).max(2.5),
    rotationDegrees: z.number().min(-180).max(180),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .strict();
