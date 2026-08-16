const React = require('react');
const TestRenderer = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockFetchManifest = jest.fn();
const mockResolveModule = jest.fn();
const mockGetShotProfileAsync = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  const createPrimitive = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
  return {
    View: createPrimitive('View'),
    Text: createPrimitive('Text'),
    TouchableOpacity: createPrimitive('TouchableOpacity'),
    ActivityIndicator: createPrimitive('ActivityIndicator'),
    Platform: {
      OS: 'ios',
      select: (options: Record<string, unknown>) => options.ios ?? options.default,
    },
    StyleSheet: { create: (styles: unknown) => styles },
  };
});

jest.mock('../lib/trainingConfigService', () => ({
  fetchManifest: (...args: unknown[]) => mockFetchManifest(...args),
}));

jest.mock('../lib/trainingModuleRegistry', () => ({
  resolveModule: (...args: unknown[]) => mockResolveModule(...args),
}));

jest.mock('../data/db', () => ({
  getShotProfileAsync: (...args: unknown[]) => mockGetShotProfileAsync(...args),
}));

const { Text } = require('react-native');
const DrillRunner = require('../pages/DrillRunner').default;
const { useTrainingHostContext } = require('../lib/trainingHostContext');

let capturedPropContext: { user: string; shotProfiles: Array<{ name: string }> } | null = null;
let capturedProviderContext: { user: string; shotProfiles: Array<{ name: string }> } | null = null;

function MockModule({ hostContext, manifest }: { hostContext: { user: string; shotProfiles: Array<{ name: string }> }; manifest: { title: string } }) {
  const ctx = useTrainingHostContext();
  capturedPropContext = hostContext;
  capturedProviderContext = ctx;
  return (
    <Text>
      {manifest.title}
    </Text>
  );
}

describe('DrillRunner', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    capturedPropContext = null;
    capturedProviderContext = null;
    mockFetchManifest.mockResolvedValue({
      title: 'Test Drill',
      description: 'desc',
      version: 1,
      steps: [],
      parameters: {},
      assets: {},
    });
    mockGetShotProfileAsync.mockResolvedValue([
      { id: '1', name: 'Driver', distance: '250', targetRadius: '15', missRadius: '30' },
      { id: '2', name: 'Wedge', distance: '100', targetRadius: '8', missRadius: '15' },
    ]);
    mockResolveModule.mockReturnValue(MockModule);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('provides the user shot profiles to the module host context', async () => {
    const navigation = { goBack: jest.fn() } as any;
    const route = {
      params: { user: 'user-1', slug: 'test-drill', componentKey: 'test-drill' },
    } as any;

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<DrillRunner navigation={navigation} route={route} />);
    });

    expect(tree.root.findAllByType('Text').some((node: any) => node.props.children === 'Test Drill')).toBe(true);
    expect(capturedPropContext).toMatchObject({
      user: 'user-1',
      shotProfiles: [{ name: 'Driver' }, { name: 'Wedge' }],
    });
    expect(capturedProviderContext).toMatchObject({
      user: 'user-1',
      shotProfiles: [{ name: 'Driver' }, { name: 'Wedge' }],
    });

    expect(mockFetchManifest).toHaveBeenCalledWith('test-drill');
    expect(mockGetShotProfileAsync).toHaveBeenCalledWith('user-1');
  });
});
