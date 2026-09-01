import React from 'react';
import TestRenderer from 'react-test-renderer';

const mockFetchPublishedModules = jest.fn();
const mockHasEntitlement = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  const createPrimitive = (name: string) => ({ children, ...props }: any) =>
    React.createElement(name, props, children);
  return {
    View: createPrimitive('View'),
    Text: createPrimitive('Text'),
    ScrollView: createPrimitive('ScrollView'),
    TouchableOpacity: createPrimitive('TouchableOpacity'),
    ActivityIndicator: createPrimitive('ActivityIndicator'),
    Platform: { OS: 'web', select: (options: Record<string, unknown>) => options.web ?? options.default },
    StyleSheet: { create: (styles: unknown) => styles },
  };
});

jest.mock('../lib/trainingCatalogService', () => ({
  fetchPublishedModules: (...args: unknown[]) => mockFetchPublishedModules(...args),
}));

jest.mock('../lib/checkoutService', () => ({
  openCheckout: jest.fn(),
}));

jest.mock('../lib/entitlementService', () => ({
  hasEntitlement: (...args: unknown[]) => mockHasEntitlement(...args),
}));

import PurchasePage from '../pages/PurchasePage';

function collectText(node: any): string[] {
  return node.root
    .findAllByType('Text')
    .map((textNode: any) => textNode.children.join(''));
}

describe('PurchasePage', () => {
  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockHasEntitlement.mockResolvedValue(false);
  });

  it('renders each module display price when provided', async () => {
    mockFetchPublishedModules.mockResolvedValue([
      {
        id: 'module-1',
        slug: 'putting-assessment',
        title: 'Putting Assessment',
        description: 'Sharpen distance control',
        thumbnail_url: null,
        stripe_price_id: 'price_123',
        display_price_cents: 1999,
        display_price_currency: 'USD',
        component_key: 'putting-assessment',
        sort_order: 1,
      },
    ]);

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PurchasePage
          navigation={{ goBack: jest.fn() }}
          route={{ key: 'PurchasePage', name: 'PurchasePage', params: undefined }}
        />
      );
    });

    const expectedPrice = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(19.99);
    expect(collectText(tree)).toContain(expectedPrice);
    expect(collectText(tree)).toContain('Buy Module');
  });

  it('does not render a price when display fields are missing', async () => {
    mockFetchPublishedModules.mockResolvedValue([
      {
        id: 'module-1',
        slug: 'putting-assessment',
        title: 'Putting Assessment',
        description: 'Sharpen distance control',
        thumbnail_url: null,
        stripe_price_id: 'price_123',
        display_price_cents: null,
        display_price_currency: null,
        component_key: 'putting-assessment',
        sort_order: 1,
      },
    ]);

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PurchasePage
          navigation={{ goBack: jest.fn() }}
          route={{ key: 'PurchasePage', name: 'PurchasePage', params: undefined }}
        />
      );
    });

    expect(collectText(tree).some((t: string) => /\p{Sc}\s?\d/u.test(t))).toBe(false);
    expect(collectText(tree)).toContain('Buy Module');
  });

  it('expands checkout area per item when buy button is pressed', async () => {
    mockFetchPublishedModules.mockResolvedValue([
      {
        id: 'module-1',
        slug: 'putting-assessment',
        title: 'Putting Assessment',
        description: 'Sharpen distance control',
        thumbnail_url: null,
        stripe_price_id: 'price_123',
        display_price_cents: 1999,
        display_price_currency: 'USD',
        component_key: 'putting-assessment',
        sort_order: 1,
      },
    ]);

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PurchasePage
          navigation={{ goBack: jest.fn(), navigate: jest.fn() }}
          route={{ key: 'PurchasePage', name: 'PurchasePage', params: undefined }}
        />
      );
    });

    const buyButton = tree.root.findByProps({ children: 'Buy Module' }).parent;
    await TestRenderer.act(async () => {
      buyButton.props.onPress();
    });

    expect(collectText(tree)).toContain('Sign in to start checkout.');
    expect(collectText(tree)).toContain('Go to Login');
  });

  it('redirects to TrainingHome after successful checkout return', async () => {
    const originalWindow = (global as any).window;
    (global as any).window = { location: { search: '?checkout=success&session_id=cs_test' } };
    try {
      mockFetchPublishedModules.mockResolvedValue([
        {
          id: 'module-1',
          slug: 'putting-assessment',
          title: 'Putting Assessment',
          description: 'Sharpen distance control',
          thumbnail_url: null,
          stripe_price_id: 'price_123',
          display_price_cents: 1999,
          display_price_currency: 'USD',
          component_key: 'putting-assessment',
          sort_order: 1,
        },
      ]);

      const replace = jest.fn();
      await TestRenderer.act(async () => {
        TestRenderer.create(
          <PurchasePage
            navigation={{ goBack: jest.fn(), navigate: jest.fn(), replace }}
            route={{ key: 'PurchasePage', name: 'PurchasePage', params: { user: 'alice' } }}
          />
        );
      });

      expect(replace).toHaveBeenCalledWith('TrainingHome', { user: 'alice' });
    } finally {
      (global as any).window = originalWindow;
    }
  });

  it('shows View Module for owned modules and navigates directly to the module', async () => {
    mockFetchPublishedModules.mockResolvedValue([
      {
        id: 'module-1',
        slug: 'putting-assessment',
        title: 'Putting Assessment',
        description: 'Sharpen distance control',
        thumbnail_url: null,
        stripe_price_id: 'price_123',
        display_price_cents: 1999,
        display_price_currency: 'USD',
        component_key: 'putting-assessment',
        sort_order: 1,
      },
    ]);
    mockHasEntitlement.mockResolvedValue(true);

    const navigate = jest.fn();
    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PurchasePage
          navigation={{ goBack: jest.fn(), navigate }}
          route={{ key: 'PurchasePage', name: 'PurchasePage', params: { user: 'alice' } }}
        />
      );
    });

    expect(collectText(tree)).toContain('View Module');
    const viewButton = tree.root.findByProps({ children: 'View Module' }).parent;
    await TestRenderer.act(async () => {
      viewButton.props.onPress();
    });

    expect(navigate).toHaveBeenCalledWith('TrainingModule', {
      user: 'alice',
      slug: 'putting-assessment',
      componentKey: 'putting-assessment',
    });
  });
});
