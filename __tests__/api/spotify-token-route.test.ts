/**
 * @jest-environment node
 */
describe('POST /api/spotify/token', () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    globalThis.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('returns 501 when credentials are not configured', async () => {
    delete process.env.SPOTIFY_CLIENT_ID;
    delete process.env.SPOTIFY_CLIENT_SECRET;

    const { POST } = await import('@/app/api/spotify/token/route');
    const res = await POST();
    expect(res.status).toBe(501);

    const body = await res.json();
    expect(body.error).toContain('not configured');
  });

  it('returns 501 when credentials are placeholder values', async () => {
    process.env.SPOTIFY_CLIENT_ID = 'YOUR_CLIENT_ID_HERE';
    process.env.SPOTIFY_CLIENT_SECRET = 'some-secret';

    const { POST } = await import('@/app/api/spotify/token/route');
    const res = await POST();
    expect(res.status).toBe(501);
  });

  it('returns token data on successful Spotify response', async () => {
    process.env.SPOTIFY_CLIENT_ID = 'real-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'real-secret';

    const tokenData = {
      access_token: 'BQC...',
      token_type: 'Bearer',
      expires_in: 3600,
    };
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(tokenData),
    });

    const { POST } = await import('@/app/api/spotify/token/route');
    const res = await POST();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.access_token).toBe('BQC...');
    expect(body.expires_in).toBe(3600);
  });

  it('sends correct auth header to Spotify', async () => {
    process.env.SPOTIFY_CLIENT_ID = 'my-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'my-secret';

    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'tok',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
    });

    const { POST } = await import('@/app/api/spotify/token/route');
    await POST();

    const fetchCall = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(fetchCall[0]).toBe('https://accounts.spotify.com/api/token');

    const headers = fetchCall[1].headers;
    const expectedBasic = Buffer.from('my-id:my-secret').toString('base64');
    expect(headers.Authorization).toBe(`Basic ${expectedBasic}`);
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('returns 500 when Spotify returns an error', async () => {
    process.env.SPOTIFY_CLIENT_ID = 'real-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'real-secret';

    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    });

    const { POST } = await import('@/app/api/spotify/token/route');
    const res = await POST();
    expect(res.status).toBe(500);
  });

  it('returns 500 when fetch throws', async () => {
    process.env.SPOTIFY_CLIENT_ID = 'real-id';
    process.env.SPOTIFY_CLIENT_SECRET = 'real-secret';

    (globalThis.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { POST } = await import('@/app/api/spotify/token/route');
    const res = await POST();
    expect(res.status).toBe(500);
  });
});
