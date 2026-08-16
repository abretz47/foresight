(globalThis as any).__DEV__ = true;

const React = require('react');
const { Text } = require('react-native');
const { render, waitFor } = require('@testing-library/react-native');
const DrillRunner = require('../pages/DrillRunner').default;
const { useTrainingHostContext } = require('../lib/trainingHostContext');

const mockFetchManifest = jest.fn();
const mockResolveModule = jest.fn();
const mockGetShotProfileAsync = jest.fn();

jest.mock('../lib/trainingConfigService', () => ({
  fetchManifest: (...args: unknown[]) => mockFetchManifest(...args),
}));

jest.mock('../lib/trainingModuleRegistry', () => ({
  resolveModule: (...args: unknown[]) => mockResolveModule(...args),
}));

jest.mock('../data/db', () => ({
  getShotProfileAsync: (...args: unknown[]) => mockGetShotProfileAsync(...args),
}));

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

    const screen = render(<DrillRunner navigation={navigation} route={route} />);

    await waitFor(() => {
      expect(screen.getByText('Test Drill|user-1|Driver,Wedge|Driver,Wedge')).toBeTruthy();
    });

    expect(mockFetchManifest).toHaveBeenCalledWith('test-drill');
    expect(mockGetShotProfileAsync).toHaveBeenCalledWith('user-1');
  });
});
