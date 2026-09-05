import { NativeModules, Platform, Share } from 'react-native';

import type { ShareChannel } from '../../domain/models';

interface TargetShareNativeModule {
  share(imageUri: string, title: string, copy: string, target: ShareChannel): Promise<boolean>;
}

const module = NativeModules.TargetShare as TargetShareNativeModule | undefined;

export const shareDirectlyToTarget = async (
  imageUri: string,
  title: string,
  copy: string,
  target: ShareChannel,
): Promise<boolean> => {
  if (Platform.OS === 'android' && module) {
    try {
      await module.share(imageUri, title, copy, target);
      return true;
    } catch {
      return false;
    }
  }

  if (Platform.OS === 'ios') {
    const fileUrl = imageUri.startsWith('file://') ? imageUri : `file://${imageUri}`;
    try {
      // iOS does not expose a stable public URL scheme for pre-filling a
      // specific social app. The system share sheet is the most reliable way
      // to pass both the poster and its complete copy without an SDK login.
      await Share.share(
        { title, message: copy, url: fileUrl },
        { subject: title },
      );
      return true;
    } catch {
      return false;
    }
  }

  return false;
};
