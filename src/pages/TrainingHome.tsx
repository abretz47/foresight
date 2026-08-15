/**
 * TrainingHome
 *
 * Card-grid screen showing all published training modules.
 * Requires `paid-content-user` entitlement (enforced by TrainingAccessGate).
 *
 * - Owned modules: tappable → TrainingModule overview
 * - Unowned modules: visually locked, not tappable
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ListRenderItemInfo,
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
  route: RouteProp<RootStackParamList, 'TrainingHome'>;
}

interface ModuleCardData extends TrainingModuleMeta {
  owned: boolean;
}

export default function TrainingHome({ navigation, route }: Props) {
  const user = route.params.user;
  const [modules, setModules] = useState<ModuleCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const catalog = await fetchPublishedModules();
      const withOwnership = await Promise.all(
        catalog.map(async (m) => ({
          ...m,
          owned: await hasEntitlement('training:' + m.slug),
        }))
      );
      setModules(withOwnership);
    } catch (e) {
      setError('Failed to load training modules. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const renderItem = ({ item }: ListRenderItemInfo<ModuleCardData>) => {
    const card = (
      <View style={[s.card, item.owned ? s.cardOwned : s.cardLocked]}>
        <View style={s.cardTop}>
          <EmojiText style={s.cardIcon}>{item.owned ? '🏌️' : '🔒'}</EmojiText>
          {!item.owned && <View style={s.lockBadge}><Text style={s.lockBadgeText}>Locked</Text></View>}
        </View>
        <Text style={[s.cardTitle, !item.owned && s.cardTitleLocked]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={s.cardDesc} numberOfLines={3}>{item.description}</Text>
      </View>
    );

    if (!item.owned) return card;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('TrainingModule', { user, slug: item.slug })}
        activeOpacity={0.85}
      >
        {card}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={s.centered}>
        <EmojiText style={s.errorIcon}>⚠️</EmojiText>
        <Text style={s.errorText}>{error}</Text>
        <TouchableOpacity style={s.retryBtn} onPress={load}>
          <Text style={s.retryLabel}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      style={s.list}
      contentContainerStyle={s.listContent}
      data={modules}
      keyExtractor={(item) => item.slug}
      numColumns={2}
      renderItem={renderItem}
      ListEmptyComponent={
        <View style={s.centered}>
          <Text style={s.emptyText}>No training modules available yet.</Text>
        </View>
      }
    />
  );
}

const s = StyleSheet.create({
  list: { flex: 1, backgroundColor: COLORS.background },
  listContent: { padding: 12, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  card: {
    flex: 1,
    margin: 6,
    borderRadius: 16,
    padding: 16,
    minHeight: 160,
  },
  cardOwned: { backgroundColor: COLORS.surface },
  cardLocked: { backgroundColor: COLORS.surfaceAlt, opacity: 0.7 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardIcon: { fontSize: 28 },
  lockBadge: {
    backgroundColor: COLORS.textSecondary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lockBadgeText: { color: COLORS.textLight, fontSize: 10, fontWeight: '700' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  cardTitleLocked: { color: COLORS.textSecondary },
  cardDesc: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17 },
  errorIcon: { fontSize: 36, marginBottom: 12 },
  errorText: { color: COLORS.textLight, fontSize: 15, textAlign: 'center', marginBottom: 20 },
  retryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryLabel: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 15 },
  emptyText: { color: COLORS.textMuted, fontSize: 15 },
});
