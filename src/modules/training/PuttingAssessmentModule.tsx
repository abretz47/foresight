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

export function PuttingAssessmentModule({ manifest, moduleSlug, onComplete }: TrainingModuleProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingPrevious, setLoadingPrevious] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const questions = useMemo(() => readQuestions(manifest), [manifest]);

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
      {noQuestions ? (
        <Text style={s.errorText}>Assessment configuration is unavailable for this module.</Text>
      ) : null}
      {error ? <Text style={s.errorText}>{error}</Text> : null}
      <TouchableOpacity
        style={[s.submitBtn, (missing || saving) && s.submitBtnDisabled]}
        onPress={submit}
        disabled={missing || saving}
      >
        <Text style={s.submitLabel}>{saving ? 'Saving…' : 'Save Assessment'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.textLight, marginBottom: 12 },
  description: { fontSize: 15, color: COLORS.textMuted, lineHeight: 22, marginBottom: 24 },
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
  errorText: { color: '#ff8080', marginBottom: 8, fontSize: 13 },
});
