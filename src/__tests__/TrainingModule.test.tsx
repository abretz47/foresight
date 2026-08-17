const React = require('react');
const TestRenderer = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockFetchPublishedModules = jest.fn();
const mockHasEntitlement = jest.fn();
const mockResolveModuleDetails = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  const createPrimitive = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
  return {
    View: createPrimitive('View'),
    Text: createPrimitive('Text'),
    ActivityIndicator: createPrimitive('ActivityIndicator'),
    Platform: {
      OS: 'ios',
      select: (options: Record<string, unknown>) => options.ios ?? options.default,
    },
    StyleSheet: { create: (styles: unknown) => styles },
  };
});

jest.mock('../lib/trainingCatalogService', () => ({
  fetchPublishedModules: (...args: unknown[]) => mockFetchPublishedModules(...args),
}));

jest.mock('../lib/entitlementService', () => ({
  hasEntitlement: (...args: unknown[]) => mockHasEntitlement(...args),
}));

jest.mock('../lib/trainingModuleRegistry', () => ({
  resolveModuleDetails: (...args: unknown[]) => mockResolveModuleDetails(...args),
}));

jest.mock('../components/TrainingModuleDetails', () => ({
  __esModule: true,
  default: ({ module }: { module: { slug: string } }) => {
    const React = require('react');
    return React.createElement('Text', null, `default:${module.slug}`);
  },
}));

const TrainingModule = require('../pages/TrainingModule').default;

describe('TrainingModule', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchPublishedModules.mockResolvedValue([
      {
        id: 'module-1',
        slug: 'putting-assessment',
        title: 'Putting Assessment',
        description: 'desc',
        thumbnail_url: null,
        stripe_price_id: null,
        component_key: 'academy-putting-v2',
        sort_order: 1,
      },
    ]);
    mockHasEntitlement.mockResolvedValue(true);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders module-specific details when registered for component key', async () => {
    const CustomDetails = ({ module }: { module: { slug: string } }) => React.createElement('Text', null, `custom:${module.slug}`);
    mockResolveModuleDetails.mockReturnValueOnce(CustomDetails);
    const navigation = { navigate: jest.fn() } as any;
    const route = { params: { user: 'user-1', slug: 'putting-assessment' } } as any;

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<TrainingModule navigation={navigation} route={route} />);
    });

    expect(tree.root.findAllByType('Text').some((node: any) => node.props.children === 'custom:putting-assessment')).toBe(true);
    expect(mockResolveModuleDetails).toHaveBeenCalledWith('academy-putting-v2');
  });

  it('falls back to default details when no module-specific details are registered', async () => {
    mockResolveModuleDetails.mockReturnValue(undefined);
    const navigation = { navigate: jest.fn() } as any;
    const route = { params: { user: 'user-1', slug: 'putting-assessment' } } as any;

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<TrainingModule navigation={navigation} route={route} />);
    });

    expect(tree.root.findAllByType('Text').some((node: any) => node.props.children === 'default:putting-assessment')).toBe(true);
    expect(mockResolveModuleDetails).toHaveBeenNthCalledWith(1, 'academy-putting-v2');
    expect(mockResolveModuleDetails).toHaveBeenNthCalledWith(2, 'putting-assessment');
  });
});
