export const beverageCategories = [
  '咖啡',
  '奶茶',
  '茶',
  '抹茶',
  '气泡饮',
  '果汁',
  '酒饮',
  '其他',
] as const;

export type BeverageCategory = (typeof beverageCategories)[number];

export const sugarLevels = [
  '店铺标准',
  '无糖',
  '三分糖',
  '五分糖',
  '七分糖',
  '全糖',
] as const;

export type SugarLevel = (typeof sugarLevels)[number];

export const drinkTemperatures = [
  '热',
  '温',
  '常温',
  '去冰',
  '少冰',
  '正常冰',
  '多冰',
] as const;

export type DrinkTemperature = (typeof drinkTemperatures)[number];
export const filterPresetIds = [
  'cream-morning',
  'film-afternoon',
  'rainy-cafe',
  'cocoa-brown',
  'night-neon',
  'mono-notes',
] as const;
export type FilterPresetId = (typeof filterPresetIds)[number];
export type RecordLifecycle = 'draft' | 'saved';
export type PhotoAssetKind = 'original' | 'filtered' | 'thumbnail';

export interface DrinkRecordV1 {
  id: string;
  schemaVersion: 1;
  lifecycle: RecordLifecycle;
  occurredAt: string;
  beverageName?: string;
  category?: BeverageCategory;
  shopName?: string;
  sugarLevel?: SugarLevel;
  temperature?: DrinkTemperature;
  city?: string;
  mood?: string;
  note?: string;
  /**
   * The untouched drink photo when one was supplied. Text-only diary entries
   * deliberately leave this empty instead of manufacturing a fake image.
   */
  originalAssetId?: string;
  displayAssetId?: string;
  thumbnailAssetId?: string;
  editRecipeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoAssetV1 {
  id: string;
  schemaVersion: 1;
  recordId: string;
  kind: PhotoAssetKind;
  sourceAssetId?: string;
  relativePath: string;
  contentType: 'image/jpeg' | 'image/png' | 'image/heic' | 'image/heif';
  pixelWidth: number;
  pixelHeight: number;
  byteCount: number;
  sha256: string;
  createdAt: string;
}

export interface EditRecipeV1 {
  id: string;
  recordId: string;
  schemaVersion: 1;
  presetId: FilterPresetId;
  presetVersion: '1.0.0';
  intensity: number;
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  cropAspect: CropAspect;
  rotationDegrees: 0 | 90 | 180 | 270;
  straightenDegrees: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  renderer: 'skia';
  rendererVersion: 1;
  sourceAssetId: string;
  outputColorSpace: 'sRGB';
  outputFormat: 'jpeg';
  createdAt: string;
}

export interface ImportedPhoto {
  uri: string;
  contentType: string;
  fileName?: string;
  pixelWidth: number;
  pixelHeight: number;
  byteCount?: number;
}

export interface RecordAggregate {
  record: DrinkRecordV1;
  assets: PhotoAssetV1[];
  recipe?: EditRecipeV1;
  journalStickers?: JournalSticker[];
}

export interface RenderedImage {
  base64: string;
  contentType: 'image/jpeg';
  pixelWidth: number;
  pixelHeight: number;
}

export interface RecordFormValues {
  occurredAt: string;
  beverageName?: string;
  category?: BeverageCategory;
  shopName?: string;
  sugarLevel?: SugarLevel;
  temperature?: DrinkTemperature;
  city?: string;
  mood?: string;
  note?: string;
}

export type StudioTool = 'filter' | 'adjust' | 'crop' | 'sticker' | 'layout';
export type CropAspect = 'original' | '1:1' | '4:5' | '9:16';
export type ShareChannel = 'redbook' | 'moments';
export type AiJobStatus = 'queued' | 'processing' | 'succeeded' | 'failed';
export type JournalStickerCategory = 'outfit' | 'food';
export type JournalStickerCutoutStatus = 'ready' | 'source-only';
export type JournalStickerAssociationScope = 'record' | 'day';

export interface JournalSticker {
  id: string;
  recordId: string;
  category: JournalStickerCategory;
  label: string;
  sourceAssetId: string;
  cutoutAssetId?: string;
  cutoutStatus: JournalStickerCutoutStatus;
  associationScope: JournalStickerAssociationScope;
  associationDateKey?: string;
  positionX: number;
  positionY: number;
  scale: number;
  rotationDegrees: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreativeCanvasElementBase {
  /** Stable instance id. Catalog stickers can have many instances of the same sticker. */
  id: string;
  positionX: number;
  positionY: number;
  scale: number;
  rotationDegrees: number;
  zIndex: number;
  /** Hidden elements are retained as tombstones so a deleted photo/life sticker is not re-added on reload. */
  visible: boolean;
}

export interface CreativePhotoElement extends CreativeCanvasElementBase {
  kind: 'photo';
}

export interface CreativeCatalogStickerElement extends CreativeCanvasElementBase {
  kind: 'catalog-sticker';
  stickerId: string;
}

export interface CreativeJournalStickerElement extends CreativeCanvasElementBase {
  kind: 'journal-sticker';
  journalStickerId: string;
}

export type CreativeCanvasElement =
  | CreativePhotoElement
  | CreativeCatalogStickerElement
  | CreativeJournalStickerElement;

export interface CreativeProject {
  recordId: string;
  selectedTool: StudioTool;
  filterPresetId: FilterPresetId;
  filterIntensity: number;
  brightness: number;
  contrast: number;
  saturation: number;
  warmth: number;
  cropAspect: CropAspect;
  rotationDegrees: 0 | 90 | 180 | 270;
  straightenDegrees: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  stickerId: string;
  layoutId: string;
  photoPositionX: number;
  photoPositionY: number;
  photoScale: number;
  photoRotationDegrees: number;
  stickerPositionX: number;
  stickerPositionY: number;
  stickerScale: number;
  stickerRotationDegrees: number;
  /**
   * Undefined means an older project has not been upgraded yet. An empty/hidden
   * collection is intentional user state and must not be replaced with legacy defaults.
   */
  canvasElements?: CreativeCanvasElement[];
  updatedAt: string;
}

export interface ShareDraft {
  recordId: string;
  channel: ShareChannel;
  title: string;
  body: string;
  tags: string[];
  updatedAt: string;
}

export interface AiGenerationJob {
  id: string;
  recordId: string;
  styleId: string;
  status: AiJobStatus;
  remoteJobId?: string;
  inputAssetId?: string;
  outputAssetId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocalProfile {
  displayName: string;
  membershipTier: 'free' | 'monthly' | 'yearly';
  aiCredits: number;
  points: number;
  onboardingCompletedAt?: string;
  updatedAt: string;
}
