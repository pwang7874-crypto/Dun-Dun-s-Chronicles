import type {
  AiArtService,
  CreativeRepository,
  DrinkRecordRepository,
  ImageRenderer,
  LocalAssetStore,
  PhotoImporter,
  SubjectCutoutService,
} from '../domain/ports';
import { runtimeConfig } from '../config/runtime';
import type { AuthService } from '../domain/auth';
import { KeychainTokenStore } from '../infrastructure/auth/KeychainTokenStore';
import { NativeAssetStore } from '../infrastructure/media/NativeAssetStore';
import { NativePhotoImporter } from '../infrastructure/media/NativePhotoImporter';
import { DeviceSubjectCutoutService } from '../infrastructure/media/DeviceSubjectCutoutService';
import { HttpAiArtService } from '../infrastructure/network/HttpAiArtService';
import { HttpAuthService } from '../infrastructure/network/HttpAuthService';
import { createSQLiteRepository } from '../infrastructure/persistence/sqlite/SQLiteDrinkRecordRepository';
import { SkiaImageRenderer } from '../infrastructure/rendering/SkiaImageRenderer';

export interface AppServices {
  repository: DrinkRecordRepository;
  creativeRepository: CreativeRepository;
  aiArtService: AiArtService;
  authService: AuthService;
  assetStore: LocalAssetStore;
  photoImporter: PhotoImporter;
  imageRenderer: ImageRenderer;
  subjectCutoutService: SubjectCutoutService;
  now: () => Date;
}

export const createAppServices = async (): Promise<AppServices> => {
  const repository = createSQLiteRepository();
  const assetStore = new NativeAssetStore();
  await assetStore.initialize();
  await repository.initialize();
  const authService = new HttpAuthService(runtimeConfig.apiBaseUrl, new KeychainTokenStore());
  return {
    repository,
    creativeRepository: repository,
    authService,
    aiArtService: new HttpAiArtService(runtimeConfig.apiBaseUrl, () => authService.getAccessToken()),
    assetStore,
    photoImporter: new NativePhotoImporter(),
    imageRenderer: new SkiaImageRenderer(),
    subjectCutoutService: new DeviceSubjectCutoutService(),
    now: () => new Date(),
  };
};
