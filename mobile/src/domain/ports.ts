import type {
  AiGenerationJob,
  CreativeProject,
  DrinkRecordV1,
  EditRecipeV1,
  ImportedPhoto,
  JournalSticker,
  LocalProfile,
  PhotoAssetKind,
  PhotoAssetV1,
  RecordAggregate,
  RenderedImage,
  ShareDraft,
} from './models';

export type PhotoSource = 'camera' | 'library';

export interface AiEntitlement {
  membershipTier: 'free' | 'member';
  aiRemainingToday: number;
  entitlementKind: 'invite' | 'daily' | 'none';
  inviteCreditsRemaining: number;
}

export interface InviteRedeemResult {
  creditsGranted: number;
  inviteCreditsRemaining: number;
}

export interface PhotoImporter {
  importPhoto(source: PhotoSource): Promise<ImportedPhoto | null>;
}

export interface SubjectCutoutService {
  readonly isSupported: boolean;
  extractSubject(imageUri: string): Promise<ImportedPhoto>;
  releaseTemporary?(uri: string): Promise<void>;
}

export interface LocalAssetStore {
  initialize(): Promise<void>;
  saveOriginal(photo: ImportedPhoto, recordId: string): Promise<PhotoAssetV1>;
  saveRendered(
    image: RenderedImage,
    source: PhotoAssetV1,
    recordId: string,
    kind: Exclude<PhotoAssetKind, 'original'>,
  ): Promise<PhotoAssetV1>;
  resolveUri(asset: PhotoAssetV1): string;
  verify(asset: PhotoAssetV1): Promise<void>;
  remove(asset: PhotoAssetV1): Promise<void>;
}

export interface ImageRenderer {
  render(
    sourceUri: string,
    source: PhotoAssetV1,
    recipe: EditRecipeV1,
    maxEdge: number,
  ): Promise<RenderedImage>;
}

export interface DrinkRecordRepository {
  initialize(): Promise<void>;
  createDraft(record: DrinkRecordV1, original?: PhotoAssetV1): Promise<void>;
  save(
    record: DrinkRecordV1,
    recipe: EditRecipeV1 | undefined,
    newAssets: PhotoAssetV1[],
  ): Promise<void>;
  findById(id: string): Promise<RecordAggregate | null>;
  findSavedInRange(
    startISO: string,
    endISO: string,
  ): Promise<RecordAggregate[]>;
  findLatestDraft(): Promise<RecordAggregate | null>;
}

export interface CreativeRepository {
  getProject(recordId: string): Promise<CreativeProject | null>;
  saveProject(project: CreativeProject): Promise<void>;
  getShareDraft(recordId: string, channel: ShareDraft['channel']): Promise<ShareDraft | null>;
  saveShareDraft(draft: ShareDraft): Promise<void>;
  createAiJob(job: AiGenerationJob, inputAsset?: PhotoAssetV1): Promise<void>;
  updateAiJob(job: AiGenerationJob): Promise<void>;
  completeAiJob(job: AiGenerationJob, outputAsset: PhotoAssetV1): Promise<void>;
  selectStudioPhoto(recordId: string, assetId: string, updatedAt: string): Promise<void>;
  listAiJobs(recordId: string): Promise<AiGenerationJob[]>;
  getProfile(): Promise<LocalProfile>;
  saveProfile(profile: LocalProfile): Promise<void>;
  listFavoriteIds(): Promise<string[]>;
  setFavorite(recordId: string, favorite: boolean, updatedAt: string): Promise<void>;
  addJournalSticker(sticker: JournalSticker, assets: PhotoAssetV1[]): Promise<void>;
  updateJournalSticker(sticker: JournalSticker): Promise<void>;
  replaceJournalStickerCutout(stickerId: string, asset: PhotoAssetV1, updatedAt: string): Promise<PhotoAssetV1 | undefined>;
  deleteJournalSticker(stickerId: string): Promise<PhotoAssetV1[]>;
  deleteAllUserData(): Promise<PhotoAssetV1[]>;
}

export interface RemoteAiGeneration {
  remoteJobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  errorCode?: string;
  errorMessage?: string;
}

export interface AiArtService {
  readonly isConfigured: boolean;
  createGeneration(input: {
    jobId: string;
    recordId: string;
    styleId: string;
    imageUri: string;
    contentType?: 'image/jpeg' | 'image/png';
  }): Promise<RemoteAiGeneration>;
  getGeneration(remoteJobId: string): Promise<RemoteAiGeneration>;
  downloadGeneration(remoteJobId: string): Promise<ImportedPhoto>;
  releaseDownload?(uri: string): Promise<void>;
  getEntitlement(): Promise<AiEntitlement>;
  redeemInvite(code: string): Promise<InviteRedeemResult>;
}
