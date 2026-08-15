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
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { COLORS } from '../styles/styles';
import EmojiText from '../components/EmojiText';
import { fetchPublishedModules, TrainingModuleMeta } from '../lib/trainingCatalogService';
import { hasEntitlement } from '../lib/entitlementService';
import type { RootStackParamList } from '../types/navigation';

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

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {module.thumbnail_url ? (
        <Image source={{ uri: module.thumbnail_url }} style={s.thumbnail} resizeMode="cover" />
      ) : (
        <View style={s.thumbnailPlaceholder}>
          <EmojiText style={s.thumbnailIcon}>🏌️</EmojiText>
        </View>
      )}
      <Text style={s.title}>{module.title}</Text>
      <Text style={s.description}>{module.description}</Text>

      {owned ? (
        <TouchableOpacity
          style={s.startBtn}
          onPress={() => navigation.navigate('DrillRunner', { user, slug, componentKey: module.component_key })}
          activeOpacity={0.85}
        >
          <Text style={s.startBtnLabel}>Start Drill</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.lockedBox}>
          <EmojiText style={s.lockedIcon}>🔒</EmojiText>
          <Text style={s.lockedText}>Purchase this module to start the drill.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  thumbnail: { width: '100%', height: 200, borderRadius: 16, marginBottom: 20 },
  thumbnailPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  thumbnailIcon: { fontSize: 60 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.textLight, marginBottom: 12 },
  description: { fontSize: 16, color: COLORS.textMuted, lineHeight: 24, marginBottom: 32 },
  startBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnLabel: { fontWeight: '800', fontSize: 17, color: COLORS.textPrimary },
  lockedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  lockedIcon: { fontSize: 24 },
  lockedText: { flex: 1, color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  errorIcon: { fontSize: 36, marginBottom: 12 },
  errorText: { color: COLORS.textLight, fontSize: 15, textAlign: 'center' },
});
