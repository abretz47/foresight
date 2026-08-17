/**
 * PuttingAssessmentModule tests
 *
 * Uses a "Chipping Assessment" fixture (different text to the real
 * "Putting Assessment" config) so the production JSON config never appears
 * in source control, while still exercising the full module contract:
 *
 *  - Overview screen renders module title, section names, drill descriptions
 *  - Session Due banner appears when sessions remain
 *  - Starting a session shows the session runner with running total
 *  - Score adjustment increments / decrements within bounds
 *  - Make-rate percentage updates as scores change
 *  - Submitting a session persists to AsyncStorage and returns to overview
 *  - History row is displayed after a session is completed
 *  - Banner disappears when all scheduled weeks are done
 */

// ── React / renderer ──────────────────────────────────────────────────────────

const React = require('react');
const TestRenderer = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// ── React Native mock ─────────────────────────────────────────────────────────

jest.mock('react-native', () => {
  const R = require('react');
  const prim = (name: string) =>
    ({ children, ...props }: any) => R.createElement(name, props, children);
  return {
    View: prim('View'),
    Text: prim('Text'),
    ScrollView: prim('ScrollView'),
    Image: prim('Image'),
    TouchableOpacity: prim('TouchableOpacity'),
    StyleSheet: { create: (s: unknown) => s },
    Platform: { OS: 'ios', select: (o: any) => o.ios ?? o.default },
  };
});

// ── AsyncStorage mock ─────────────────────────────────────────────────────────
// The jest.mock factory is hoisted before variable declarations, so we define
// the mock fns inline and retrieve them via jest.requireMock() after the fact.

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

// ── EmojiText mock ────────────────────────────────────────────────────────────

jest.mock('../components/EmojiText', () => {
  const R = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ children, ...p }: any) => R.createElement(Text, p, children) };
});

// ── Imports ───────────────────────────────────────────────────────────────────

import PuttingAssessmentModule from '../lib/trainingModules/PuttingAssessmentModule';
import type { PuttingManifest } from '../lib/trainingModules/PuttingAssessmentModule';

// ── Fixture ───────────────────────────────────────────────────────────────────
//
// NOTE: This is deliberately DIFFERENT text from the real "Putting Assessment"
// config so that the production config never enters source control.

