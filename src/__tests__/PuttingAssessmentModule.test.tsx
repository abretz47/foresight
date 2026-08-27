const React = require('react');
const TestRenderer = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mockGetSessionsForModule = jest.fn();
const mockSaveSession = jest.fn();
const mockGenerateId = jest.fn(() => 'generated-session-id');

jest.mock('react-native', () => {
  const React = require('react');
  const createPrimitive = (name: string) => ({ children, ...props }: any) => React.createElement(name, props, children);
  return {
    ScrollView: createPrimitive('ScrollView'),
    View: createPrimitive('View'),
    Text: createPrimitive('Text'),
    TouchableOpacity: createPrimitive('TouchableOpacity'),
    StyleSheet: { create: (styles: unknown) => styles },
  };
});

jest.mock('../services/sessionService', () => ({
  getSessionsForModule: (...args: unknown[]) => mockGetSessionsForModule(...args),
  saveSession: (...args: unknown[]) => mockSaveSession(...args),
  generateId: (...args: unknown[]) => mockGenerateId(...args),
}));

const PuttingAssessmentModule = require('../components/PuttingAssessmentModule').default;

describe('PuttingAssessmentModule', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.clearAllMocks();
    mockGetSessionsForModule.mockResolvedValue([]);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('starts a local active session when Start Session is tapped', async () => {
    const onStartSession = jest.fn();
    const onComplete = jest.fn();
    const hostContext = {
      navigation: { goBack: jest.fn() },
      user: 'user-1',
      shotProfiles: [],
      onBack: jest.fn(),
      onComplete: jest.fn(),
    };
    const manifest = {
      id: 'putting-assessment',
      name: 'Putting Assessment',
      title: 'Putting Assessment',
      description: 'desc',
      icon: '⛳',
      scheduledWeeks: [1],
      version: 1,
      estimatedDurationMinutes: 20,
      steps: [
        {
          id: 'short-putting',
          name: 'Short Putting',
          instruction: 'Start',
          completionCriteria: 'manual',
          drills: [{ name: '3 Feet', holes: 1, puttsPerHole: 10 }],
        },
      ],
      parameters: {},
      assets: {},
    };

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={manifest}
          hostContext={hostContext}
          onComplete={onComplete}
          onStartSession={onStartSession}
        />
      );
    });

    const startButton = tree.root.findAllByType('TouchableOpacity').find((node: any) =>
      node.findAllByType('Text').some((textNode: any) => textNode.children.join('').includes('Start – Week 1'))
    );

    expect(startButton).toBeTruthy();

    await TestRenderer.act(async () => {
      startButton.props.onPress();
    });

    expect(onStartSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'generated-session-id',
        moduleId: 'putting-assessment',
        weekNumber: 1,
      })
    );
    expect(
      tree.root.findAllByType('Text').some((node: any) =>
        node.children.join('').includes('Record your results below')
      )
    ).toBe(true);
  });
});
