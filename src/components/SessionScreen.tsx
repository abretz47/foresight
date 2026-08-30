import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { saveSession } from '../services/sessionService';
import type { Drill, DrillResult } from '../lib/trainingConfigService.ts';
import type { TrainingSession as Session } from '../lib/trainingConfigService.ts';

type DrillKey = `${string}||${string}`;

function makeDrillKey(sectionName: string, drillName: string): DrillKey {
  return `${sectionName}||${drillName}`;
}

interface SessionScreenProps {
  moduleId: string;
  session: Session;
  onBack?: () => void;
  onComplete?: (session: Session) => void;
}

export default function SessionScreen({
  moduleId,
  session,
  onBack,
  onComplete,
}: SessionScreenProps) {
  const mod = modules.find((m) => m.id === moduleId);
  const [holeScores, setHoleScores] = useState<Record<DrillKey, number[]>>(() => {
    const initial: Record<string, number[]> = {};
    if (mod) {
      for (const section of mod.sections) {
        for (const drill of section.drills) {
          initial[makeDrillKey(section.name, drill.name)] = Array(drill.holes).fill(0);
        }
      }
    }
    return initial as Record<DrillKey, number[]>;
  });
  const [submitting, setSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  if (!mod || !session) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Session data not found.</Text>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
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
    const section = moduleData.sections.find((sec) => sec.name === sectionName);
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
    for (const section of moduleData.sections) {
      const totals = getSectionTotal(section.name);
      holed += totals.holed;
      total += totals.total;
    }
    return { holed, total };
  }

  async function handleFinish() {
    setSubmitting(true);
    const drillResults: DrillResult[] = [];
    for (const section of moduleData.sections) {
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
    const completedSession: Session = {
      id: session.id,
      moduleId: session.moduleId,
      startedAt: session.startedAt,
      weekNumber: session.weekNumber,
      completedAt: new Date().toISOString(),
      drillResults,
    };
    await saveSession(completedSession);
    onComplete?.(completedSession);
    setSubmitting(false);
  }

  const grand = getGrandTotal();
  const grandPct = grand.total > 0 ? Math.round((grand.holed / grand.total) * 100) : 0;
  const currentSection = moduleData.sections[activeSection];

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
        {moduleData.sections.map((section, idx) => {
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
          ) : onBack ? (
            <TouchableOpacity onPress={onBack}>
              <Text style={styles.navPrev}>← Back</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          {activeSection < moduleData.sections.length - 1 ? (
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
