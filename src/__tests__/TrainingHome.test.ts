jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  FlatList: 'FlatList',
  TouchableOpacity: 'TouchableOpacity',
  ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios ?? options.default },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  StyleSheet: { create: <T extends Record<string, unknown>>(styles: T) => styles },
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('@react-navigation/stack', () => ({}));

jest.mock('../lib/entitlementService', () => ({
  hasEntitlement: jest.fn(),
  refreshSession: jest.fn(),
}));

import { refreshOwnership, shouldRefreshOwnershipOnAppState } from '../pages/TrainingHome';
import { refreshSession } from '../lib/entitlementService';

const mockRefreshSession = refreshSession as jest.MockedFunction<typeof refreshSession>;

describe('TrainingHome ownership refresh helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshSession.mockResolvedValue(undefined);
  });

  it('refreshes auth session before reloading ownership', async () => {
    const steps: string[] = [];
    mockRefreshSession.mockImplementation(async () => {
      steps.push('refresh');
    });
    const load = jest.fn(async () => {
      steps.push('load');
    });

    await refreshOwnership(load);

    expect(load).toHaveBeenCalledTimes(1);
    expect(steps).toEqual(['refresh', 'load']);
  });

  it('refreshes only when app state is active', () => {
    expect(shouldRefreshOwnershipOnAppState('active')).toBe(true);
    expect(shouldRefreshOwnershipOnAppState('background')).toBe(false);
    expect(shouldRefreshOwnershipOnAppState('inactive')).toBe(false);
  });
});
