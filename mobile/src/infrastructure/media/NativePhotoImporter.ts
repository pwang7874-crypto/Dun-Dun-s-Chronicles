import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type ImagePickerResponse,
} from 'react-native-image-picker';

import { AppError } from '../../domain/errors';
import type { ImportedPhoto } from '../../domain/models';
import type { PhotoImporter, PhotoSource } from '../../domain/ports';
import { importedPhotoSchema } from '../../domain/schemas';

export const responseToPhoto = (
  response: ImagePickerResponse,
): ImportedPhoto | null => {
  if (response.didCancel) {
    return null;
  }
  if (response.errorCode === 'camera_unavailable') {
    throw new AppError(
      'CAMERA_UNAVAILABLE',
      '当前设备无法使用相机，可以改从相册选择。',
    );
  }
  if (response.errorCode === 'permission') {
    throw new AppError(
      'CAMERA_PERMISSION_DENIED',
      '需要相机权限才能拍照，也可以直接从相册选择。',
    );
  }
  if (response.errorCode) {
    throw new AppError('PHOTO_UNSUPPORTED', '这张照片暂时无法读取，请换一张。');
  }

  const asset: Asset | undefined = response.assets?.[0];
  if (!asset?.uri || !asset.width || !asset.height || !asset.type) {
    throw new AppError('PHOTO_UNSUPPORTED', '这张照片缺少必要信息，请换一张。');
  }

  try {
    return importedPhotoSchema.parse({
      uri: asset.uri,
      contentType: asset.type === 'image/jpg' ? 'image/jpeg' : asset.type,
      fileName: asset.fileName,
      pixelWidth: asset.width,
      pixelHeight: asset.height,
      byteCount: asset.fileSize,
    });
  } catch (error) {
    throw new AppError(
      'PHOTO_TOO_LARGE',
      '图片尺寸过大，当前设备无法安全处理，请换一张。',
      { cause: error },
    );
  }
};

export class NativePhotoImporter implements PhotoImporter {
  async importPhoto(source: PhotoSource): Promise<ImportedPhoto | null> {
    const commonOptions = {
      mediaType: 'photo' as const,
      quality: 1 as const,
      assetRepresentationMode: 'compatible' as const,
    };
    const response =
      source === 'camera'
        ? await launchCamera({ ...commonOptions, saveToPhotos: false })
        : await launchImageLibrary({ ...commonOptions, selectionLimit: 1 });
    return responseToPhoto(response);
  }
}
