/**
 * TrainingModule
 *
 * Overview screen for a single training module.
 * Shows title, description, and thumbnail.  The "Start Drill" button is
 * shown only when the user owns the module (has `training:{slug}` entitlement).
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { COLORS } from '../styles/styles';
import EmojiText from '../components/EmojiText';
import { fetchPublishedModules, TrainingModuleMeta } from '../lib/trainingCatalogService';
import { hasEntitlement } from '../lib/entitlementService';
import TrainingModuleDetails from '../components/TrainingModuleDetails';
import { resolveModuleDetails } from '../lib/trainingModuleRegistry';
import type { RootStackParamList } from '../types/navigation';
import '../lib/trainingModuleRegistry';

interface Props {
  navigation: StackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'TrainingModule'>;
}

export default function TrainingModule({ navigation, route }: Props) {
  const { user, slug } = route.params;
  const [module, setModule] = useState<TrainingModuleMeta | null>(null);
  const [owned, setOwned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const catalog = await fetchPublishedModules();
        const found = catalog.find((m) => m.slug === slug) ?? null;
        const isOwned = await hasEntitlement('training:' + slug);
        if (!cancelled) {
          setModule(found);
          setOwned(isOwned);
        }
      } catch {
        if (!cancelled) setError('Failed to load module details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  if (error || !module) {
    return (
      <View style={s.centered}>
        <EmojiText style={s.errorIcon}>⚠️</EmojiText>
        <Text style={s.errorText}>{error ?? 'Module not found.'}</Text>
      </View>
    );
  }

  const ModuleDetailsComponent = resolveModuleDetails(module.component_key) ??
    resolveModuleDetails(slug) ??
    TrainingModuleDetails;

  return (
    <ModuleDetailsComponent
      module={module}
      owned={owned}
      onStart={() => navigation.navigate('DrillRunner', { user, slug, componentKey: module.component_key || slug })}
    />
  );
}

const s = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  errorIcon: { fontSize: 36, marginBottom: 12 },
  errorText: { color: COLORS.textLight, fontSize: 15, textAlign: 'center' },
});
