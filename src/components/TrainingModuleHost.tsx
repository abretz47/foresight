import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS } from '../styles/styles';
import EmojiText from './EmojiText';
import { fetchManifest, DrillManifest } from '../lib/trainingConfigService';
import { fetchPublishedModules } from '../lib/trainingCatalogService';
import { resolveModule } from '../lib/trainingModuleRegistry';
import { TrainingHostContextProvider } from '../lib/trainingHostContext';
import { getShotProfileAsync, ShotProfile } from '../data/db';
import type { RootStackParamList } from '../types/navigation';

// Ensure the registry is populated for OSS/stub builds.
import '../lib/trainingModuleRegistry';

interface TrainingModuleHostProps {
  navigation: StackNavigationProp<RootStackParamList>;
  user: string;
  slug: string;
  componentKey?: string;
}

export default function TrainingModuleHost({
  navigation,
  user,
  slug,
  componentKey,
}: TrainingModuleHostProps) {
  const [manifest, setManifest] = useState<DrillManifest | null>(null);
  const [shotProfiles, setShotProfiles] = useState<ShotProfile[]>([]);
  const [resolvedComponentKey, setResolvedComponentKey] = useState<string | null>(componentKey ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      fetchManifest(slug),
      getShotProfileAsync(user),
      componentKey
        ? Promise.resolve(componentKey)
        : fetchPublishedModules().then((catalog) => {
            const module = catalog.find((item) => item.slug === slug);
            if (!module) {
              throw new Error('Module not found.');
            }
            return module.component_key;
          }),
    ])
      .then(([nextManifest, nextShotProfiles, nextComponentKey]) => {
        setManifest(nextManifest);
        setShotProfiles(nextShotProfiles);
        setResolvedComponentKey(nextComponentKey);
        navigation.setOptions({ title: nextManifest.title });
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Failed to load drill content.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [componentKey, navigation, slug, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={COLORS.accent} size="large" />
        <Text style={s.loadingText}>Loading drill…</Text>
      </View>
    );
  }

  if (error || !manifest || !resolvedComponentKey) {
    const isConnectivity =
      error?.toLowerCase().includes('network') ||
      error?.toLowerCase().includes('failed to fetch');

    return (
      <View style={s.centered}>
        <EmojiText style={s.errorIcon}>{isConnectivity ? '📶' : '⚠️'}</EmojiText>
        <Text style={s.errorText}>
          {isConnectivity
            ? 'No internet connection and no cached content available. Please connect and try again.'
            : error ?? 'An error occurred loading this drill.'}
        </Text>
        <TouchableOpacity style={s.retryBtn} onPress={load}>
          <Text style={s.retryLabel}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ModuleComponent = resolveModule(resolvedComponentKey);
  if (!ModuleComponent) {
    return (
      <View style={s.centered}>
        <EmojiText style={s.errorIcon}>⚠️</EmojiText>
        <Text style={s.errorText}>
          This module requires an app update. Please update Foresight to access this drill.
        </Text>
      </View>
    );
  }

  const handleBack = () => navigation.goBack();
  const handleComplete = () => navigation.goBack();
  const hostContext = { navigation, user, shotProfiles, onBack: handleBack, onComplete: handleComplete };

  return (
    <TrainingHostContextProvider value={hostContext}>
      <ModuleComponent
        manifest={manifest}
        hostContext={hostContext}
        onComplete={handleComplete}
      />
    </TrainingHostContextProvider>
  );
}

const s = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: { color: COLORS.textMuted, fontSize: 14, marginTop: 14 },
  errorIcon: { fontSize: 40, marginBottom: 14 },
  errorText: { color: COLORS.textLight, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  retryBtn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  retryLabel: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 15 },
});
