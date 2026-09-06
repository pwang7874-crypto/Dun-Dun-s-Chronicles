import {
  extractSubject,
  isSupported,
  type SubjectCutout,
} from 'react-native-image-analysis';
import { NativeModules, Platform } from 'react-native';

import { AppError } from '../../domain/errors';
import type { ImportedPhoto } from '../../domain/models';
import type { SubjectCutoutService } from '../../domain/ports';

const toImportedPhoto = (cutout: SubjectCutout): ImportedPhoto => ({
  uri: cutout.uri,
  contentType: 'image/png',
  fileName: 'dundunji-cutout.png',
  pixelWidth: cutout.width,
  pixelHeight: cutout.height,
});

export class DeviceSubjectCutoutService implements SubjectCutoutService {
  get isSupported(): boolean {
    if (Platform.OS === 'android') {
      return typeof NativeModules.DundunOfflineCutout?.extractSubject === 'function';
    }
    try {
      return isSupported().subjectLifting;
    } catch {
      return false;
    }
  }

  async extractSubject(imageUri: string): Promise<ImportedPhoto> {
    if (!this.isSupported) {
      throw new AppError(
        'CUTOUT_UNAVAILABLE',
        '这台设备暂不支持透明主体抠图，请换一台支持的手机后再试。',
      );
    }
    try {
      const cutout = Platform.OS === 'android'
        ? await NativeModules.DundunOfflineCutout.extractSubject(imageUri)
        : await extractSubject(imageUri, {
        trim: true,
        format: 'png',
        maxPixels: 4_000_000,
      });
      if (!cutout?.uri || !Number.isFinite(cutout.width) || !Number.isFinite(cutout.height)
        || cutout.width < 2 || cutout.height < 2) {
        throw new Error('Invalid cutout dimensions');
      }
      return toImportedPhoto(cutout);
    } catch (error) {
      throw new AppError(
        'CUTOUT_FAILED',
        '没有识别到清晰主体，请换一张主体完整、背景更干净的照片。',
        { cause: error },
      );
    }
  }

  async releaseTemporary(uri: string): Promise<void> {
    if (Platform.OS === 'android') {
      await NativeModules.DundunOfflineCutout?.releaseCutout(uri);
    }
  }
}
