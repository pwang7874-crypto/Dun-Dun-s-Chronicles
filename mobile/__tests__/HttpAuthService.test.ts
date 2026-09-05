import { AuthError, type StoredAuthSession, type TokenStore } from '../src/domain/auth';
import { HttpAuthService } from '../src/infrastructure/network/HttpAuthService';

const timestamp = Date.parse('2026-09-05T08:00:00Z');
const login = { accessToken: 'opaque-test-token', tokenType: 'bearer', expiresIn: 3600, phoneMasked: '138****0000' };

const createService = (baseUrl = 'https://api.example.test/') => {
  const tokenStore: jest.Mocked<TokenStore> = {
    read: jest.fn().mockResolvedValue(null),
    write: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  };
  const fetcher = jest.fn();
  const service = new HttpAuthService(baseUrl, tokenStore, fetcher, () => timestamp);
  return { service, tokenStore, fetcher };
};

describe('HttpAuthService', () => {
  it('requests a real SMS challenge through the versioned origin', async () => {
    const { service, fetcher, tokenStore } = createService();
    const challenge = { challengeId: 'challenge-1', expiresIn: 300 };
    fetcher.mockResolvedValue({ ok: true, json: async () => challenge });
    await expect(service.requestSmsCode('13800000000')).resolves.toEqual(challenge);
    expect(tokenStore.read).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/api/v1/auth/sms/request', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ phone: '13800000000' }),
    }));
  });

  it.each(['', 'https://api.example.test/api/v1', 'http://api.example.test', 'https://user:pass@api.example.test', 'https://api.example.test/?secret=value', 'https://api.example.test/#path'])(
    'does not send credentials to an invalid origin: %s', async baseUrl => {
      const { service, fetcher } = createService(baseUrl);
      await expect(service.requestSmsCode('13800000000')).rejects.toMatchObject({ code: 'SERVICE_NOT_CONFIGURED' });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it('rejects invalid phone numbers before making a request', async () => {
    const { service, fetcher } = createService();
    await expect(service.requestSmsCode('123')).rejects.toMatchObject({ code: 'INVALID_PHONE' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('does not request an SMS when native secure storage is unavailable', async () => {
    const { service, tokenStore, fetcher } = createService();
    tokenStore.read.mockRejectedValue(new AuthError('SECURE_STORAGE_UNAVAILABLE', '不可用'));
    await expect(service.requestSmsCode('13800000000')).rejects.toMatchObject({ code: 'SECURE_STORAGE_UNAVAILABLE' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('persists verified tokens only in the injected secure store and returns non-secret metadata', async () => {
    const { service, tokenStore, fetcher } = createService();
    fetcher.mockResolvedValue({ ok: true, json: async () => login });
    await expect(service.verifySmsCode('challenge-1', '123456')).resolves.toEqual({ phoneMasked: login.phoneMasked, expiresAt: timestamp + 3600000 });
    expect(tokenStore.write).toHaveBeenCalledWith({ accessToken: login.accessToken, phoneMasked: login.phoneMasked, expiresAt: timestamp + 3600000 });
    expect(fetcher).toHaveBeenCalledWith('https://api.example.test/api/v1/auth/sms/verify', expect.objectContaining({ body: JSON.stringify({ challengeId: 'challenge-1', code: '123456' }) }));
  });

  it('does not report login success if secure persistence fails', async () => {
    const { service, tokenStore, fetcher } = createService();
    fetcher.mockResolvedValue({ ok: true, json: async () => login });
    tokenStore.write.mockRejectedValue(new AuthError('SECURE_STORAGE_UNAVAILABLE', '不可用'));
    await expect(service.verifySmsCode('challenge-1', '123456')).rejects.toMatchObject({ code: 'SECURE_STORAGE_UNAVAILABLE' });
    await expect(service.getAccessToken()).resolves.toBeNull();
  });

  it('rejects incomplete verification input before the network', async () => {
    const { service, fetcher } = createService();
    await expect(service.verifySmsCode('', '123456')).rejects.toMatchObject({ code: 'INVALID_CODE' });
    await expect(service.verifySmsCode('challenge-1', '123')).rejects.toMatchObject({ code: 'INVALID_CODE' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('preserves server error codes and safe messages without storing a token', async () => {
    const { service, tokenStore, fetcher } = createService();
    fetcher.mockResolvedValue({ ok: false, json: async () => ({ error: { code: 'SMS_CODE_INVALID', message: '验证码不正确' } }) });
    await expect(service.verifySmsCode('challenge-1', '123456')).rejects.toMatchObject({ code: 'SMS_CODE_INVALID', message: '验证码不正确' });
    expect(tokenStore.write).not.toHaveBeenCalled();
  });

  it.each([{ ...login, tokenType: 'unknown' }, { ...login, accessToken: '' }, { ...login, expiresIn: -1 }])(
    'rejects malformed login payloads', async payload => {
      const { service, tokenStore, fetcher } = createService();
      fetcher.mockResolvedValue({ ok: true, json: async () => payload });
      await expect(service.verifySmsCode('challenge-1', '123456')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
      expect(tokenStore.write).not.toHaveBeenCalled();
    },
  );

  it('uses a generic error for network failures', async () => {
    const { service, fetcher } = createService();
    fetcher.mockRejectedValue(new Error('private network details'));
    await expect(service.verifySmsCode('challenge-1', '123456')).rejects.toMatchObject({ code: 'NETWORK_UNAVAILABLE' });
  });

  it('aborts a request after 15 seconds and reports a timeout', async () => {
    jest.useFakeTimers();
    try {
      const { service, fetcher } = createService();
      fetcher.mockImplementation((_url, options: RequestInit) => new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      }));
      const pending = service.verifySmsCode('challenge-1', '123456').catch(error => error);
      await jest.advanceTimersByTimeAsync(15000);
      expect(await pending).toMatchObject({ code: 'REQUEST_TIMEOUT' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('exposes the active token only through getAccessToken', async () => {
    const { service, tokenStore } = createService();
    const stored: StoredAuthSession = { accessToken: 'token', phoneMasked: '138****0000', expiresAt: timestamp + 10000 };
    tokenStore.read.mockResolvedValue(stored);
    await expect(service.getAccessToken()).resolves.toBe('token');
    await expect(service.getSession()).resolves.toEqual({ phoneMasked: stored.phoneMasked, expiresAt: stored.expiresAt });
  });

  it('clears expired sessions without returning a token', async () => {
    const { service, tokenStore } = createService();
    tokenStore.read.mockResolvedValue({ accessToken: 'expired', phoneMasked: '138****0000', expiresAt: timestamp });
    await expect(service.getAccessToken()).resolves.toBeNull();
    expect(tokenStore.clear).toHaveBeenCalledTimes(1);
  });

  it('removes the local secure session on logout and surfaces removal failures', async () => {
    const { service, tokenStore } = createService();
    await service.signOut();
    expect(tokenStore.clear).toHaveBeenCalledTimes(1);
    tokenStore.clear.mockRejectedValue(new AuthError('SECURE_STORAGE_UNAVAILABLE', '不可用'));
    await expect(service.signOut()).rejects.toMatchObject({ code: 'SECURE_STORAGE_UNAVAILABLE' });
  });
});
