import React from 'react';
import TestRenderer from 'react-test-renderer';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockSignOut = jest.fn();
const mockIsSupabaseConfigured = jest.fn();
const mockLocalSignOut = jest.fn();

jest.useFakeTimers();

jest.mock('react-native', () => {
  const React = require('react');
  const createPrimitive = (name: string) => ({ children, ...props }: any) =>
    React.createElement(name, props, children);

  return {
    View: createPrimitive('View'),
    Text: createPrimitive('Text'),
    TouchableOpacity: createPrimitive('TouchableOpacity'),
    Modal: ({ visible, children, ...props }: any) => (visible ? React.createElement('Modal', props, children) : null),
    Alert: { alert: jest.fn() },
    Platform: { select: (options: Record<string, unknown>) => options.ios ?? options.default },
    StyleSheet: { create: (styles: unknown) => styles },
  };
});

jest.mock('../data/db', () => ({
  isCloudMode: jest.fn(() => false),
  getUsers: jest.fn().mockResolvedValue([]),
  getShotProfile: jest.fn(),
}));

jest.mock('../lib/supabase', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
  isSupabaseConfigured: (...args: unknown[]) => mockIsSupabaseConfigured(...args),
  supabase: {
    auth: {
      signOut: (...args: unknown[]) => mockLocalSignOut(...args),
    },
  },
}));

jest.mock('../components/EmojiText', () => ({
  __esModule: true,
  default: ({ children, ...props }: any) => {
    const React = require('react');
    return React.createElement('Text', props, children);
  },
}));

jest.mock('../components/MigrateModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../components/TrainingAccessGate', () => ({
  __esModule: true,
  default: () => null,
}));

import HamburgerMenu from '../components/HamburgerMenu';

function findButtonByText(tree: TestRenderer.ReactTestRenderer, label: string) {
  return [...tree.root.findAllByType('TouchableOpacity')].reverse().find((node: any) =>
    node.findAllByType('Text').some((textNode: any) => textNode.children.join('').includes(label))
  );
}

describe('HamburgerMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSupabaseConfigured.mockReturnValue(true);
    mockLocalSignOut.mockResolvedValue(undefined);
  });

  it('clears the local Supabase session before navigating when logout times out', async () => {
    mockSignOut.mockImplementation(() => new Promise<void>(() => {}));

    const navigation = { navigate: jest.fn() } as any;

    let tree!: TestRenderer.ReactTestRenderer;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<HamburgerMenu navigation={navigation} user="alice" />);
    });

    const [openMenuButton] = tree.root.findAllByType('TouchableOpacity');
    expect(openMenuButton).toBeTruthy();

    await TestRenderer.act(async () => {
      openMenuButton!.props.onPress();
    });

    const logoutButton = findButtonByText(tree, 'Log Out');
    expect(logoutButton).toBeTruthy();

    await TestRenderer.act(async () => {
      logoutButton!.props.onPress();
    });

    await TestRenderer.act(async () => {
      jest.advanceTimersByTime(3000);
      await Promise.resolve();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockLocalSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(navigation.navigate).toHaveBeenCalledWith('Login');
  });
});
