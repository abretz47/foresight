const mockStorage = new Map<string, string>();

let sessionUserId: string | null = null;
let remoteRows: Array<Record<string, unknown>> = [];
let selectedUserId: string | null = null;
let pendingDeleteId: string | null = null;
let selectError: Error | null = null;
let upsertError: Error | null = null;
let deleteError: Error | null = null;

const mockGetSession = jest.fn(async () => ({
  data: {
    session: sessionUserId ? { user: { id: sessionUserId } } : null,
  },
}));

const mockSelectOrder = jest.fn(async () => ({
  data: selectError
    ? null
    : remoteRows
        .filter((row) => !selectedUserId || row.user_id === selectedUserId)
        .map(({ id, module_id, started_at, completed_at, week_number, drill_results }) => ({
          id,
          module_id,
          started_at,
          completed_at,
          week_number,
          drill_results,
        })),
  error: selectError,
}));

const mockSelectEq = jest.fn((column: string, value: string) => {
  if (column === 'user_id') {
    selectedUserId = value;
  }
  return { order: mockSelectOrder };
});

const mockSelect = jest.fn(() => ({ eq: mockSelectEq }));

const mockUpsert = jest.fn(async (row: Record<string, unknown>) => {
  if (upsertError) {
    return { error: upsertError };
  }
  const index = remoteRows.findIndex((item) => item.id === row.id);
  if (index >= 0) {
    remoteRows[index] = row;
  } else {
    remoteRows.push(row);
  }
  return { error: null };
});

const mockDeleteEqUser = jest.fn(async (column: string, value: string) => {
  if (column === 'user_id' && pendingDeleteId) {
    if (deleteError) {
      return { error: deleteError };
    }
    remoteRows = remoteRows.filter((row) => !(row.id === pendingDeleteId && row.user_id === value));
  }
  return { error: null };
});

const mockDeleteEqId = jest.fn((column: string, value: string) => {
  if (column === 'id') {
    pendingDeleteId = value;
  }
  return { eq: mockDeleteEqUser };
});

const mockDelete = jest.fn(() => ({ eq: mockDeleteEqId }));

const mockFrom = jest.fn(() => ({
  select: mockSelect,
  upsert: mockUpsert,
  delete: mockDelete,
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
  getItem: jest.fn(async (key: string) => (mockStorage.has(key) ? mockStorage.get(key)! : null)),
    setItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
    mockStorage.delete(key);
    }),
  },
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteSession,
  getAllSessions,
  getSessionsForModule,
  saveSession,
} from '../services/sessionService';

describe('sessionService', () => {
  const localCacheKey = '@foresight/training_sessions_cache_local';
  const cloudCacheKey = '@foresight/training_sessions_cache_user-1';
  const pendingKey = '@foresight/training_sessions_pending_user-1';

  const sampleSession = {
    id: 'session-1',
    moduleId: 'putting-assessment',
    startedAt: '2026-08-27T00:00:00.000Z',
    completedAt: '2026-08-27T00:15:00.000Z',
    weekNumber: 1,
    drillResults: [
      {
        sectionName: 'Short Putts',
        drillName: '3 Foot Circle',
        holeScores: [1, 1, 0],
        totalPotential: 3,
      },
    ],
  };

  beforeEach(() => {
    mockStorage.clear();
    remoteRows = [];
    selectedUserId = null;
    pendingDeleteId = null;
    sessionUserId = null;
    selectError = null;
    upsertError = null;
    deleteError = null;
    jest.clearAllMocks();
  });

  it('stores sessions locally when no cloud user is active', async () => {
    await saveSession(sampleSession);

    expect(await getAllSessions()).toEqual([sampleSession]);
    expect(await getSessionsForModule('putting-assessment')).toEqual([sampleSession]);
    expect(mockStorage.get(localCacheKey)).toContain('"session-1"');
  });

  it('syncs saved sessions to Supabase and refreshes the cache', async () => {
    sessionUserId = 'user-1';

    await saveSession(sampleSession);

    expect(mockFrom).toHaveBeenCalledWith('training_sessions');
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'session-1',
        user_id: 'user-1',
        module_id: 'putting-assessment',
        week_number: 1,
      }),
      { onConflict: 'id' }
    );
    expect(await getAllSessions()).toEqual([sampleSession]);
    expect(mockStorage.get(cloudCacheKey)).toContain('"putting-assessment"');
  });

  it('keeps cached sessions available when Supabase save fails', async () => {
    sessionUserId = 'user-1';
    upsertError = new Error('offline');

    await saveSession(sampleSession);

    expect(await getAllSessions()).toEqual([sampleSession]);
    expect(mockStorage.get(pendingKey)).toContain('"type":"upsert"');
  });

  it('removes sessions from cache and Supabase on delete', async () => {
    sessionUserId = 'user-1';
    remoteRows = [
      {
        id: 'session-1',
        user_id: 'user-1',
        module_id: 'putting-assessment',
        started_at: '2026-08-27T00:00:00.000Z',
        completed_at: '2026-08-27T00:15:00.000Z',
        week_number: 1,
        drill_results: sampleSession.drillResults,
      },
    ];
    mockStorage.set(cloudCacheKey, JSON.stringify([sampleSession]));

    await deleteSession('session-1');

    expect(mockDelete).toHaveBeenCalled();
    expect(await getAllSessions()).toEqual([]);
  });

  it('migrates the legacy cache key into the scoped cache', async () => {
    mockStorage.set('foresight_academy_sessions', JSON.stringify([sampleSession]));

    const sessions = await getAllSessions();

    expect(sessions).toEqual([sampleSession]);
    expect(mockStorage.get(localCacheKey)).toContain('"session-1"');
    expect(await AsyncStorage.getItem('foresight_academy_sessions')).toBeNull();
  });
});
