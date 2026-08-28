const React = require('react');
const TestRenderer = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockFetchPublishedModules = jest.fn();

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
    Platform: { select: (options: Record<string, unknown>) => options.web ?? options.default },
    StyleSheet: { create: (styles: unknown) => styles },
  };
});

jest.mock('../lib/trainingCatalogService', () => ({
  fetchPublishedModules: (...args: unknown[]) => mockFetchPublishedModules(...args),
}));

jest.mock('../lib/checkoutService', () => ({
  openCheckout: jest.fn(),
}));

const PurchasePage = require('../pages/PurchasePage').default;

function collectText(node: any): string[] {
  return node.root
    .findAllByType('Text')
    .map((textNode: any) => textNode.children.join(''));
}

describe('PurchasePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    expect(collectText(tree)).toContain('$19.99');
    expect(collectText(tree)).toContain('Buy Module');
  });
});
