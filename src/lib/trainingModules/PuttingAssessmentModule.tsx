/**
 * PuttingAssessmentModule
 *
 * Renders a multi-week putting assessment program loaded from a DrillManifest.
 * Expects the manifest to carry the following extra fields (on top of the
 * standard DrillManifest shape):
 *
 *   icon?          — emoji icon displayed in the header
 *   scheduledWeeks — array of week numbers when sessions are due (e.g. [1,4,8,12])
 *   practiceNotes? — array of instructional strings shown on the session screen
 *   sections       — array of PuttingSection objects (see below)
 *
 * Each PuttingSection:
 *   name           — display name (e.g. "Short Putting")
 *   description    — subtitle / instruction string
 *   drills         — array of PuttingDrill objects
 *
 * Each PuttingDrill:
 *   name           — display name (e.g. "3 Feet / 1 Metre")
 *   holes          — number of holes to record (counter columns)
 *   puttsPerHole   — maximum putts per hole (used for display and clamping)
 *   targetRadius?  — optional label (e.g. "R = 3ft/1m") shown alongside the count
 *
 * The component is registered externally (e.g. in trainingModuleRegistry.proprietary.ts)
 * so that the JSON config never needs to live in source control.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../styles/styles';
import EmojiText from '../../components/EmojiText';
import type { TrainingModuleProps } from '../trainingModuleRegistry';
import type { DrillManifest } from '../trainingConfigService';

// ── Domain types ──────────────────────────────────────────────────────────────

export interface PuttingDrill {
  name: string;
  holes: number;
  puttsPerHole: number;
  targetRadius?: string;
}

export interface PuttingSection {
  name: string;
  description: string;
  drills: PuttingDrill[];
}

export interface PuttingManifest extends DrillManifest {
  icon?: string;
  scheduledWeeks?: number[];
  practiceNotes?: string[];
  sections?: PuttingSection[];
}

interface CompletedSession {
  week: number;
  completedAt: string;
  totalMade: number;
  totalPossible: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function storageKey(manifest: PuttingManifest): string {
  return `@foresight/putting_sessions_${manifest.title.replace(/\s+/g, '_').toLowerCase()}`;
}

function initScores(sections: PuttingSection[]): number[][][] {
  return sections.map((sec) =>
    sec.drills.map((drill) => Array(drill.holes).fill(0))
  );
}

function sectionTotal(scores: number[][][], sectionIdx: number): number {
  return scores[sectionIdx]?.reduce(
    (sum, holeScores) => sum + holeScores.reduce((s, v) => s + v, 0),
    0
  ) ?? 0;
}

function sectionPossible(section: PuttingSection): number {
  return section.drills.reduce((s, d) => s + d.holes * d.puttsPerHole, 0);
}

function drillTotal(scores: number[][][], sectionIdx: number, drillIdx: number): number {
  return scores[sectionIdx]?.[drillIdx]?.reduce((s, v) => s + v, 0) ?? 0;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PuttingAssessmentModule({ manifest, hostContext, onComplete }: TrainingModuleProps) {
  const m = manifest as PuttingManifest;
  const sections: PuttingSection[] = m.sections ?? [];
  const scheduledWeeks: number[] = m.scheduledWeeks ?? [];
  const practiceNotes: string[] = m.practiceNotes ?? [];

  const [view, setView] = useState<'overview' | 'session'>('overview');
  const [activeSection, setActiveSection] = useState(0);
  const [sessionScores, setSessionScores] = useState<number[][][]>(() => initScores(sections));
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);

  // The next week to complete is the next entry in scheduledWeeks that has no
  // corresponding completed session.
  const nextWeekIndex = Math.min(completedSessions.length, scheduledWeeks.length - 1);
  const nextWeek = scheduledWeeks[nextWeekIndex] ?? nextWeekIndex + 1;
  const allComplete = completedSessions.length >= scheduledWeeks.length;

  // Load persisted sessions on mount.
  useEffect(() => {
    AsyncStorage.getItem(storageKey(m))
      .then((raw) => {
        if (raw) setCompletedSessions(JSON.parse(raw) as CompletedSession[]);
      })
      .catch(() => {/* ignore */});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync navigation header title with current view.
  useEffect(() => {
    if (view === 'overview') {
      hostContext.navigation.setOptions({ title: m.title });
    } else {
      hostContext.navigation.setOptions({ title: `Week ${nextWeek} Session` });
    }
  }, [view, nextWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  const startSession = useCallback(() => {
    setSessionScores(initScores(sections));
    setActiveSection(0);
    setView('session');
  }, [sections]);

  const submitSession = useCallback(() => {
    const totalMade = sections.reduce((sum, _, si) => sum + sectionTotal(sessionScores, si), 0);
    const totalPossible = sections.reduce((sum, sec) => sum + sectionPossible(sec), 0);
    const newSession: CompletedSession = {
      week: nextWeek,
      completedAt: new Date().toISOString(),
      totalMade,
      totalPossible,
    };
    const updated = [...completedSessions, newSession];
    setCompletedSessions(updated);
    setView('overview');
    // Persist in the background; failure is non-fatal.
    AsyncStorage.setItem(storageKey(m), JSON.stringify(updated)).catch(() => {});
    if (updated.length >= scheduledWeeks.length) {
      onComplete();
    }
  }, [completedSessions, sessionScores, sections, nextWeek, scheduledWeeks.length, onComplete, m]);

  const adjustScore = useCallback(
    (sectionIdx: number, drillIdx: number, holeIdx: number, delta: number) => {
      setSessionScores((prev) => {
        const next = prev.map((sec) => sec.map((holes) => [...holes]));
        const drill = sections[sectionIdx]?.drills[drillIdx];
        if (!drill) return prev;
        const current = next[sectionIdx][drillIdx][holeIdx];
        next[sectionIdx][drillIdx][holeIdx] = Math.max(
          0,
          Math.min(drill.puttsPerHole, current + delta)
        );
        return next;
      });
    },
    [sections]
  );

  if (view === 'session') {
    return (
      <SessionView
        manifest={m}
        sections={sections}
        practiceNotes={practiceNotes}
        sessionScores={sessionScores}
        activeSection={activeSection}
        nextWeek={nextWeek}
        onSelectSection={setActiveSection}
        onAdjust={adjustScore}
        onSubmit={submitSession}
        onBack={() => setView('overview')}
      />
    );
  }

  return (
    <OverviewView
      manifest={m}
      sections={sections}
      completedSessions={completedSessions}
      nextWeek={nextWeek}
      allComplete={allComplete}
      onStart={startSession}
    />
  );
}

// ── Overview sub-component ────────────────────────────────────────────────────

interface OverviewProps {
  manifest: PuttingManifest;
  sections: PuttingSection[];
  completedSessions: CompletedSession[];
  nextWeek: number;
  allComplete: boolean;
  onStart: () => void;
}

function OverviewView({ manifest, sections, completedSessions, nextWeek, allComplete, onStart }: OverviewProps) {
  const totalWeeks = manifest.scheduledWeeks?.length ?? 0;
  const weekLabel = totalWeeks > 0 ? `${Math.max(...(manifest.scheduledWeeks ?? [totalWeeks]))}-Week Program` : 'Training Program';

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
      {/* Module header */}
      <View style={s.moduleHeader}>
        <EmojiText style={s.headerIcon}>{manifest.icon ?? '🏌️'}</EmojiText>
        <View>
          <Text style={s.headerTitle}>{manifest.title}</Text>
          <Text style={s.headerSubtitle}>{weekLabel}</Text>
        </View>
      </View>

      {/* Session due banner */}
      {!allComplete && (
        <View style={s.dueBanner}>
          <View style={s.dueBannerLeft}>
            <Text style={s.dueBannerEmoji}>📅</Text>
            <View>
              <Text style={s.dueBannerHeading}>Session Due</Text>
              <Text style={s.dueBannerBody}>{`Week ${nextWeek} session is ready to be completed.`}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.startBtn} onPress={onStart} activeOpacity={0.85}>
            <Text style={s.startBtnLabel}>{`Start – Week ${nextWeek}`}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Session history */}
      {completedSessions.length === 0 ? (
        <View style={s.emptyHistory}>
          <Text style={s.emptyHistoryTitle}>No sessions recorded yet</Text>
          <Text style={s.emptyHistoryBody}>Complete your first session to see stats here.</Text>
        </View>
      ) : (
        <View style={s.historyList}>
          {completedSessions.map((cs, i) => {
            const pct = cs.totalPossible > 0
              ? Math.round((cs.totalMade / cs.totalPossible) * 100)
              : 0;
            return (
              <View key={i} style={s.historyRow}>
                <Text style={s.historyWeek}>{`Week ${cs.week}`}</Text>
                <Text style={s.historyScore}>{`${cs.totalMade} / ${cs.totalPossible}`}</Text>
                <Text style={s.historyPct}>{`${pct}%`}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Module overview */}
      <Text style={s.overviewHeading}>Module Overview</Text>
      <Text style={s.overviewDesc}>{manifest.description}</Text>

      {sections.map((sec) => {
        const possible = sectionPossible(sec);
        return (
          <View key={sec.name} style={s.sectionOverview}>
            <View style={s.sectionOverviewHeader}>
              <Text style={s.sectionOverviewName}>{sec.name}</Text>
              <Text style={s.sectionOverviewPossible}>{`${possible} putts / session`}</Text>
            </View>
            <Text style={s.sectionOverviewDesc}>{sec.description}</Text>
            {sec.drills.map((drill) => {
              const label = drill.targetRadius
                ? `${drill.holes} × ${drill.puttsPerHole} putts  (${drill.targetRadius})`
                : `${drill.holes} × ${drill.puttsPerHole} putts`;
              return (
                <View key={drill.name} style={s.drillOverviewRow}>
                  <Text style={s.drillOverviewName}>{drill.name}</Text>
                  <Text style={s.drillOverviewLabel}>{label}</Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
}

// ── Session sub-component ─────────────────────────────────────────────────────

interface SessionProps {
  manifest: PuttingManifest;
  sections: PuttingSection[];
  practiceNotes: string[];
  sessionScores: number[][][];
  activeSection: number;
  nextWeek: number;
  onSelectSection: (idx: number) => void;
  onAdjust: (sectionIdx: number, drillIdx: number, holeIdx: number, delta: number) => void;
  onSubmit: () => void;
  onBack: () => void;
}

function SessionView({
  manifest,
  sections,
  sessionScores,
  activeSection,
  nextWeek,
  onSelectSection,
  onAdjust,
  onSubmit,
  onBack,
}: SessionProps) {
  const grandTotal = sections.reduce((sum, _, si) => sum + sectionTotal(sessionScores, si), 0);
  const grandPossible = sections.reduce((sum, sec) => sum + sectionPossible(sec), 0);
  const makeRate = grandPossible > 0 ? Math.round((grandTotal / grandPossible) * 100) : 0;
  const sec = sections[activeSection];

  return (
    <View style={s.sessionRoot}>
      {/* Sub-header */}
      <View style={s.sessionSubHeader}>
        <Text style={s.sessionSubTitle}>{manifest.title}</Text>
        <Text style={s.sessionSubSubtitle}>{`Week ${nextWeek} — Record your results below`}</Text>
      </View>

      {/* Running total */}
      <View style={s.runningTotalBar}>
        <View>
          <Text style={s.runningTotalLabel}>Running Total</Text>
          <Text style={s.runningTotalValue}>{`${grandTotal} / ${grandPossible}`}</Text>
        </View>
        <View style={s.makeRateBox}>
          <Text style={s.makeRateValue}>{`${makeRate}%`}</Text>
          <Text style={s.makeRateLabel}>Make Rate</Text>
        </View>
      </View>

      {/* Section tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabScroll}
        contentContainerStyle={s.tabRow}
      >
        {sections.map((sec, si) => {
          const total = sectionTotal(sessionScores, si);
          const possible = sectionPossible(sec);
          const active = si === activeSection;
          return (
            <TouchableOpacity
              key={sec.name}
              style={[s.tab, active && s.tabActive]}
              onPress={() => onSelectSection(si)}
              activeOpacity={0.85}
            >
              <Text style={[s.tabLabel, active && s.tabLabelActive]}>
                {`${sec.name} (${total}/${possible})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Section content */}
      <ScrollView style={s.sectionScroll} contentContainerStyle={s.sectionContent}>
        {sec && (
          <>
            <Text style={s.secName}>{sec.name}</Text>
            <Text style={s.secDesc}>{sec.description}</Text>

            {sec.drills.map((drill, di) => {
              const total = drillTotal(sessionScores, activeSection, di);
              const possible = drill.holes * drill.puttsPerHole;
              return (
                <View key={drill.name} style={s.drillCard}>
                  <View style={s.drillCardHeader}>
                    <Text style={s.drillName}>{drill.name}</Text>
                    <Text style={[s.drillScore, total > 0 && s.drillScoreActive]}>
                      {`${total} / ${possible}`}
                    </Text>
                  </View>
                  <View style={s.holesRow}>
                    {Array.from({ length: drill.holes }, (_, hi) => {
                      const val = sessionScores[activeSection]?.[di]?.[hi] ?? 0;
                      return (
                        <View key={hi} style={s.holeCol}>
                          <Text style={s.holeLabel}>{`Hole ${hi + 1}`}</Text>
                          <TouchableOpacity
                            style={s.btnPlus}
                            onPress={() => onAdjust(activeSection, di, hi, 1)}
                            activeOpacity={0.7}
                          >
                            <Text style={s.btnPlusLabel}>+</Text>
                          </TouchableOpacity>
                          <Text style={s.holeVal}>{String(val)}</Text>
                          <TouchableOpacity
                            style={s.btnMinus}
                            onPress={() => onAdjust(activeSection, di, hi, -1)}
                            activeOpacity={0.7}
                          >
                            <Text style={s.btnMinusLabel}>−</Text>
                          </TouchableOpacity>
                          <Text style={s.holeMax}>/{drill.puttsPerHole}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </>
        )}

        <View style={s.sessionActions}>
          <TouchableOpacity style={s.cancelBtn} onPress={onBack} activeOpacity={0.85}>
            <Text style={s.cancelBtnLabel}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.submitBtn} onPress={onSubmit} activeOpacity={0.85}>
            <Text style={s.submitBtnLabel}>Complete Session</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Overview
  scroll: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingBottom: 48 },

  moduleHeader: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 14,
  },
  headerIcon: { fontSize: 38 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textLight },
  headerSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  dueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFBEA',
    borderColor: '#F5D056',
    borderWidth: 1.5,
    borderRadius: 14,
    margin: 14,
    padding: 14,
    gap: 10,
  },
  dueBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dueBannerEmoji: { fontSize: 22 },
  dueBannerHeading: { fontSize: 15, fontWeight: '800', color: '#7A5A00' },
  dueBannerBody: { fontSize: 13, color: '#9B7500', marginTop: 2 },
  startBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  startBtnLabel: { fontWeight: '800', fontSize: 13, color: COLORS.textLight },

  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyHistoryTitle: { fontSize: 15, color: COLORS.textMuted, fontWeight: '600' },
  emptyHistoryBody: { fontSize: 13, color: COLORS.textMuted, marginTop: 4, textAlign: 'center' },

  historyList: { paddingHorizontal: 14, paddingBottom: 8 },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 6,
  },
  historyWeek: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  historyScore: { fontSize: 14, color: COLORS.textSecondary },
  historyPct: { fontSize: 14, fontWeight: '700', color: COLORS.success },

  overviewHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textLight,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  overviewDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 20,
    marginHorizontal: 16,
    marginBottom: 12,
  },

  sectionOverview: {
    backgroundColor: COLORS.surface,
    marginHorizontal: 0,
    marginBottom: 2,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionOverviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  sectionOverviewName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  sectionOverviewPossible: { fontSize: 12, color: COLORS.textMuted },
  sectionOverviewDesc: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 },
  drillOverviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  drillOverviewName: { fontSize: 13, color: COLORS.textPrimary },
  drillOverviewLabel: { fontSize: 13, color: COLORS.textMuted },

  // Session
  sessionRoot: { flex: 1, backgroundColor: COLORS.background },
  sessionSubHeader: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sessionSubTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textLight },
  sessionSubSubtitle: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  runningTotalBar: {
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  runningTotalLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  runningTotalValue: { fontSize: 28, fontWeight: '800', color: COLORS.primary },
  makeRateBox: { alignItems: 'flex-end' },
  makeRateValue: { fontSize: 26, fontWeight: '800', color: COLORS.success },
  makeRateLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },

  tabScroll: { maxHeight: 52, backgroundColor: COLORS.surface },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
    paddingVertical: 8,
  },
  tab: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  tabLabelActive: { color: COLORS.textLight },

  sectionScroll: { flex: 1 },
  sectionContent: { padding: 16, paddingBottom: 48 },
  secName: { fontSize: 17, fontWeight: '800', color: COLORS.textLight, marginBottom: 4 },
  secDesc: { fontSize: 13, color: COLORS.textMuted, marginBottom: 14 },

  drillCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  drillCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  drillName: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  drillScore: { fontSize: 14, fontWeight: '700', color: COLORS.textSecondary },
  drillScoreActive: { color: COLORS.success },

  holesRow: { flexDirection: 'row', gap: 12 },
  holeCol: { alignItems: 'center', minWidth: 48 },
  holeLabel: { fontSize: 11, color: COLORS.textMuted, marginBottom: 4 },
  btnPlus: {
    backgroundColor: '#D6F5E3',
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPlusLabel: { fontSize: 22, fontWeight: '700', color: COLORS.success, lineHeight: 26 },
  holeVal: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginVertical: 4 },
  btnMinus: {
    backgroundColor: '#FFE0DE',
    borderRadius: 8,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnMinusLabel: { fontSize: 22, fontWeight: '700', color: COLORS.danger, lineHeight: 26 },
  holeMax: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  sessionActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelBtnLabel: { fontWeight: '700', fontSize: 15, color: COLORS.textSecondary },
  submitBtn: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  submitBtnLabel: { fontWeight: '700', fontSize: 15, color: COLORS.textLight },
});
