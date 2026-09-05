import {
  DocumentDirectoryPath,
  FileProtectionKeys,
  LibraryDirectoryPath,
  copyFile,
  exists,
  hash,
  mkdir,
  moveFile,
  read,
  stat,
  unlink,
  writeFile,
} from '@dr.pogodin/react-native-fs';

import { AppError, toAppError } from '../../domain/errors';
import type {
  ImportedPhoto,
  PhotoAssetKind,
  PhotoAssetV1,
  RenderedImage,
} from '../../domain/models';
import type { LocalAssetStore } from '../../domain/ports';
import { importedPhotoSchema, photoAssetSchema } from '../../domain/schemas';
import { newId } from '../../shared/id';
import { contentTypeFromSignature } from './imageSignature';

const MAX_BYTES = 100 * 1024 * 1024;

const extensionFor = (contentType: string): string => {
  switch (contentType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    default:
      throw new AppError(
        'PHOTO_UNSUPPORTED',
        '暂时只支持 JPEG、PNG、HEIC 或 HEIF 静态照片。',
      );
  }
};

const sourcePath = (uri: string): string =>
  uri.startsWith('file://') ? decodeURI(uri.slice('file://'.length)) : uri;

const safeRelativePath = (path: string): string => {
  if (path.startsWith('/') || path.split('/').includes('..')) {
    throw new AppError('ASSET_MISSING', '照片路径无效，原图不会被修改。');
  }
  return path;
};

export class NativeAssetStore implements LocalAssetStore {
  private readonly root = `${
    LibraryDirectoryPath ?? DocumentDirectoryPath
  }/DrinkDiary`;

  private readonly protection =
    FileProtectionKeys?.FileProtectionCompleteUntilFirstUserAuthentication;

  async initialize(): Promise<void> {
    await mkdir(this.root, {
      NSURLIsExcludedFromBackupKey: true,
      NSFileProtectionKey: this.protection,
    });
  }

  async saveOriginal(
    rawPhoto: ImportedPhoto,
    recordId: string,
  ): Promise<PhotoAssetV1> {
    const photo = importedPhotoSchema.parse(rawPhoto);
    const id = newId();
    const partialRelativePath = `media/originals/${recordId}/${id}.partial`;
    const partialPath = this.absolutePath(partialRelativePath);
    let finalPath: string | undefined;

    try {
      await this.ensureParent(partialPath);
      await copyFile(sourcePath(photo.uri), partialPath, {
        NSFileProtectionKey: this.protection,
      });
      const fileStat = await stat(partialPath);
      if (fileStat.size <= 0 || fileStat.size > MAX_BYTES) {
        throw new AppError(
          'PHOTO_TOO_LARGE',
          '图片大小超出安全范围，请换一张。',
        );
      }
      const firstBytes = await read(partialPath, 32, 0, 'ascii');
      const contentType = contentTypeFromSignature(firstBytes);
      const extension = extensionFor(contentType);
      const relativePath = `media/originals/${recordId}/${id}.${extension}`;
      finalPath = this.absolutePath(relativePath);
      const checksum = await hash(partialPath, 'sha256');
      await moveFile(partialPath, finalPath, {
        NSFileProtectionKey: this.protection,
      });
      return photoAssetSchema.parse({
        id,
        schemaVersion: 1,
        recordId,
        kind: 'original',
        relativePath,
        contentType,
        pixelWidth: photo.pixelWidth,
        pixelHeight: photo.pixelHeight,
        byteCount: fileStat.size,
        sha256: checksum,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      await this.removeIfPresent(partialPath);
      if (finalPath) {
        await this.removeIfPresent(finalPath);
      }
      throw toAppError(
        error,
        'ASSET_WRITE_FAILED',
        '照片还没有保存成功，请再试一次。',
      );
    }
  }

  async saveRendered(
    image: RenderedImage,
    source: PhotoAssetV1,
    recordId: string,
    kind: Exclude<PhotoAssetKind, 'original'>,
  ): Promise<PhotoAssetV1> {
    const id = newId();
    const folder = kind === 'thumbnail' ? 'thumbnails' : 'rendered';
    const relativePath = `media/${folder}/${recordId}/${id}.jpg`;
    const finalPath = this.absolutePath(relativePath);
    const partialPath = `${finalPath}.partial`;

    try {
      await this.ensureParent(finalPath);
      await writeFile(partialPath, image.base64, {
        encoding: 'base64',
        NSFileProtectionKey: this.protection,
      });
      const fileStat = await stat(partialPath);
      const checksum = await hash(partialPath, 'sha256');
      await moveFile(partialPath, finalPath, {
        NSFileProtectionKey: this.protection,
      });
      return photoAssetSchema.parse({
        id,
        schemaVersion: 1,
        recordId,
        kind,
        sourceAssetId: source.id,
        relativePath,
        contentType: image.contentType,
        pixelWidth: image.pixelWidth,
        pixelHeight: image.pixelHeight,
        byteCount: fileStat.size,
        sha256: checksum,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      await this.removeIfPresent(partialPath);
      await this.removeIfPresent(finalPath);
      throw toAppError(
        error,
        'ASSET_WRITE_FAILED',
        '滤镜照片还没有保存成功，原图仍然保留。',
      );
    }
  }

  resolveUri(rawAsset: PhotoAssetV1): string {
    const asset = photoAssetSchema.parse(rawAsset);
    return `file://${this.absolutePath(asset.relativePath)}`;
  }

  async verify(rawAsset: PhotoAssetV1): Promise<void> {
    const asset = photoAssetSchema.parse(rawAsset);
    const path = this.absolutePath(asset.relativePath);
    if (!(await exists(path))) {
      throw new AppError('ASSET_MISSING', '这条记录的照片暂时找不到。');
    }
    const [fileStat, checksum] = await Promise.all([
      stat(path),
      hash(path, 'sha256'),
    ]);
    if (fileStat.size !== asset.byteCount || checksum !== asset.sha256) {
      throw new AppError('ASSET_MISSING', '照片完整性校验没有通过。');
    }
  }

  async remove(rawAsset: PhotoAssetV1): Promise<void> {
    const asset = photoAssetSchema.parse(rawAsset);
    const path = this.absolutePath(asset.relativePath);
    if (await exists(path)) {
      await unlink(path);
    }
  }

  private absolutePath(relativePath: string): string {
    return `${this.root}/${safeRelativePath(relativePath)}`;
  }

  private async ensureParent(path: string): Promise<void> {
    const parent = path.slice(0, path.lastIndexOf('/'));
    await mkdir(parent, {
      NSURLIsExcludedFromBackupKey: true,
      NSFileProtectionKey: this.protection,
    });
  }

  private async removeIfPresent(path: string): Promise<void> {
    try {
      if (await exists(path)) {
        await unlink(path);
      }
    } catch {
      // Cleanup is best-effort. The startup orphan scan can remove leftovers.
    }
  }
}
