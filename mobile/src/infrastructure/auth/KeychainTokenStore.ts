import * as Keychain from 'react-native-keychain';
import { z } from 'zod';

import { AuthError, type StoredAuthSession, type TokenStore } from '../../domain/auth';

const service = 'com.drinkdiary.mobile.auth.session.v1';
const sessionSchema = z.object({
  accessToken: z.string().min(1).max(16384).regex(/^\S+$/),
  phoneMasked: z.string().min(1).max(64),
  expiresAt: z.number().positive().finite(),
});

const unavailable = () => new AuthError(
  'SECURE_STORAGE_UNAVAILABLE',
  '设备安全存储暂时不可用，请更新安装包或解锁设备后重试。不会使用明文保存登录凭证。',
);

export class KeychainTokenStore implements TokenStore {
  async read(): Promise<StoredAuthSession | null> {
    try {
      const credentials = await Keychain.getGenericPassword({ service });
      if (!credentials) {
        return null;
      }
      let value: unknown;
      try {
        value = JSON.parse(credentials.password);
      } catch {
        await this.clear();
        return null;
      }
      const parsed = sessionSchema.safeParse(value);
      if (!parsed.success) {
        await this.clear();
        return null;
      }
      return parsed.data;
    } catch {
      throw unavailable();
    }
  }

  async write(session: StoredAuthSession): Promise<void> {
    try {
      const parsed = sessionSchema.parse(session);
      const result = await Keychain.setGenericPassword('session', JSON.stringify(parsed), {
        service,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      if (!result) {
        throw unavailable();
      }
    } catch {
      throw unavailable();
    }
  }

  async clear(): Promise<void> {
    try {
      const removed = await Keychain.resetGenericPassword({ service });
      if (!removed) {
        throw unavailable();
      }
    } catch {
      throw unavailable();
    }
  }
}
