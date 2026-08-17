import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { COLORS } from '../../styles/styles';
import type { TrainingModuleProps } from '../../lib/trainingModuleRegistry';
import {
  fetchLatestTrainingModuleAssessment,
  saveTrainingModuleAssessment,
} from '../../lib/trainingModuleAssessmentService';

interface Question {
  id: string;
  prompt: string;
  options: string[];
}

interface SessionDrill {
  id: string;
  title: string;
  description?: string;
  clubHint?: string;
}

interface SessionCard {
  id: string;
  title: string;
  description?: string;
  drills: SessionDrill[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readSessionCards(manifest: TrainingModuleProps['manifest']): SessionCard[] {
  const parameters = asRecord(manifest.parameters);
  const parameterProgram = asRecord(parameters?.program);
  const candidateCollections: unknown[] = [
    (manifest as unknown as Record<string, unknown>).sessions,
    parameters?.sessions,
    parameters?.sessionPlan,
    parameters?.weeks,
    parameterProgram?.sessions,
    parameterProgram?.weeks,
  ];

  const firstCollection = candidateCollections.find((candidate) => Array.isArray(candidate));
  const sessions = asArray(firstCollection);
  return sessions
    .map((sessionValue, sessionIndex) => {
      const session = asRecord(sessionValue);
      if (!session) return null;
      const sessionTitle = asString(session.title)
        ?? asString(session.name)
        ?? asString(session.weekTitle)
        ?? asString(session.sessionName)
        ?? `Session ${sessionIndex + 1}`;
      const sessionDescription = asString(session.description)
        ?? asString(session.subtitle)
        ?? asString(session.objective)
        ?? undefined;

      const drillValues = asArray(session.drills).length > 0
        ? asArray(session.drills)
        : asArray(session.steps).length > 0
          ? asArray(session.steps)
          : asArray(session.activities);
      const drills = drillValues
        .map((drillValue, drillIndex) => {
          const drill = asRecord(drillValue);
          if (!drill) return null;
          const drillTitle = asString(drill.title)
            ?? asString(drill.name)
            ?? asString(drill.label)
            ?? `Drill ${drillIndex + 1}`;
          return {
            id: asString(drill.id) ?? `drill-${sessionIndex + 1}-${drillIndex + 1}`,
            title: drillTitle,
            description: asString(drill.description) ?? asString(drill.instructions) ?? undefined,
            clubHint: asString(drill.club) ?? asString(drill.clubName) ?? asString(drill.shotName) ?? undefined,
          };
        })
        .filter((drill): drill is SessionDrill => drill !== null);

      if (drills.length === 0) {
        drills.push({
          id: `session-${sessionIndex + 1}-default`,
          title: 'Start Session',
          clubHint: asString(session.club) ?? asString(session.clubName) ?? asString(parameters?.defaultClub) ?? undefined,
        });
      }

      return {
        id: asString(session.id) ?? `session-${sessionIndex + 1}`,
        title: sessionTitle,
        description: sessionDescription,
        drills,
      };
    })
    .filter((session): session is SessionCard => session !== null);
}

function readQuestions(manifest: TrainingModuleProps['manifest']): Question[] {
  const fromParameters = (manifest.parameters?.assessmentQuestions ?? []) as unknown[];
  if (!Array.isArray(fromParameters) || fromParameters.length === 0) {
    return [];
  }
  return fromParameters
    .map((raw, index) => {
      const value = raw as { id?: string; prompt?: string; options?: unknown[] };
      const options = Array.isArray(value.options) ? value.options.filter((o): o is string => typeof o === 'string') : [];
      if (!value.prompt || options.length === 0) return null;
      return {
        id: value.id ?? `q-${index + 1}`,
        prompt: value.prompt,
        options,
      };
    })
    .filter((v): v is Question => v !== null);
}

function resolveShotProfile(
  hostContext: TrainingModuleProps['hostContext'],
  clubHint?: string
) {
  if (clubHint) {
    const needle = clubHint.toLowerCase();
    const exact = hostContext.shotProfiles.find((profile) => profile.name.toLowerCase() === needle);
    if (exact) return exact;
    const partial = hostContext.shotProfiles.find((profile) => profile.name.toLowerCase().includes(needle));
    if (partial) return partial;
  }
  const putter = hostContext.shotProfiles.find((profile) => profile.name.toLowerCase().includes('putter'));
  if (putter) return putter;
  return [...hostContext.shotProfiles]
    .sort((a, b) => (Number(a.distance) || 0) - (Number(b.distance) || 0))[0];
}

export function PuttingAssessmentModule({ manifest, moduleSlug, onComplete, hostContext }: TrainingModuleProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingPrevious, setLoadingPrevious] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questions = useMemo(() => readQuestions(manifest), [manifest]);
  const sessions = useMemo(() => readSessionCards(manifest), [manifest]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const previous = await fetchLatestTrainingModuleAssessment(moduleSlug, 'putting-assessment');
        const priorAnswers = (previous?.payload?.answers ?? {}) as Record<string, string>;
        if (!cancelled && priorAnswers && typeof priorAnswers === 'object') {
          setAnswers(priorAnswers);
        }
      } catch {
        // Ignore load failures and allow fresh completion.
      } finally {
        if (!cancelled) setLoadingPrevious(false);
      }
    })();
    return () => { cancelled = true; };
  }, [moduleSlug]);

  const noQuestions = questions.length === 0;
  const missing = noQuestions || questions.some((q) => !answers[q.id]);

  const startSession = async (session: SessionCard, drill: SessionDrill) => {
    const shot = resolveShotProfile(hostContext, drill.clubHint);
    if (!shot) {
      setError('No shot profiles found. Add a club in your profile before starting a session.');
      return;
    }
    try {
      await saveTrainingModuleAssessment(moduleSlug, 'putting-assessment-session', {
        moduleTitle: manifest.title,
        startedAt: new Date().toISOString(),
        sessionId: session.id,
        sessionTitle: session.title,
        drillId: drill.id,
        drillTitle: drill.title,
        club: shot.name,
      });
    } catch {
      // Best effort only; session launch should not fail if write fails.
    }
    hostContext.navigation.navigate('Record', {
      user: hostContext.user,
      id: shot.id,
      shotName: shot.name,
      targetDistance: shot.distance,
      targetRadius: shot.targetRadius,
      missRadius: shot.missRadius,
      calledFrom: 'DrillRunner',
    });
  };

  const submit = async () => {
    if (missing || saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveTrainingModuleAssessment(moduleSlug, 'putting-assessment', {
        moduleTitle: manifest.title,
        submittedAt: new Date().toISOString(),
        answers,
      });
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save assessment.');
    } finally {
      setSaving(false);
    }
  };

  if (loadingPrevious) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.title}>{manifest.title}</Text>
      <Text style={s.description}>{manifest.description}</Text>
      {sessions.map((session) => (
        <View key={session.id} style={s.sessionCard}>
          <Text style={s.sessionTitle}>{session.title}</Text>
          {session.description ? <Text style={s.sessionDescription}>{session.description}</Text> : null}
          {session.drills.map((drill) => (
            <View key={drill.id} style={s.drillRow}>
              <View style={s.drillTextWrap}>
                <Text style={s.drillTitle}>{drill.title}</Text>
                {drill.description ? <Text style={s.drillDescription}>{drill.description}</Text> : null}
              </View>
              <TouchableOpacity style={s.startSessionBtn} onPress={() => { void startSession(session, drill); }}>
                <Text style={s.startSessionLabel}>Start Session</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ))}
      {questions.map((question) => (
        <View key={question.id} style={s.questionCard}>
          <Text style={s.questionPrompt}>{question.prompt}</Text>
          <View style={s.optionRow}>
            {question.options.map((option) => {
              const selected = answers[question.id] === option;
              return (
                <TouchableOpacity
                  key={option}
                  style={[s.optionBtn, selected && s.optionBtnSelected]}
                  onPress={() => setAnswers((prev) => ({ ...prev, [question.id]: option }))}
                >
                  <Text style={[s.optionLabel, selected && s.optionLabelSelected]}>{option}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
      {noQuestions && sessions.length === 0 ? (
        <Text style={s.errorText}>Assessment configuration is unavailable for this module.</Text>
      ) : null}
      {error ? <Text style={s.errorText}>{error}</Text> : null}
      {questions.length > 0 ? (
        <TouchableOpacity
          style={[s.submitBtn, (missing || saving) && s.submitBtnDisabled]}
          onPress={submit}
          disabled={missing || saving}
        >
          <Text style={s.submitLabel}>{saving ? 'Saving…' : 'Save Assessment'}</Text>
        </TouchableOpacity>
      ) : null}
      {sessions.length > 0 ? (
        <TouchableOpacity style={s.completeBtn} onPress={onComplete}>
          <Text style={s.completeLabel}>Done</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.textLight, marginBottom: 12 },
  description: { fontSize: 15, color: COLORS.textMuted, lineHeight: 22, marginBottom: 24 },
  sessionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  sessionTitle: { color: COLORS.textLight, fontSize: 17, fontWeight: '800', marginBottom: 6 },
  sessionDescription: { color: COLORS.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  drillRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.primary,
    paddingTop: 10,
    gap: 10,
  },
  drillTextWrap: { gap: 4 },
  drillTitle: { color: COLORS.textLight, fontSize: 14, fontWeight: '700' },
  drillDescription: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18 },
  startSessionBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  startSessionLabel: { color: COLORS.textPrimary, fontWeight: '800', fontSize: 14 },
  questionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  questionPrompt: { color: COLORS.textLight, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  optionBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.textMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionBtnSelected: { borderColor: COLORS.accent, backgroundColor: COLORS.accent },
  optionLabel: { color: COLORS.textLight, fontWeight: '600', fontSize: 13 },
  optionLabelSelected: { color: COLORS.textPrimary },
  submitBtn: {
    marginTop: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitLabel: { color: COLORS.textPrimary, fontWeight: '800', fontSize: 15 },
  completeBtn: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.textMuted,
    paddingVertical: 12,
    alignItems: 'center',
  },
  completeLabel: { color: COLORS.textLight, fontWeight: '700', fontSize: 14 },
  errorText: { color: '#ff8080', marginBottom: 8, fontSize: 13 },
});
