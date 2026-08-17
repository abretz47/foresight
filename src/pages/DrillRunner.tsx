/**
 * DrillRunner
 *
 * Orchestrates:
 *   1. Resolve the module React component from TrainingModuleRegistry
 *   2. Fetch the drill manifest via TrainingConfigService
 *   3. Render the component with manifest + host context
 *
 * Shows loading, error (no network / no cache), and the drill content.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { COLORS } from '../styles/styles';
import EmojiText from '../components/EmojiText';
import { fetchManifest, DrillManifest } from '../lib/trainingConfigService';
import { resolveModule } from '../lib/trainingModuleRegistry';
import { TrainingHostContextProvider } from '../lib/trainingHostContext';
import { getShotProfileAsync, ShotProfile } from '../data/db';
import type { RootStackParamList } from '../types/navigation';

// Ensure the registry is populated for OSS/stub builds.
import '../lib/trainingModuleRegistry';

interface Props {
  navigation: StackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'DrillRunner'>;
}

export default function DrillRunner({ navigation, route }: Props) {
  const { user, slug, componentKey } = route.params;
  const [manifest, setManifest] = useState<DrillManifest | null>(null);
  const [shotProfiles, setShotProfiles] = useState<ShotProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchManifest(slug),
      getShotProfileAsync(user),
    ])
      .then(([nextManifest, nextShotProfiles]) => {
        setManifest(nextManifest);
        setShotProfiles(nextShotProfiles);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Failed to load drill content.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, [slug, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={COLORS.accent} size="large" />
        <Text style={s.loadingText}>Loading drill…</Text>
      </View>
    );
  }

  if (error || !manifest) {
    const isConnectivity = error?.toLowerCase().includes('network') ||
                           error?.toLowerCase().includes('failed to fetch');
    return (
      <View style={s.centered}>
        <EmojiText style={s.errorIcon}>{isConnectivity ? '📶' : '⚠️'}</EmojiText>
        <Text style={s.errorText}>
          {isConnectivity
            ? 'No internet connection and no cached content available. Please connect and try again.'
            : (error ?? 'An error occurred loading this drill.')}
        </Text>
        <TouchableOpacity style={s.retryBtn} onPress={load}>
          <Text style={s.retryLabel}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const ModuleComponent = resolveModule(componentKey) ?? resolveModule(slug);
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

  return (
    <TrainingHostContextProvider value={{ navigation, user, shotProfiles }}>
      <ModuleComponent
        manifest={manifest}
        hostContext={{ navigation, user, shotProfiles }}
        moduleSlug={slug}
        onComplete={() => navigation.goBack()}
      />
    </TrainingHostContextProvider>
  );
}

const s = StyleSheet.create({
  centered: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { color: COLORS.textMuted, fontSize: 14, marginTop: 14 },
  errorIcon: { fontSize: 40, marginBottom: 14 },
  errorText: { color: COLORS.textLight, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  retryBtn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12 },
  retryLabel: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 15 },
});
