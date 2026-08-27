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

function createManifest() {
  return {
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
}

function createHostContext() {
  return {
    navigation: { goBack: jest.fn() },
    user: 'user-1',
    shotProfiles: [],
    onBack: jest.fn(),
    onComplete: jest.fn(),
  };
}

function findButtonByText(tree: any, label: string) {
  return tree.root.findAllByType('TouchableOpacity').find((node: any) =>
    node.findAllByType('Text').some((textNode: any) => textNode.children.join('').includes(label))
  );
}

describe('PuttingAssessmentModule', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.clearAllMocks();
    mockGetSessionsForModule.mockResolvedValue([]);
    mockSaveSession.mockResolvedValue(undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('starts a local active session when Start Session is tapped', async () => {
    const onStartSession = jest.fn();
    const onComplete = jest.fn();
    const hostContext = createHostContext();

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={createManifest()}
          hostContext={hostContext}
          onComplete={onComplete}
          onStartSession={onStartSession}
        />
      );
    });

    const startButton = findButtonByText(tree, 'Start – Week 1');
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
    expect(tree.root.findAllByType('Text').some((node: any) => node.children.join('').includes('Record your results below'))).toBe(true);
  });

  it('saves an incomplete session and shows it as resumable', async () => {
    const hostContext = createHostContext();

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={createManifest()}
          hostContext={hostContext}
          onComplete={jest.fn()}
        />
      );
    });

    await TestRenderer.act(async () => {
      findButtonByText(tree, 'Start – Week 1').props.onPress();
    });

    await TestRenderer.act(async () => {
      findButtonByText(tree, '+').props.onPress();
    });

    await TestRenderer.act(async () => {
      await findButtonByText(tree, 'Save & Resume Later').props.onPress();
    });

    expect(mockSaveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'generated-session-id',
        drillResults: [
          expect.objectContaining({
            sectionName: 'Short Putting',
            drillName: '3 Feet',
            holeScores: [1],
          }),
        ],
      })
    );
    expect(tree.root.findAllByType('Text').some((node: any) => node.children.join('').includes('Resume Saved Session'))).toBe(true);
    expect(findButtonByText(tree, 'Resume Week 1')).toBeTruthy();
  });

  it('resumes a saved incomplete session', async () => {
    mockGetSessionsForModule.mockResolvedValue([
      {
        id: 'draft-1',
        moduleId: 'putting-assessment',
        startedAt: '2026-08-27T00:00:00.000Z',
        weekNumber: 1,
        drillResults: [{ sectionName: 'Short Putting', drillName: '3 Feet', holeScores: [2], totalPotential: 10 }],
      },
    ]);

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={createManifest()}
          hostContext={createHostContext()}
          onComplete={jest.fn()}
        />
      );
    });

    await TestRenderer.act(async () => {
      findButtonByText(tree, 'Resume Week 1').props.onPress();
    });

    expect(tree.root.findAllByType('Text').some((node: any) => node.children.join('').includes('Week 1 — Record your results below'))).toBe(true);
    expect(tree.root.findAllByType('Text').some((node: any) => node.children.join('') === '2')).toBe(true);
  });

  it('allows editing a completed session', async () => {
    mockGetSessionsForModule.mockResolvedValue([
      {
        id: 'completed-1',
        moduleId: 'putting-assessment',
        startedAt: '2026-08-27T00:00:00.000Z',
        completedAt: '2026-08-27T00:15:00.000Z',
        weekNumber: 1,
        drillResults: [{ sectionName: 'Short Putting', drillName: '3 Feet', holeScores: [3], totalPotential: 10 }],
      },
    ]);

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={createManifest()}
          hostContext={createHostContext()}
          onComplete={jest.fn()}
        />
      );
    });

    await TestRenderer.act(async () => {
      findButtonByText(tree, 'Edit Session').props.onPress();
    });

    expect(tree.root.findAllByType('Text').some((node: any) => node.children.join('').includes('Week 1 — Record your results below'))).toBe(true);
    expect(tree.root.findAllByType('Text').some((node: any) => node.children.join('') === '3')).toBe(true);

    await TestRenderer.act(async () => {
      await findButtonByText(tree, 'Save Changes').props.onPress();
    });

    expect(mockSaveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'completed-1',
        completedAt: '2026-08-27T00:15:00.000Z',
        drillResults: [
          expect.objectContaining({
            holeScores: [3],
          }),
        ],
      })
    );
  });
});
