describe('supabase signOut', () => {
  const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
    jest.dontMock('@supabase/supabase-js');
    jest.dontMock('@react-native-async-storage/async-storage');
    jest.restoreAllMocks();
  });

  it('falls back to local sign-out when global sign-out returns a 403 error', async () => {
    const mockAuthSignOut = jest
      .fn()
      .mockResolvedValueOnce({ error: { status: 403, message: 'JWT missing' } })
      .mockResolvedValueOnce({ error: null });

    jest.doMock('@supabase/supabase-js', () => ({
      createClient: jest.fn(() => ({
        auth: {
          signOut: (...args: unknown[]) => mockAuthSignOut(...args),
        },
      })),
    }));
    jest.doMock('@react-native-async-storage/async-storage', () => ({
      __esModule: true,
      default: {},
    }));

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { signOut } = require('../lib/supabase');

    await expect(signOut()).resolves.toBeUndefined();

    expect(mockAuthSignOut).toHaveBeenNthCalledWith(1);
    expect(mockAuthSignOut).toHaveBeenNthCalledWith(2, { scope: 'local' });
    expect(warnSpy).toHaveBeenCalledWith(
      '[Foresight] Global signOut failed, clearing local session:',
      expect.objectContaining({ status: 403, message: 'JWT missing' })
    );
  });
});
