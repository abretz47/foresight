const React = require('react');
const TestRenderer = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockFetchPublishedModules = jest.fn();
const mockHasEntitlement = jest.fn();
const mockOpenCheckout = jest.fn();

jest.mock('react-native', () => {
  const R = require('react');
  const prim = (name: string) => ({ children, ...props }: any) => R.createElement(name, props, children);
  return {
    View: prim('View'),
    Text: prim('Text'),
    Image: prim('Image'),
    TouchableOpacity: prim('TouchableOpacity'),
    ActivityIndicator: prim('ActivityIndicator'),
    StyleSheet: { create: (s: unknown) => s },
    Platform: { OS: 'web', select: (o: any) => o.web ?? o.default },
    FlatList: ({ data, renderItem, ListEmptyComponent }: any) => {
      if (!data || data.length === 0) return ListEmptyComponent ?? null;
      return R.createElement(
        'View',
        {},
        data.map((item: any, index: number) =>
          R.createElement('View', { key: item.slug ?? index }, renderItem({ item, index }))
        )
      );
    },
  };
});

jest.mock('../components/EmojiText', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ children, ...p }: any) => R.createElement(Text, p, children) };
});

jest.mock('../components/PurchasePromptModal', () => ({
  __esModule: true,
  default: ({ visible }: { visible: boolean }) => {
    const R = require('react');
    return visible ? R.createElement('Text', null, 'modal') : null;
  },
}));

jest.mock('../lib/trainingCatalogService', () => ({
  fetchPublishedModules: (...args: unknown[]) => mockFetchPublishedModules(...args),
}));

jest.mock('../lib/entitlementService', () => ({
  hasEntitlement: (...args: unknown[]) => mockHasEntitlement(...args),
}));

jest.mock('../lib/checkoutService', () => ({
  openCheckout: (...args: unknown[]) => mockOpenCheckout(...args),
}));

import TrainingHome from '../pages/TrainingHome';

describe('TrainingHome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPublishedModules.mockResolvedValue([
      {
        id: '1',
        slug: 'with-image',
        title: 'With image',
        description: 'desc',
        thumbnail_url: 'https://example.com/module.png',
        stripe_price_id: 'price_1',
        component_key: 'k1',
        sort_order: 0,
      },
      {
        id: '2',
        slug: 'no-image',
        title: 'No image',
        description: 'desc',
        thumbnail_url: null,
        stripe_price_id: 'price_2',
        component_key: 'k2',
        sort_order: 1,
      },
    ]);
    mockHasEntitlement.mockImplementation(async (key: string) => key === 'training:with-image');
  });

  it('renders module card image when thumbnail_url exists', async () => {
    const navigation = { navigate: jest.fn() } as any;
    const route = { params: { user: 'alice' } } as any;

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<TrainingHome navigation={navigation} route={route} />);
    });

    const images = tree.root.findAllByType('Image');
    const uris = images.map((img: any) => img.props?.source?.uri).filter(Boolean);
    expect(uris).toContain('https://example.com/module.png');
  });

  it('opens checkout for unowned modules on web', async () => {
    const navigation = { navigate: jest.fn() } as any;
    const route = { params: { user: 'alice' } } as any;

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<TrainingHome navigation={navigation} route={route} />);
    });

    const buyButton = tree.root.findAllByType('TouchableOpacity').find((node: any) => {
      const label = node.findAllByType('Text').map((t: any) => t.props.children).join('');
      return label.includes('Buy');
    });

    await TestRenderer.act(async () => {
      buyButton.props.onPress();
    });

    expect(mockOpenCheckout).toHaveBeenCalledWith('price_2');
  });
});
