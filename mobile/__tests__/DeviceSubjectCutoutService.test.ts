import { NativeModules, Platform } from 'react-native';
import { extractSubject } from 'react-native-image-analysis';
import { DeviceSubjectCutoutService } from '../src/infrastructure/media/DeviceSubjectCutoutService';

describe('offline cutout adapter', () => {
  afterEach(() => { jest.restoreAllMocks(); delete NativeModules.DundunOfflineCutout; });

  it('routes Android food and outfit through the bundled generic model, not the selfie model', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    NativeModules.DundunOfflineCutout = {
      extractSubject: jest.fn(async () => ({ uri: 'file:///cake.png', width: 780, height: 650 })),
      releaseCutout: jest.fn(async () => true),
    };
    const service = new DeviceSubjectCutoutService();
    expect(service.isSupported).toBe(true);
    await expect(service.extractSubject('file:///original.jpg')).resolves.toEqual({
      uri: 'file:///cake.png', contentType: 'image/png', fileName: 'dundunji-cutout.png', pixelWidth: 780, pixelHeight: 650,
    });
    expect(extractSubject).not.toHaveBeenCalled();
    await service.releaseTemporary('file:///cake.png');
    expect(NativeModules.DundunOfflineCutout.releaseCutout).toHaveBeenCalledWith('file:///cake.png');
  });

  it('requires a rebuilt APK rather than silently falling back to the old broken Android path', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const service = new DeviceSubjectCutoutService();
    expect(service.isSupported).toBe(false);
    await expect(service.extractSubject('file:///original.jpg')).rejects.toMatchObject({ code: 'CUTOUT_UNAVAILABLE' });
  });

  it('rejects malformed native output without importing it as a ready sticker', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    NativeModules.DundunOfflineCutout = { extractSubject: jest.fn(async () => ({ uri: 'file:///bad.png', width: 0, height: NaN })) };
    await expect(new DeviceSubjectCutoutService().extractSubject('file:///original.jpg')).rejects.toMatchObject({ code: 'CUTOUT_FAILED' });
  });
});
