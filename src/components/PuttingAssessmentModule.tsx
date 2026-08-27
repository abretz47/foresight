import {useState, useEffect} from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { TrainingModuleProps } from '../lib/trainingModuleRegistry';
import { Drill, DrillResult, TrainingSession } from '../lib/trainingConfigService';
import { getModuleProgress, getAggregateStats } from '../services/progressService';
import { generateId, getSessionsForModule, saveSession } from '../services/sessionService';

type DrillKey = `${string}||${string}`;

function makeDrillKey(sectionName: string, drillName: string): DrillKey {
  return `${sectionName}||${drillName}`;
}


export default function PuttingAssessmentModule({ manifest, onComplete, hostContext, onStartSession }: TrainingModuleProps) {
    const mod = manifest;
    const [holeScores, setHoleScores] = useState<Record<DrillKey, number[]>>(() => {
    const initial: Record<string, number[]> = {};
        if (mod) {
            for (const section of mod.steps) {
            for (const drill of section.drills) {
                initial[makeDrillKey(section.name, drill.name)] = Array(drill.holes).fill(0);
            }
            }
        }
        return initial as Record<DrillKey, number[]>;
    });
    const [activeSession, setActiveSession] = useState<TrainingSession | null>(null);
    const [refreshToken, setRefreshToken] = useState(0);
    const [sessions, setSessions] = useState<TrainingSession[]>([]);
    const [activeSection, setActiveSection] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const { completedCount, totalSessions, nextDueWeek, isComplete, completedWeekNumbers } = getModuleProgress(mod, sessions);
    const stats = getAggregateStats(sessions);
    const completedSessions = sessions.filter((s) => s.completedAt).sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());
    useEffect(() => {
        let active = true;
        void getSessionsForModule('putting-assessment').then((s) => {
            if (active) setSessions(s);
        });
        return () => {
            active = false;
        };
    }, ['putting-assessment', refreshToken]);


    if (!mod) {
        return (
            <View style={styles.notFound}>
            <Text style={styles.notFoundText}>Session data not found.</Text>
            {hostContext?.onBack ? (
                <TouchableOpacity onPress={hostContext.onBack} style={styles.backBtn}>
                <Text style={styles.backBtnText}>← Back</Text>
                </TouchableOpacity>
            ) : null}
            </View>
        );
    }

    const moduleData = mod;

    function setHoleScore(sectionName: string, drill: Drill, holeIndex: number, value: number) {
    const key = makeDrillKey(sectionName, drill.name);
    const clamped = Math.max(0, Math.min(drill.puttsPerHole, value));
    setHoleScores((prev) => {
        const arr = [...(prev[key] ?? Array(drill.holes).fill(0))];
        arr[holeIndex] = clamped;
        return { ...prev, [key]: arr };
    });
    }

    function getDrillTotal(sectionName: string, drillName: string): number {
    return (holeScores[makeDrillKey(sectionName, drillName)] ?? []).reduce((a, b) => a + b, 0);
    }

    function getSectionTotal(sectionName: string): { holed: number; total: number } {
    const section = moduleData.steps.find((sec) => sec.name === sectionName);
    if (!section) return { holed: 0, total: 0 };
    let holed = 0;
    let total = 0;
    for (const drill of section.drills) {
        holed += getDrillTotal(sectionName, drill.name);
        total += drill.holes * drill.puttsPerHole;
    }
    return { holed, total };
    }

    function getGrandTotal(): { holed: number; total: number } {
    let holed = 0;
    let total = 0;
    for (const section of moduleData.steps) {
        const totals = getSectionTotal(section.name);
        holed += totals.holed;
        total += totals.total;
    }
    return { holed, total };
    }

    async function handleFinish() {
        if (!activeSession) return;
        setSubmitting(true);
        const drillResults: DrillResult[] = [];
        for (const section of moduleData.steps) {
            for (const drill of section.drills) {
                const key = makeDrillKey(section.name, drill.name);
                const scores = holeScores[key] ?? Array(drill.holes).fill(0);
                drillResults.push({
                    sectionName: section.name,
                    drillName: drill.name,
                    holeScores: scores,
                    totalPotential: drill.holes * drill.puttsPerHole,
                });
            }
        }
        const completedSession: TrainingSession = {
            id: activeSession.id,
            moduleId: activeSession.moduleId,
            startedAt: activeSession.startedAt,
            weekNumber: activeSession.weekNumber,
            completedAt: new Date().toISOString(),
            drillResults,
        };
        await saveSession(completedSession);
        setSessions((prev) => [...prev.filter((s) => s.id !== completedSession.id), completedSession]);
        setActiveSession(null);
        setRefreshToken((prev) => prev + 1);
        onComplete?.(completedSession);
        setSubmitting(false);
    }

    const grand = getGrandTotal();
    const grandPct = grand.total > 0 ? Math.round((grand.holed / grand.total) * 100) : 0;
    const currentSection = moduleData.steps[activeSection];


    if (activeSession) {
        const session = activeSession;
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <View style={styles.hero}>
                <Text style={styles.heroTitle}>{moduleData.name}</Text>
                <Text style={styles.heroSub}>Week {session.weekNumber} — Record your results below</Text>
                </View>

                <View style={styles.runningTotal}>
                <View>
                    <Text style={styles.runningLabel}>Running Total</Text>
                    <Text style={styles.runningScore}>
                    {grand.holed} / {grand.total}
                    </Text>
                </View>
                <View style={styles.runningRight}>
                    <Text style={styles.runningPct}>{grandPct}%</Text>
                    <Text style={styles.runningPctLabel}>Make Rate</Text>
                </View>
                </View>

                <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabsScroll}
                contentContainerStyle={styles.tabsContent}
                >
                {moduleData.steps.map((section, idx) => {
                    const totals = getSectionTotal(section.name);
                    return (
                    <TouchableOpacity
                        key={section.name}
                        onPress={() => setActiveSection(idx)}
                        style={[styles.tab, idx === activeSection ? styles.tabActive : styles.tabInactive]}
                    >
                        <Text style={[styles.tabText, idx === activeSection ? styles.tabTextActive : null]}>
                        {section.name}
                        {totals.total > 0 ? ` (${totals.holed}/${totals.total})` : ''}
                        </Text>
                    </TouchableOpacity>
                    );
                })}
                </ScrollView>

                <View style={styles.sectionContainer}>
                <Text style={styles.sectionName}>{currentSection.name}</Text>
                {currentSection.description ? (
                    <Text style={styles.sectionDesc}>{currentSection.description}</Text>
                ) : null}

                {currentSection.drills.map((drill) => {
                    const key = makeDrillKey(currentSection.name, drill.name);
                    const scores = holeScores[key] ?? Array(drill.holes).fill(0);
                    const drillTotal = scores.reduce((a, b) => a + b, 0);
                    const drillMax = drill.holes * drill.puttsPerHole;
                    return (
                    <View key={drill.name} style={styles.drillCard}>
                        <View style={styles.drillHeader}>
                        <View>
                            <Text style={styles.drillName}>{drill.name}</Text>
                            {drill.targetRadius ? (
                            <Text style={styles.drillRadius}>{drill.targetRadius}</Text>
                            ) : null}
                        </View>
                        <Text style={styles.drillScore}>
                            {drillTotal} / {drillMax}
                        </Text>
                        </View>

                        <View style={styles.holeGrid}>
                        {scores.map((score, holeIdx) => (
                            <View key={holeIdx} style={styles.holeCol}>
                            <Text style={styles.holeLabel}>
                                {drill.holes > 1 ? `Hole ${holeIdx + 1}` : 'Score'}
                            </Text>
                            <TouchableOpacity
                                style={styles.btnUp}
                                onPress={() => setHoleScore(currentSection.name, drill, holeIdx, score + 1)}
                                accessibilityLabel={`Increase hole ${holeIdx + 1}`}
                            >
                                <Text style={styles.btnUpText}>+</Text>
                            </TouchableOpacity>
                            <Text style={styles.holeScore}>{score}</Text>
                            <TouchableOpacity
                                style={styles.btnDown}
                                onPress={() => setHoleScore(currentSection.name, drill, holeIdx, score - 1)}
                                accessibilityLabel={`Decrease hole ${holeIdx + 1}`}
                            >
                                <Text style={styles.btnDownText}>−</Text>
                            </TouchableOpacity>
                            <Text style={styles.holeDenom}>/{drill.puttsPerHole}</Text>
                            </View>
                        ))}
                        </View>

                        <View style={styles.drillProgressTrack}>
                        <View
                            style={[
                            styles.drillProgressFill,
                            { width: `${drillMax > 0 ? (drillTotal / drillMax) * 100 : 0}%` as `${number}%` },
                            ]}
                        />
                        </View>
                    </View>
                    );
                })}

                <View style={styles.navRow}>
                    {activeSection > 0 ? (
                    <TouchableOpacity onPress={() => setActiveSection((p) => p - 1)}>
                        <Text style={styles.navPrev}>← Previous</Text>
                    </TouchableOpacity>
                    ) : hostContext?.onBack ? (
                    <TouchableOpacity onPress={hostContext.onBack}>
                        <Text style={styles.navPrev}>← Back</Text>
                    </TouchableOpacity>
                    ) : (
                    <View />
                    )}
                    {activeSection < moduleData.steps.length - 1 ? (
                    <TouchableOpacity
                        style={styles.navNextBtn}
                        onPress={() => setActiveSection((p) => p + 1)}
                    >
                        <Text style={styles.navNextText}>Next Section →</Text>
                    </TouchableOpacity>
                    ) : (
                    <TouchableOpacity
                        style={[styles.navNextBtn, submitting && styles.btnDisabled]}
                        onPress={() => void handleFinish()}
                        disabled={submitting}
                    >
                        <Text style={styles.navNextText}>{submitting ? 'Saving…' : '✅ Complete Session'}</Text>
                    </TouchableOpacity>
                    )}
                </View>
                </View>

                {moduleData.practiceNotes && moduleData.practiceNotes.length > 0 && (
                <View style={styles.notesBox}>
                    <Text style={styles.notesTitle}>Practice Notes</Text>
                    {moduleData.practiceNotes.map((note, i) => (
                    <Text key={i} style={styles.noteText}>
                        • {note}
                    </Text>
                    ))}
                </View>
                )}
            </ScrollView>
        );
    }

    if (!mod) {
        return (
            <View style={detailsStyles.notFound}>
            <Text style={detailsStyles.notFoundText}>Module not found.</Text>
            {hostContext?.onBack ? (
                <TouchableOpacity onPress={hostContext.onBack} style={detailsStyles.backBtn}>
                <Text style={detailsStyles.backBtnText}>← Back</Text>
                </TouchableOpacity>
            ) : null}
            </View>
        );
    }


    function handleStartSession() {
        if (nextDueWeek === null) return;
        const session: TrainingSession = {
            id: generateId(),
            moduleId: moduleData.id,
            startedAt: new Date().toISOString(),
            weekNumber: nextDueWeek,
            drillResults: [],
        };
        setActiveSession(session);
        setActiveSection(0);
        onStartSession?.(session);
    }

  function getSectionStats(sectionName: string) {
    let holed = 0;
    let total = 0;
    for (const s of completedSessions) {
      for (const r of s.drillResults) {
        if (r.sectionName === sectionName) {
          holed += r.holeScores.reduce((a, b) => a + b, 0);
          total += r.totalPotential;
        }
      }
    }
    return total > 0 ? { holed, total, pct: Math.round((holed / total) * 100) } : null;
  }
  return (
    <ScrollView style={detailsStyles.container} contentContainerStyle={detailsStyles.content}>
      <View style={detailsStyles.hero}>
        <Text style={detailsStyles.heroIcon}>{moduleData.icon}</Text>
        <View style={detailsStyles.heroText}>
          <Text style={detailsStyles.heroTitle}>{moduleData.name}</Text>
          <Text style={detailsStyles.heroSub}>12-Week Program</Text>
        </View>
      </View>

      {!isComplete && nextDueWeek !== null && (
        <View style={detailsStyles.dueBanner}>
          <View style={detailsStyles.dueInfo}>
            <Text style={detailsStyles.dueTitle}>📅 Session Due</Text>
            <Text style={detailsStyles.dueSub}>Week {nextDueWeek} session is ready to be completed.</Text>
          </View>
          <TouchableOpacity style={detailsStyles.startBtn} onPress={handleStartSession}>
            <Text style={detailsStyles.startBtnText}>Start – Week {nextDueWeek}</Text>
          </TouchableOpacity>
        </View>
      )}

      {isComplete && (
        <View style={detailsStyles.completeBanner}>
          <Text style={detailsStyles.completeTitle}>✅ Program Complete!</Text>
          <Text style={detailsStyles.completeSub}>
            You have completed all {totalSessions} sessions for this module.
          </Text>
        </View>
      )}

      {stats ? (
        <View style={detailsStyles.section}>
          <Text style={detailsStyles.sectionTitle}>Overall Stats</Text>
          <View style={detailsStyles.statsGrid}>
            <StatCard label="Sessions Done" value={`${completedCount} / ${totalSessions}`} />
            <StatCard label="Total Holed" value={stats.totalHoled.toLocaleString()} />
            <StatCard label="Total Putts" value={stats.totalAttempts.toLocaleString()} />
            <StatCard label="Make Rate" value={`${stats.avgPercent}%`} highlight />
          </View>

          <Text style={detailsStyles.subSectionTitle}>Section Breakdown</Text>
          {moduleData.steps.map((section) => {
            const s = getSectionStats(section.name);
            return (
              <View key={section.name} style={detailsStyles.breakdownCard}>
                <View style={detailsStyles.breakdownRow}>
                  <Text style={detailsStyles.breakdownLabel}>{section.name}</Text>
                  {s ? (
                    <Text style={detailsStyles.breakdownValue}>
                      {s.holed} / {s.total} ({s.pct}%)
                    </Text>
                  ) : null}
                </View>
                {s ? (
                  <View style={detailsStyles.progressTrack}>
                    <View style={[detailsStyles.progressFill, { width: `${s.pct}%` as `${number}%` }]} />
                  </View>
                ) : (
                  <Text style={detailsStyles.noData}>No data yet</Text>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={detailsStyles.noSessionsBox}>
          <Text style={detailsStyles.noSessionsTitle}>No sessions recorded yet</Text>
          <Text style={detailsStyles.noSessionsSub}>
            Complete your first session to see stats here.
          </Text>
        </View>
      )}

      {completedSessions.length > 0 && (
        <View style={detailsStyles.section}>
          <Text style={detailsStyles.sectionTitle}>Session History</Text>
          {completedSessions.map((session) => {
            let holed = 0;
            let total = 0;
            for (const r of session.drillResults) {
              holed += r.holeScores.reduce((a, b) => a + b, 0);
              total += r.totalPotential;
            }
            const pct = total > 0 ? Math.round((holed / total) * 100) : 0;
            return (
              <View key={session.id} style={detailsStyles.historyItem}>
                <View>
                  <Text style={detailsStyles.historyWeek}>Week {session.weekNumber} Session</Text>
                  <Text style={detailsStyles.historyDate}>
                    {new Date(session.completedAt!).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={detailsStyles.historyRight}>
                  <Text style={detailsStyles.historyPct}>{pct}%</Text>
                  <Text style={detailsStyles.historyPutts}>
                    {holed} / {total} putts
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={detailsStyles.section}>
        <Text style={detailsStyles.sectionTitle}>Module Overview</Text>
        <Text style={detailsStyles.overviewDesc}>{moduleData.description}</Text>

        {moduleData.steps.map((section) => {
          const sectionTotal = section.drills.reduce((acc, d) => acc + d.holes * d.puttsPerHole, 0);
          return (
            <View key={section.name} style={detailsStyles.overviewSection}>
              <View style={detailsStyles.overviewSectionHeader}>
                <Text style={detailsStyles.overviewSectionName}>{section.name}</Text>
                <Text style={detailsStyles.overviewSectionTotal}>{sectionTotal} putts / session</Text>
              </View>
              {section.description ? (
                <Text style={detailsStyles.overviewSectionDesc}>{section.description}</Text>
              ) : null}
              {section.drills.map((drill) => (
                <View key={drill.name} style={detailsStyles.drillRow}>
                  <Text style={detailsStyles.drillName}>{drill.name}</Text>
                  <Text style={detailsStyles.drillDetail}>
                    {drill.holes} × {drill.puttsPerHole} putts
                    {drill.targetRadius ? `  (${drill.targetRadius})` : ''}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        {moduleData.practiceNotes && moduleData.practiceNotes.length > 0 && (
          <View style={detailsStyles.notesBox}>
            <Text style={detailsStyles.notesTitle}>Practice Notes</Text>
            {moduleData.practiceNotes.map((note, i) => (
              <Text key={i} style={detailsStyles.noteText}>
                • {note}
              </Text>
            ))}
          </View>
        )}

        <View style={detailsStyles.weekBox}>
          <Text style={detailsStyles.weekBoxText}>
            Scheduled sessions at weeks:{' '}
            <Text style={detailsStyles.weekNumbers}>{moduleData.scheduledWeeks.join(', ')}</Text>
          </Text>
          <View style={detailsStyles.weekDots}>
            {moduleData.scheduledWeeks.map((week) => (
              <View
                key={week}
                style={[
                  detailsStyles.weekDot,
                  completedWeekNumbers.has(week)
                    ? detailsStyles.weekDotComplete
                    : week === nextDueWeek
                      ? detailsStyles.weekDotDue
                      : detailsStyles.weekDotPending,
                ]}
              >
                <Text
                  style={[
                    detailsStyles.weekDotText,
                    completedWeekNumbers.has(week)
                      ? detailsStyles.weekDotTextComplete
                      : week === nextDueWeek
                        ? detailsStyles.weekDotTextDue
                        : detailsStyles.weekDotTextPending,
                  ]}
                >
                  {week}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={[detailsStyles.statCard, highlight ? detailsStyles.statCardHighlight : null]}>
      <Text style={[detailsStyles.statValue, highlight ? detailsStyles.statValueHighlight : null]}>{value}</Text>
      <Text style={detailsStyles.statLabel}>{label}</Text>
    </View>
  );
}

const detailsStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { paddingBottom: 40 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  notFoundText: { fontSize: 16, color: '#6b7280', marginBottom: 16 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: '#15803d', fontWeight: '600' },
  hero: {
    backgroundColor: '#15803d',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
    gap: 16,
    marginBottom: 16,
  },
  heroIcon: { fontSize: 44 },
  heroText: { flex: 1 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#ffffff' },
  heroSub: { fontSize: 13, color: '#bbf7d0', marginTop: 2 },
  dueBanner: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  dueInfo: { flex: 1 },
  dueTitle: { fontSize: 14, fontWeight: '700', color: '#92400e' },
  dueSub: { fontSize: 13, color: '#b45309', marginTop: 2 },
  startBtn: {
    backgroundColor: '#15803d',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  startBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  completeBanner: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  completeTitle: { fontSize: 14, fontWeight: '700', color: '#15803d' },
  completeSub: { fontSize: 13, color: '#16a34a', marginTop: 2 },
  section: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1f2937', marginBottom: 12 },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statCardHighlight: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1f2937' },
  statValueHighlight: { color: '#15803d' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  breakdownCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  breakdownLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  breakdownValue: { fontSize: 13, fontWeight: '700', color: '#15803d' },
  progressTrack: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: '#16a34a', borderRadius: 3 },
  noData: { fontSize: 12, color: '#9ca3af' },
  noSessionsBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 32,
    marginHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  noSessionsTitle: { fontSize: 16, color: '#9ca3af', marginBottom: 4 },
  noSessionsSub: { fontSize: 13, color: '#9ca3af', textAlign: 'center' },
  historyItem: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyWeek: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  historyDate: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  historyRight: { alignItems: 'flex-end' },
  historyPct: { fontSize: 18, fontWeight: '700', color: '#15803d' },
  historyPutts: { fontSize: 11, color: '#9ca3af' },
  overviewDesc: { fontSize: 13, color: '#6b7280', lineHeight: 19, marginBottom: 12 },
  overviewSection: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  overviewSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  overviewSectionName: { fontSize: 14, fontWeight: '700', color: '#1f2937' },
  overviewSectionTotal: { fontSize: 11, color: '#6b7280' },
  overviewSectionDesc: { fontSize: 11, color: '#6b7280', marginBottom: 6 },
  drillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  drillName: { fontSize: 13, color: '#374151' },
  drillDetail: { fontSize: 12, color: '#6b7280' },
  notesBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  notesTitle: { fontSize: 13, fontWeight: '700', color: '#1e40af', marginBottom: 6 },
  noteText: { fontSize: 13, color: '#1d4ed8', lineHeight: 19, marginBottom: 2 },
  weekBox: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  weekBoxText: { fontSize: 13, color: '#4b5563', textAlign: 'center', marginBottom: 12 },
  weekNumbers: { fontWeight: '700' },
  weekDots: { flexDirection: 'row', gap: 10 },
  weekDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotComplete: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  weekDotDue: { backgroundColor: '#fef3c7', borderColor: '#fbbf24' },
  weekDotPending: { backgroundColor: '#ffffff', borderColor: '#d1d5db' },
  weekDotText: { fontSize: 13, fontWeight: '700' },
  weekDotTextComplete: { color: '#ffffff' },
  weekDotTextDue: { color: '#92400e' },
  weekDotTextPending: { color: '#9ca3af' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { paddingBottom: 40 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  notFoundText: { fontSize: 16, color: '#6b7280', marginBottom: 16 },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { color: '#15803d', fontWeight: '600' },
  hero: {
    backgroundColor: '#15803d',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 12,
  },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  heroSub: { fontSize: 13, color: '#bbf7d0', marginTop: 4 },
  runningTotal: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  runningLabel: { fontSize: 12, color: '#6b7280' },
  runningScore: { fontSize: 22, fontWeight: '800', color: '#15803d' },
  runningRight: { alignItems: 'flex-end' },
  runningPct: { fontSize: 28, fontWeight: '800', color: '#15803d' },
  runningPctLabel: { fontSize: 11, color: '#9ca3af' },
  tabsScroll: { marginBottom: 12 },
  tabsContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  tabActive: { backgroundColor: '#15803d' },
  tabInactive: { backgroundColor: '#e5e7eb' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#4b5563' },
  tabTextActive: { color: '#ffffff' },
  sectionContainer: { marginHorizontal: 16 },
  sectionName: { fontSize: 16, fontWeight: '700', color: '#1f2937', marginBottom: 4 },
  sectionDesc: { fontSize: 11, color: '#6b7280', marginBottom: 12 },
  drillCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  drillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  drillName: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  drillRadius: { fontSize: 11, color: '#2563eb', marginTop: 2 },
  drillScore: { fontSize: 13, fontWeight: '700', color: '#15803d' },
  holeGrid: { flexDirection: 'row', gap: 8, justifyContent: 'flex-start', flexWrap: 'wrap' },
  holeCol: { alignItems: 'center', minWidth: 48 },
  holeLabel: { fontSize: 10, color: '#9ca3af', marginBottom: 4 },
  btnUp: {
    width: 36,
    height: 36,
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnUpText: { fontSize: 18, fontWeight: '700', color: '#15803d' },
  holeScore: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
    marginVertical: 4,
    textAlign: 'center',
    width: 36,
  },
  btnDown: {
    width: 36,
    height: 36,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDownText: { fontSize: 18, fontWeight: '700', color: '#b91c1c' },
  holeDenom: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  drillProgressTrack: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  drillProgressFill: { height: 4, backgroundColor: '#22c55e', borderRadius: 2 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  navPrev: { color: '#15803d', fontWeight: '600', fontSize: 14 },
  navNextBtn: {
    backgroundColor: '#15803d',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  navNextText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  btnDisabled: { opacity: 0.5 },
  notesBox: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  notesTitle: { fontSize: 13, fontWeight: '700', color: '#1e40af', marginBottom: 6 },
  noteText: { fontSize: 13, color: '#1d4ed8', lineHeight: 19, marginBottom: 2 },
});
