import { AiArtError, HttpAiArtService } from '../src/infrastructure/network/HttpAiArtService';

const input = {
  jobId: 'local-request-1', recordId: 'record-1', styleId: 'cream-poster',
  imageUri: 'file:///private/drink.jpg',
};

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

describe('authenticated AI requests', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it.each(['', 'http://example.com', 'https://user:secret@example.com',
    'https://example.com/api/v1', 'https://example.com?key=secret',
    'https://example.com#key'])('rejects unsafe or ambiguous API origin %s', origin => {
    expect(new HttpAiArtService(origin).isConfigured).toBe(false);
  });

  it('does not upload a private photo without a session', async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock;
    await expect(new HttpAiArtService('https://api.example.com').createGeneration(input))
      .rejects.toMatchObject({ code: 'AI_AUTH_REQUIRED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses the API prefix and a fresh bearer token', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ jobId: 'remote-1' }));
    globalThis.fetch = fetchMock;
    const tokens = jest.fn().mockResolvedValueOnce('first-token').mockResolvedValueOnce('renewed-token');
    const service = new HttpAiArtService('https://api.example.com/', tokens);
    await expect(service.createGeneration(input)).resolves.toEqual({ remoteJobId: 'remote-1' });
    await service.createGeneration(input);
    expect(fetchMock).toHaveBeenLastCalledWith('https://api.example.com/api/v1/ai/generations',
      expect.objectContaining({
        method: 'POST',
        headers: { Accept: 'application/json', Authorization: 'Bearer renewed-token' },
      }));
  });

  it('surfaces the server error code without retrying', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ error: { code: 'AI_QUOTA_EXHAUSTED', message: '需要邀请码' } }, false, 429),
    );
    globalThis.fetch = fetchMock;
    const service = new HttpAiArtService('https://api.example.com', async () => 'token');
    await expect(service.createGeneration(input)).rejects.toMatchObject({
      code: 'AI_QUOTA_EXHAUSTED',
      message: '需要邀请码',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid server job response', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue(jsonResponse({ jobId: 123 }));
    const service = new HttpAiArtService('https://api.example.com', async () => 'token');
    await expect(service.createGeneration(input)).rejects.toMatchObject({ code: 'AI_SERVICE_INVALID_RESPONSE' });
  });

  it('parses the invite entitlement snapshot', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({
      membershipTier: 'free',
      aiRemainingToday: 0,
      entitlementKind: 'invite',
      resetsAt: null,
      inviteCreditsRemaining: 9,
    }));
    globalThis.fetch = fetchMock;
    const service = new HttpAiArtService('https://api.example.com', async () => 'token');
    await expect(service.getEntitlement()).resolves.toEqual({
      membershipTier: 'free',
      aiRemainingToday: 0,
      entitlementKind: 'invite',
      inviteCreditsRemaining: 9,
    });
  });

  it('redeems an invite code and returns the granted credits', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ creditsGranted: 10, inviteCreditsRemaining: 10 }));
    globalThis.fetch = fetchMock;
    const service = new HttpAiArtService('https://api.example.com', async () => 'token');
    await expect(service.redeemInvite('  abc-123 ')).resolves.toEqual({ creditsGranted: 10, inviteCreditsRemaining: 10 });
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/api/v1/invite/redeem',
      expect.objectContaining({ method: 'POST' }));
  });

  it('surfaces the invite error code from the server', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({ error: { code: 'INVITE_CODE_USED', message: '这个邀请码已经被使用过了' } }, false, 422),
    );
    globalThis.fetch = fetchMock;
    const service = new HttpAiArtService('https://api.example.com', async () => 'token');
    await expect(service.redeemInvite('TEST123')).rejects.toBeInstanceOf(AiArtError);
    await expect(service.redeemInvite('TEST123')).rejects.toMatchObject({ code: 'INVITE_CODE_USED' });
  });
});
