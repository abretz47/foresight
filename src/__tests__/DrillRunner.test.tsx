import React from 'react';
import { Text } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import DrillRunner from '../pages/DrillRunner';
import { useTrainingHostContext } from '../lib/trainingHostContext';

const fetchManifest = jest.fn();
const resolveModule = jest.fn();
const getShotProfileAsync = jest.fn();

jest.mock('../lib/trainingConfigService', () => ({
  fetchManifest: (...args: unknown[]) => fetchManifest(...args),
}));

jest.mock('../lib/trainingModuleRegistry', () => ({
  resolveModule: (...args: unknown[]) => resolveModule(...args),
}));

jest.mock('../data/db', () => ({
  getShotProfileAsync: (...args: unknown[]) => getShotProfileAsync(...args),
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
    fetchManifest.mockResolvedValue({
      title: 'Test Drill',
      description: 'desc',
      version: 1,
      steps: [],
      parameters: {},
      assets: {},
    });
    getShotProfileAsync.mockResolvedValue([
      { id: '1', name: 'Driver', distance: '250', targetRadius: '15', missRadius: '30' },
      { id: '2', name: 'Wedge', distance: '100', targetRadius: '8', missRadius: '15' },
    ]);
    resolveModule.mockReturnValue(MockModule);
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

    expect(fetchManifest).toHaveBeenCalledWith('test-drill');
    expect(getShotProfileAsync).toHaveBeenCalledWith('user-1');
  });
});
