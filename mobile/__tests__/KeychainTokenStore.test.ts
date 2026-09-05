import * as Keychain from 'react-native-keychain';

import { KeychainTokenStore } from '../src/infrastructure/auth/KeychainTokenStore';

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
  STORAGE_TYPE: { AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth' },
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn(),
  resetGenericPassword: jest.fn(),
}));

const stored = { accessToken: 'opaque-test-token', phoneMasked: '138****0000', expiresAt: 1800000000000 };
const keychain = jest.mocked(Keychain);

describe('KeychainTokenStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    keychain.getGenericPassword.mockResolvedValue(false);
    keychain.setGenericPassword.mockResolvedValue({ service: 'test', storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH });
    keychain.resetGenericPassword.mockResolvedValue(true);
  });

  it('stores credentials in the OS keychain with device-only accessibility', async () => {
    await new KeychainTokenStore().write(stored);
    expect(keychain.setGenericPassword).toHaveBeenCalledWith('session', JSON.stringify(stored), {
      service: 'com.drinkdiary.mobile.auth.session.v1',
      accessible: 'AccessibleWhenUnlockedThisDeviceOnly',
    });
  });

  it('retrieves an existing secure session', async () => {
    keychain.getGenericPassword.mockResolvedValue({ username: 'session', password: JSON.stringify(stored), service: 'test', storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH });
    await expect(new KeychainTokenStore().read()).resolves.toEqual(stored);
  });

  it('returns no session when there are no keychain credentials', async () => {
    await expect(new KeychainTokenStore().read()).resolves.toBeNull();
  });

  it.each(['broken-json', '{}', JSON.stringify({ ...stored, accessToken: '' })])('clears corrupt credentials without exposing them', async value => {
    keychain.getGenericPassword.mockResolvedValue({ username: 'session', password: value, service: 'test', storage: Keychain.STORAGE_TYPE.AES_GCM_NO_AUTH });
    await expect(new KeychainTokenStore().read()).resolves.toBeNull();
    expect(keychain.resetGenericPassword).toHaveBeenCalledWith({ service: 'com.drinkdiary.mobile.auth.session.v1' });
  });

  it('fails closed when the native module cannot be read', async () => {
    keychain.getGenericPassword.mockRejectedValue(new TypeError('Native module unavailable'));
    await expect(new KeychainTokenStore().read()).rejects.toMatchObject({ code: 'SECURE_STORAGE_UNAVAILABLE' });
    expect(keychain.setGenericPassword).not.toHaveBeenCalled();
  });

  it('fails closed if the native module declines a write', async () => {
    keychain.setGenericPassword.mockResolvedValue(false);
    await expect(new KeychainTokenStore().write(stored)).rejects.toMatchObject({ code: 'SECURE_STORAGE_UNAVAILABLE' });
  });

  it('surfaces native deletion failure instead of claiming logout succeeded', async () => {
    keychain.resetGenericPassword.mockResolvedValue(false);
    await expect(new KeychainTokenStore().clear()).rejects.toMatchObject({ code: 'SECURE_STORAGE_UNAVAILABLE' });
  });
});
