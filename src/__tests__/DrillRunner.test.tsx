const React = require('react');
const TestRenderer = require('react-test-renderer');

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

function MockModule({ hostContext, manifest }: { hostContext: { user: string; shotProfiles: Array<{ name: string }> }; manifest: { title: string } }) {
  const ctx = useTrainingHostContext();
  return (
    <Text>
      {manifest.title}|{hostContext.user}|{hostContext.shotProfiles.map((shot) => shot.name).join(',')}|
      {ctx.shotProfiles.map((shot) => shot.name).join(',')}
    </Text>
  );
}

describe('DrillRunner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('provides the user shot profiles to the module host context', async () => {
    const navigation = { goBack: jest.fn() } as any;
    const route = {
      params: { user: 'user-1', slug: 'test-drill', componentKey: 'test-drill' },
    } as any;

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(<DrillRunner navigation={navigation} route={route} />);
    });

    const textNodes = tree.root.findAllByType('Text');
    expect(textNodes.some((node: any) => node.props.children.join('') === 'Test Drill|user-1|Driver,Wedge|Driver,Wedge')).toBe(true);

    expect(mockFetchManifest).toHaveBeenCalledWith('test-drill');
    expect(mockGetShotProfileAsync).toHaveBeenCalledWith('user-1');
  });
});