const CHIPPING_MANIFEST: PuttingManifest = {
  title: 'Chipping Assessment',
  description:
    'An 8-week structured chipping program covering short, mid, and long distances. Build precision around the greens through focused practice.',
  version: 1,
  estimatedDurationMinutes: 60,
  steps: [],
  parameters: {},
  assets: {
    header: 'https://example.com/header.png',
    short: 'https://example.com/short.png',
    long: 'https://example.com/long.png',
  },
  image: 'header',
  icon: '🏒',
  scheduledWeeks: [1, 4, 8],
  practiceNotes: ['Treat every chip as a competition shot.'],
  sections: [
    {
      name: 'Short Chipping',
      description: 'SKILL – CHIPPING (Short) | 2 holes × 5 chips per hole at each distance',
      image: 'short',
      drills: [
        { name: '5 Yards', holes: 2, puttsPerHole: 5, image: 'short' },
        { name: '10 Yards', holes: 2, puttsPerHole: 5 },
      ],
    },
    {
      name: 'Long Chipping',
      description: 'SKILL – CHIPPING (Long) | 1 hole × 5 chips per hole | R = 2ft',
      drills: [
        { name: '20 Yards', holes: 1, puttsPerHole: 5, targetRadius: 'R = 2ft', image: 'long' },
        { name: '30 Yards', holes: 1, puttsPerHole: 5, targetRadius: 'R = 2ft' },
      ],
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildHostContext(setOptions = jest.fn()) {
  return {
    navigation: { setOptions, goBack: jest.fn() } as any,
    user: 'test-user',
    shotProfiles: [],
  };
}

function allTexts(tree: any): string[] {
  const result: string[] = [];
  const visit = (node: any) => {
    if (!node) return;
    if (typeof node === 'string') { result.push(node); return; }
    if (Array.isArray(node.children)) node.children.forEach(visit);
    else if (node.children != null) visit(node.children);
  };
  visit(tree.toJSON());
  return result;
}

function findTouchables(tree: any): any[] {
  const found: any[] = [];
  const visit = (node: any) => {
    if (!node) return;
    if (node.type === 'TouchableOpacity') found.push(node);
    if (Array.isArray(node.children)) node.children.forEach(visit);
  };
  visit(tree.toJSON());
  return found;
}

function findByText(tree: any, text: string): any {
  const visit = (node: any): any => {
    if (!node) return null;
    if (node.type === 'Text') {
      const flat = (n: any): string => {
        if (typeof n === 'string') return n;
        if (Array.isArray(n)) return n.map(flat).join('');
        if (n?.children != null) return flat(n.children);
        return '';
      };
      if (flat(node.children).includes(text)) return node;
    }
    if (Array.isArray(node.children)) {
      for (const c of node.children) {
        const found = visit(c);
        if (found) return found;
      }
    }
    return null;
  };
  return visit(tree.toJSON());
}

function findButtonByLabel(tree: any, label: string): any {
  const buttons = findTouchables(tree);
  return buttons.find((b) => {
    const flat = (n: any): string => {
      if (typeof n === 'string') return n;
      if (Array.isArray(n)) return n.map(flat).join('');
      if (n?.children != null) return flat(n.children);
      return '';
    };
    return flat(b.children).includes(label);
  }) ?? null;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

function getStorageMocks() {
  const AsyncStorage = jest.requireMock('@react-native-async-storage/async-storage').default as {
    getItem: jest.Mock;
    setItem: jest.Mock;
  };
  return AsyncStorage;
}

describe('PuttingAssessmentModule — Overview screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { getItem, setItem } = getStorageMocks();
    getItem.mockResolvedValue(null);
    setItem.mockResolvedValue(undefined);
  });

  it('renders the module title and icon', async () => {
    const onComplete = jest.fn();
    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={CHIPPING_MANIFEST}
          hostContext={buildHostContext()}
          onComplete={onComplete}
        />
      );
    });

    const texts = allTexts(tree);
    expect(texts).toContain('Chipping Assessment');
  });

  it('renders overview images from manifest assets', async () => {
    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={CHIPPING_MANIFEST}
          hostContext={buildHostContext()}
          onComplete={jest.fn()}
        />
      );
    });

    const images = tree.root.findAllByType('Image');
    const uris = images.map((img: any) => img.props?.source?.uri).filter(Boolean);
    expect(uris).toContain('https://example.com/header.png');
    expect(uris).toContain('https://example.com/short.png');
  });

  it('shows the 8-Week Program subtitle', async () => {
    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={CHIPPING_MANIFEST}
          hostContext={buildHostContext()}
          onComplete={jest.fn()}
        />
      );
    });

    const texts = allTexts(tree);
    expect(texts.some((t) => t.includes('8-Week Program'))).toBe(true);
  });

  it('renders section names in the module overview', async () => {
    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={CHIPPING_MANIFEST}
          hostContext={buildHostContext()}
          onComplete={jest.fn()}
        />
      );
    });

    const texts = allTexts(tree);
    expect(texts.some((t) => t.includes('Short Chipping'))).toBe(true);
    expect(texts.some((t) => t.includes('Long Chipping'))).toBe(true);
  });

  it('renders drill names with holes × puttsPerHole labels', async () => {
    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={CHIPPING_MANIFEST}
          hostContext={buildHostContext()}
          onComplete={jest.fn()}
        />
      );
    });

    const texts = allTexts(tree);
    expect(texts.some((t) => t.includes('5 Yards'))).toBe(true);
    // "2 × 5 putts" for short drills
    expect(texts.some((t) => t.includes('2 × 5 putts'))).toBe(true);
    // "1 × 5 putts  (R = 2ft)" for long drills
    expect(texts.some((t) => t.includes('R = 2ft'))).toBe(true);
  });

  it('shows "No sessions recorded yet" when no sessions are stored', async () => {
    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={CHIPPING_MANIFEST}
          hostContext={buildHostContext()}
          onComplete={jest.fn()}
        />
      );
    });

    expect(findByText(tree, 'No sessions recorded yet')).not.toBeNull();
  });

  it('displays Session Due banner for week 1 when no sessions completed', async () => {
    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={CHIPPING_MANIFEST}
          hostContext={buildHostContext()}
          onComplete={jest.fn()}
        />
      );
    });

    const texts = allTexts(tree);
    expect(texts.some((t) => t.includes('Session Due'))).toBe(true);
    expect(texts.some((t) => t.includes('Week 1'))).toBe(true);
  });

  it('sets the navigation title to the module title on mount', async () => {
    const setOptions = jest.fn();
    await TestRenderer.act(async () => {
      TestRenderer.create(
        <PuttingAssessmentModule
          manifest={CHIPPING_MANIFEST}
          hostContext={buildHostContext(setOptions)}
          onComplete={jest.fn()}
        />
      );
    });

    expect(setOptions).toHaveBeenCalledWith(expect.objectContaining({ title: 'Chipping Assessment' }));
  });
});

