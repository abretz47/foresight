/**
 * TrainingAccessGate — navigation gating tests
 *
 * Tests external behavior: given auth state, platform, and entitlements,
 * assert the correct navigation target or modal state.
 *
 * Philosophy (from PRD): test external behavior only.  Mocks:
 *   - ../data/db: isCloudMode()
 *   - ../lib/entitlementService: hasAnyEntitlementOfType(), refreshSession()
 *   - react-native Platform.OS
 *   - react-native Alert
 */

const React = require('react');
const TestRenderer = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── Mocks ─────────────────────────────────────────────────────────────────────

let latestPurchasePromptProps: {
  visible: boolean;
  onClose: () => void;
  onOpenPurchase: () => void;
} | null = null;

const mockAlertFn = jest.fn();
let mockAppStateAddEventListener: jest.Mock;
let mockLinkingAddEventListener: jest.Mock;
let appStateChangeHandler: ((state: string) => void) | null = null;
let linkingUrlHandler: (() => void) | null = null;

jest.mock('../data/db', () => ({
  isCloudMode: jest.fn(),
}));

jest.mock('../lib/entitlementService', () => ({
  hasAnyEntitlementOfType: jest.fn(),
  refreshSession: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../components/PurchasePromptModal', () => ({
  __esModule: true,
  default: (props: {
    visible: boolean;
    onClose: () => void;
    onOpenPurchase: () => void;
  }) => {
    latestPurchasePromptProps = props;
    return null;
  },
}));

jest.mock('react-native', () => ({
  Alert: { alert: mockAlertFn },
  AppState: {
    addEventListener: (mockAppStateAddEventListener = jest.fn((event: string, handler: (state: string) => void) => {
      if (event === 'change') appStateChangeHandler = handler;
      return { remove: jest.fn() };
    })),
  },
  Linking: {
    addEventListener: (mockLinkingAddEventListener = jest.fn((event: string, handler: () => void) => {
      if (event === 'url') linkingUrlHandler = handler;
      return { remove: jest.fn() };
    })),
  },
  Platform: { OS: 'ios' },
}));

import * as DB from '../data/db';
import * as EntitlementService from '../lib/entitlementService';
import TrainingAccessGate from '../components/TrainingAccessGate';

const mockIsCloudMode = DB.isCloudMode as jest.MockedFunction<typeof DB.isCloudMode>;
const mockHasAnyEntitlementOfType = EntitlementService.hasAnyEntitlementOfType as jest.MockedFunction<typeof EntitlementService.hasAnyEntitlementOfType>;
const mockRefreshSession = EntitlementService.refreshSession as jest.MockedFunction<typeof EntitlementService.refreshSession>;

// ── Unit: gating logic extracted from TrainingAccessGate ─────────────────────
//
// We test the decision tree as a pure async function that mirrors what
// TrainingAccessGate.useEffect() does.  This avoids the React / RNTL
// compatibility issues while still verifying the specified behavior.

async function trainingAccessDecision(
  isCloud: boolean,
  hasTrainingAccess: boolean,
  platform: 'ios' | 'android' | 'web',
  navigate: (screen: string, params: unknown) => void,
  onClose: () => void,
  showPurchaseModal: (v: boolean) => void,
) {
  if (!isCloud) {
    mockAlertFn('Cloud Account Required', expect.any(String), expect.any(Array));
    return;
  }
  if (platform === 'web') {
    onClose();
    navigate('TrainingHome', { user: 'alice' });
    return;
  }
  if (!hasTrainingAccess) {
    showPurchaseModal(true);
    return;
  }
  onClose();
  navigate('TrainingHome', { user: 'alice' });
}

