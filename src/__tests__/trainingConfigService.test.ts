const mockStorage = new Map<string, string>();

let sessionUserId = 'user-1';
const mockGetSession = jest.fn(async () => ({
  data: {
    session: {
      access_token: 'token-123',
      user: { id: sessionUserId },
    },
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getAllKeys: jest.fn(async () => Array.from(mockStorage.keys())),
    getItem: jest.fn(async (key: string) => (mockStorage.has(key) ? mockStorage.get(key)! : null)),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
  },
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    supabaseUrl: 'https://example.supabase.co',
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

import { fetchManifest, type DrillManifest } from '../lib/trainingConfigService';

const sampleManifest: DrillManifest = {
  id: 'manifest-1',
  name: 'Putting Assessment',
  description: 'desc',
  icon: 'icon',
  scheduledWeeks: [1],
  title: 'title',
  version: 2,
  estimatedDurationMinutes: 30,
  steps: [],
  parameters: {},
  assets: {},
};

function cacheKey(userId: string, slug: string, version: number): string {
  return `@foresight/training_manifest_${userId}_${slug}_v${version}`;
}

describe('trainingConfigService fetchManifest cache safety', () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    mockStorage.clear();
    sessionUserId = 'user-1';
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('falls back to cache for connectivity failures', async () => {
    mockStorage.set(
      cacheKey('user-1', 'putting-assessment', 2),
      JSON.stringify(sampleManifest)
    );
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));

    await expect(fetchManifest('putting-assessment')).resolves.toEqual(sampleManifest);
  });

  it('does not use cache when server returns 403', async () => {
    mockStorage.set(
      cacheKey('user-1', 'putting-assessment', 2),
      JSON.stringify(sampleManifest)
    );
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);

    await expect(fetchManifest('putting-assessment')).rejects.toThrow(
      'You do not have access to this module.'
    );
  });

  it('does not read cache entries from other users', async () => {
    mockStorage.set(
      cacheKey('user-2', 'putting-assessment', 2),
      JSON.stringify(sampleManifest)
    );
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));

    await expect(fetchManifest('putting-assessment')).rejects.toThrow('Network request failed');
  });

  it('does not use cache for non-connectivity fetch failures', async () => {
    mockStorage.set(
      cacheKey('user-1', 'putting-assessment', 2),
      JSON.stringify(sampleManifest)
    );
    mockFetch.mockRejectedValue(new Error('Request aborted by caller'));

    await expect(fetchManifest('putting-assessment')).rejects.toThrow('Request aborted by caller');
  });
});
