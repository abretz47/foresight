const React = require('react');
const TestRenderer = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockFetchLatestTrainingModuleAssessment = jest.fn();
const mockSaveTrainingModuleAssessment = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  const createPrimitive = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
  return {
    View: createPrimitive('View'),
    Text: createPrimitive('Text'),
    ScrollView: createPrimitive('ScrollView'),
    TouchableOpacity: createPrimitive('TouchableOpacity'),
    ActivityIndicator: createPrimitive('ActivityIndicator'),
    Platform: {
      OS: 'ios',
      select: (options: Record<string, unknown>) => options.ios ?? options.default,
    },
    StyleSheet: { create: (styles: unknown) => styles },
  };
});

jest.mock('../lib/trainingModuleAssessmentService', () => ({
  fetchLatestTrainingModuleAssessment: (...args: unknown[]) => mockFetchLatestTrainingModuleAssessment(...args),
  saveTrainingModuleAssessment: (...args: unknown[]) => mockSaveTrainingModuleAssessment(...args),
}));

const { PuttingAssessmentModule } = require('../modules/training/PuttingAssessmentModule');

describe('PuttingAssessmentModule', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchLatestTrainingModuleAssessment.mockResolvedValue(null);
    mockSaveTrainingModuleAssessment.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders session drills from manifest and starts a session', async () => {
    const navigation = { navigate: jest.fn() };
    const manifest = {
      title: 'Putting Assessment',
      description: 'desc',
      version: 1,
      estimatedDurationMinutes: 10,
      steps: [],
      parameters: {
        sessions: [
          {
            id: 'week-1',
            title: 'Week 1',
            drills: [{ id: 'd1', title: '3ft Baseline', club: 'Putter' }],
          },
        ],
      },
      assets: {},
    };

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={manifest}
          moduleSlug="putting-assessment"
          onComplete={jest.fn()}
          hostContext={{
            navigation,
            user: 'user-1',
            shotProfiles: [{ id: 'p1', name: 'Putter', distance: '10', targetRadius: '2', missRadius: '4' }],
          }}
        />
      );
    });

    const startButton = tree.root.findAllByType('TouchableOpacity').find((node: any) =>
      node.findAllByType('Text').some((textNode: any) => textNode.props.children === 'Start Session')
    );
    expect(startButton).toBeTruthy();
    await TestRenderer.act(async () => {
      startButton.props.onPress();
    });
    expect(navigation.navigate).toHaveBeenCalledWith('Record', expect.objectContaining({ shotName: 'Putter' }));
  });

  it('shows unavailable message when no questions and no sessions exist', async () => {
    const navigation = { navigate: jest.fn() };
    const manifest = {
      title: 'Putting Assessment',
      description: 'desc',
      version: 1,
      estimatedDurationMinutes: 10,
      steps: [],
      parameters: {},
      assets: {},
    };

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={manifest}
          moduleSlug="putting-assessment"
          onComplete={jest.fn()}
          hostContext={{
            navigation,
            user: 'user-1',
            shotProfiles: [{ id: 'p1', name: 'Putter', distance: '10', targetRadius: '2', missRadius: '4' }],
          }}
        />
      );
    });

    expect(tree.root.findAllByType('Text').some((node: any) =>
      node.props.children === 'Assessment configuration is unavailable for this module.'
    )).toBe(true);
  });
});