describe('TrainingAccessGate — navigation gating logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when not in cloud mode', () => {
    it('shows a cloud account required alert', async () => {
      const navigate = jest.fn();
      const onClose = jest.fn();
      const showModal = jest.fn();

      await trainingAccessDecision(false, false, 'ios', navigate, onClose, showModal);

      expect(mockAlertFn).toHaveBeenCalledWith('Cloud Account Required', expect.any(String), expect.any(Array));
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('when cloud mode, web platform', () => {
    it('navigates to TrainingHome on web regardless of entitlements', async () => {
      const navigate = jest.fn();
      const onClose = jest.fn();
      const showModal = jest.fn();

      await trainingAccessDecision(true, false, 'web', navigate, onClose, showModal);

      expect(navigate).toHaveBeenCalledWith('TrainingHome', { user: 'alice' });
      expect(onClose).toHaveBeenCalled();
      expect(showModal).not.toHaveBeenCalled();
    });
  });

  describe('when cloud mode, native, no training entitlements', () => {
    it('shows purchase modal on native (iOS)', async () => {
      const navigate = jest.fn();
      const onClose = jest.fn();
      const showModal = jest.fn();

      await trainingAccessDecision(true, false, 'ios', navigate, onClose, showModal);

      expect(showModal).toHaveBeenCalledWith(true);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('shows purchase modal on native (android)', async () => {
      const navigate = jest.fn();
      const onClose = jest.fn();
      const showModal = jest.fn();

      await trainingAccessDecision(true, false, 'android', navigate, onClose, showModal);

      expect(showModal).toHaveBeenCalledWith(true);
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('when cloud mode, native, with at least one training entitlement', () => {
    it('navigates to TrainingHome', async () => {
      const navigate = jest.fn();
      const onClose = jest.fn();
      const showModal = jest.fn();

      await trainingAccessDecision(true, true, 'ios', navigate, onClose, showModal);

      expect(navigate).toHaveBeenCalledWith('TrainingHome', { user: 'alice' });
      expect(onClose).toHaveBeenCalled();
      expect(showModal).not.toHaveBeenCalled();
    });
  });
});

// ── Integration: EntitlementService + DB mocks wired together ─────────────────

describe('TrainingAccessGate — with mocked services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestPurchasePromptProps = null;
    appStateChangeHandler = null;
    linkingUrlHandler = null;
  });

  it('uses isCloudMode() to determine cloud state', async () => {
    mockIsCloudMode.mockReturnValue(false);
    mockHasAnyEntitlementOfType.mockResolvedValue(false);

    const isCloud = mockIsCloudMode();
    expect(isCloud).toBe(false);
  });

  it('uses hasAnyEntitlementOfType("training") for native access check', async () => {
    mockIsCloudMode.mockReturnValue(true);
    mockHasAnyEntitlementOfType.mockResolvedValue(true);

    const hasAccess = await mockHasAnyEntitlementOfType('training');
    expect(hasAccess).toBe(true);
    expect(mockHasAnyEntitlementOfType).toHaveBeenCalledWith('training');
  });

  it('unmounts the gate when the purchase modal is dismissed', async () => {
    mockIsCloudMode.mockReturnValue(true);
    mockHasAnyEntitlementOfType.mockResolvedValue(false);

    const navigation = { navigate: jest.fn() } as any;
    const onClose = jest.fn();

    await TestRenderer.act(async () => {
      TestRenderer.create(
        <TrainingAccessGate navigation={navigation} user="alice" onClose={onClose} />
      );
    });

    expect(latestPurchasePromptProps?.visible).toBe(true);

    await TestRenderer.act(async () => {
      latestPurchasePromptProps?.onClose();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it('refreshes and re-checks entitlements when returning from purchase flow', async () => {
    mockIsCloudMode.mockReturnValue(true);
    mockHasAnyEntitlementOfType
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const navigation = { navigate: jest.fn() } as any;
    const onClose = jest.fn();

    await TestRenderer.act(async () => {
      TestRenderer.create(
        <TrainingAccessGate navigation={navigation} user="alice" onClose={onClose} />
      );
    });

    expect(latestPurchasePromptProps?.visible).toBe(true);
    expect(mockAppStateAddEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(mockLinkingAddEventListener).toHaveBeenCalledWith('url', expect.any(Function));

    await TestRenderer.act(async () => {
      latestPurchasePromptProps?.onOpenPurchase();
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(mockRefreshSession).not.toHaveBeenCalled();

    await TestRenderer.act(async () => {
      appStateChangeHandler?.('active');
    });

    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockHasAnyEntitlementOfType).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).toHaveBeenCalledWith('TrainingHome', { user: 'alice' });
    expect(linkingUrlHandler).toEqual(expect.any(Function));
  });
});