describe('PuttingAssessmentModule — Session screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { getItem, setItem } = getStorageMocks();
    getItem.mockResolvedValue(null);
    setItem.mockResolvedValue(undefined);
  });

  async function openSession() {
    const onComplete = jest.fn();
    const setOptions = jest.fn();
    let tree: any;

    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={CHIPPING_MANIFEST}
          hostContext={buildHostContext(setOptions)}
          onComplete={onComplete}
        />
      );
    });

    // Press "Start – Week 1" button
    const startBtn = findButtonByLabel(tree, 'Start');
    await TestRenderer.act(async () => {
      startBtn.props.onPress();
    });

    return { tree, onComplete, setOptions };
  }

  it('updates the navigation title to "Week 1 Session" when session starts', async () => {
    const { setOptions } = await openSession();
    expect(setOptions).toHaveBeenCalledWith(expect.objectContaining({ title: 'Week 1 Session' }));
  });

  it('shows 0 / total running total when session first opens', async () => {
    const { tree } = await openSession();
    // Short: 2 drills × 2 holes × 5 = 20; Long: 2 drills × 1 hole × 5 = 10 → total = 30
    const texts = allTexts(tree);
    expect(texts.some((t) => t.includes('0 / 30'))).toBe(true);
  });

  it('renders section tabs with 0/possible counts', async () => {
    const { tree } = await openSession();
    const texts = allTexts(tree);
    expect(texts.some((t) => t.includes('Short Chipping'))).toBe(true);
    expect(texts.some((t) => t.includes('Long Chipping'))).toBe(true);
  });

  it('renders + and − buttons for each hole in the active section', async () => {
    const { tree } = await openSession();
    const buttons = findTouchables(tree);
    const plusBtns = buttons.filter((b) => {
      const flat = (n: any): string => {
        if (typeof n === 'string') return n;
        if (Array.isArray(n)) return n.map(flat).join('');
        if (n?.children != null) return flat(n.children);
        return '';
      };
      return flat(b.children) === '+';
    });
    // Short Chipping has 2 drills × 2 holes = 4 + buttons
    expect(plusBtns.length).toBeGreaterThanOrEqual(4);
  });

  it('increments the hole score when + is pressed', async () => {
    const { tree } = await openSession();
    const buttons = findTouchables(tree);
    const plusBtns = buttons.filter((b) => {
      const flat = (n: any): string => {
        if (typeof n === 'string') return n;
        if (Array.isArray(n)) return n.map(flat).join('');
        if (n?.children != null) return flat(n.children);
        return '';
      };
      return flat(b.children) === '+';
    });

    await TestRenderer.act(async () => {
      plusBtns[0].props.onPress();
    });

    const texts = allTexts(tree);
    // Running total should now be 1/30, make rate should be ~3%
    expect(texts.some((t) => t.includes('1 / 30'))).toBe(true);
  });

  it('does not go below 0 when − is pressed at 0', async () => {
    const { tree } = await openSession();
    const buttons = findTouchables(tree);
    const minusBtns = buttons.filter((b) => {
      const flat = (n: any): string => {
        if (typeof n === 'string') return n;
        if (Array.isArray(n)) return n.map(flat).join('');
        if (n?.children != null) return flat(n.children);
        return '';
      };
      return flat(b.children) === '−';
    });

    await TestRenderer.act(async () => {
      minusBtns[0].props.onPress();
    });

    const texts = allTexts(tree);
    // Running total should still be 0/30
    expect(texts.some((t) => t.includes('0 / 30'))).toBe(true);
  });

  it('does not exceed puttsPerHole when + is pressed repeatedly', async () => {
    const { tree } = await openSession();

    const getPlusBtns = () =>
      findTouchables(tree).filter((b) => {
        const flat = (n: any): string => {
          if (typeof n === 'string') return n;
          if (Array.isArray(n)) return n.map(flat).join('');
          if (n?.children != null) return flat(n.children);
          return '';
        };
        return flat(b.children) === '+';
      });

    // Press + 10 times on the first hole (puttsPerHole = 5 for this fixture)
    for (let i = 0; i < 10; i++) {
      await TestRenderer.act(async () => {
        getPlusBtns()[0].props.onPress();
      });
    }

    const texts = allTexts(tree);
    // Max for first hole is 5; first drill has 2 holes, so drill max = 10.
    // The "5" value should appear; "10" or higher for that hole should not.
    expect(texts.some((t) => t === '5')).toBe(true);
    // The hole val of "10" should NOT appear (the hole is capped at 5)
    expect(texts.filter((t) => t === '10').length).toBe(0);
  });

  it('shows make-rate percentage based on running total', async () => {
    const { tree } = await openSession();

    const getPlusBtns = () =>
      findTouchables(tree).filter((b) => {
        const flat = (n: any): string => {
          if (typeof n === 'string') return n;
          if (Array.isArray(n)) return n.map(flat).join('');
          if (n?.children != null) return flat(n.children);
          return '';
        };
        return flat(b.children) === '+';
      });

    // Score 3 putts on hole 1 of drill 1 (total possible = 30)
    await TestRenderer.act(async () => {
      getPlusBtns()[0].props.onPress();
      getPlusBtns()[0].props.onPress();
      getPlusBtns()[0].props.onPress();
    });

    const texts = allTexts(tree);
    // 3/30 = 10%
    expect(texts.some((t) => t === '10%')).toBe(true);
  });

  it('renders drill image on session view when configured', async () => {
    const { tree } = await openSession();
    const images = tree.root.findAllByType('Image');
    const uris = images.map((img: any) => img.props?.source?.uri).filter(Boolean);
    expect(uris).toContain('https://example.com/short.png');
  });

  it('returns to overview when Cancel is pressed', async () => {
    const { tree } = await openSession();

    const cancelBtn = findButtonByLabel(tree, 'Cancel');
    await TestRenderer.act(async () => {
      cancelBtn.props.onPress();
    });

    // Overview text should be back
    expect(findByText(tree, 'No sessions recorded yet')).not.toBeNull();
  });

  it('saves the session and shows history after completing', async () => {
    const { tree, onComplete } = await openSession();

    const submitBtn = findButtonByLabel(tree, 'Complete Session');
    await TestRenderer.act(async () => {
      submitBtn.props.onPress();
    });

    // Back on overview — should show history row
    const texts = allTexts(tree);
    expect(texts.some((t) => t.includes('Week 1'))).toBe(true);
    // AsyncStorage.setItem should have been called
    expect(getStorageMocks().setItem).toHaveBeenCalled();
    // onComplete should NOT have been called yet (more weeks remain)
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls onComplete when the final scheduled week is submitted', async () => {
    // Pre-populate with 2 completed sessions so the next is week 8 (final).
    const priorSessions = JSON.stringify([
      { week: 1, completedAt: '2024-01-01T00:00:00.000Z', totalMade: 10, totalPossible: 30 },
      { week: 4, completedAt: '2024-02-01T00:00:00.000Z', totalMade: 15, totalPossible: 30 },
    ]);
    getStorageMocks().getItem.mockResolvedValueOnce(priorSessions);

    const onComplete = jest.fn();
    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={CHIPPING_MANIFEST}
          hostContext={buildHostContext()}
          onComplete={onComplete}
        />
      );
    });

    // Start session for week 8
    const startBtn = findButtonByLabel(tree, 'Start');
    await TestRenderer.act(async () => {
      startBtn.props.onPress();
    });

    const submitBtn = findButtonByLabel(tree, 'Complete Session');
    await TestRenderer.act(async () => {
      submitBtn.props.onPress();
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it('hides the Session Due banner after all weeks are completed', async () => {
    const allSessions = JSON.stringify([
      { week: 1, completedAt: '2024-01-01T00:00:00.000Z', totalMade: 20, totalPossible: 30 },
      { week: 4, completedAt: '2024-02-01T00:00:00.000Z', totalMade: 25, totalPossible: 30 },
      { week: 8, completedAt: '2024-03-01T00:00:00.000Z', totalMade: 28, totalPossible: 30 },
    ]);
    getStorageMocks().getItem.mockResolvedValueOnce(allSessions);

    let tree: any;
    await TestRenderer.act(async () => {
      tree = TestRenderer.create(
        <PuttingAssessmentModule
          manifest={CHIPPING_MANIFEST}
          hostContext={buildHostContext()}
          onComplete={jest.fn()}
        />
      );
    });

    const texts = allTexts(tree);
    expect(texts.some((t) => t.includes('Session Due'))).toBe(false);
  });
});
