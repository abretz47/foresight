/**
 * TrainingHome
 *
 * Card-grid screen showing all published training modules.
 *
 * - Owned modules: "View" button → TrainingModule content
 * - Unowned modules: "Buy" button →
 *     native: PurchasePromptModal (redirects to web)
 *     web:    Stripe Checkout
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ListRenderItemInfo,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { COLORS } from '../styles/styles';
import EmojiText from '../components/EmojiText';
import PurchasePromptModal from '../components/PurchasePromptModal';
import { fetchPublishedModules, TrainingModuleMeta } from '../lib/trainingCatalogService';
import { hasEntitlement, refreshSession } from '../lib/entitlementService';
import { openCheckout } from '../lib/checkoutService';
import type { RootStackParamList } from '../types/navigation';

interface Props {
  navigation: StackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'TrainingHome'>;
}

interface ModuleCardData extends TrainingModuleMeta {
  owned: boolean;
}

export function shouldRefreshOwnershipOnAppState(state: AppStateStatus): boolean {
  return state === 'active';
}

export async function refreshOwnership(load: () => Promise<void>): Promise<void> {
  await refreshSession();
  await load();
}

export default function TrainingHome({ navigation, route }: Props) {
  const user = route.params.user;
  const [modules, setModules] = useState<ModuleCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);
  const refreshAndLoadInFlightRef = useRef<Promise<void> | null>(null);

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

  const refreshAndLoad = useCallback(async () => {
    await refreshOwnership(load);
  }, [load]);

  const triggerRefreshAndLoad = useCallback(() => {
    if (!refreshAndLoadInFlightRef.current) {
      refreshAndLoadInFlightRef.current = refreshAndLoad().finally(() => {
        refreshAndLoadInFlightRef.current = null;
      });
    }
    return refreshAndLoadInFlightRef.current;
  }, [refreshAndLoad]);

  useFocusEffect(
    useCallback(() => {
      void triggerRefreshAndLoad();
      const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
        if (shouldRefreshOwnershipOnAppState(state)) {
          void triggerRefreshAndLoad();
        }
      });

      return () => {
        subscription.remove();
      };
    }, [triggerRefreshAndLoad]),
  );

  const handleBuy = (item: ModuleCardData) => {
    if (Platform.OS === 'web') {
      openCheckout(item.stripe_price_id ?? '');
    } else {
      setPurchaseModalVisible(true);
    }
  };

  const renderItem = ({ item }: ListRenderItemInfo<ModuleCardData>) => (
    <View style={[s.card, item.owned ? s.cardOwned : s.cardLocked]}>
      <View style={s.cardTop}>
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={s.cardThumbnail} resizeMode="cover" />
        ) : (
          <EmojiText style={s.cardIcon}>{item.owned ? '🏌️' : '🔒'}</EmojiText>
        )}
      </View>
      <Text style={[s.cardTitle, !item.owned && s.cardTitleLocked]} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={s.cardDesc} numberOfLines={3}>{item.description}</Text>
      {item.owned ? (
        <TouchableOpacity
          style={s.viewBtn}
          onPress={() => navigation.navigate('TrainingModule', { user, slug: item.slug, componentKey: item.component_key })}
          activeOpacity={0.85}
        >
          <Text style={s.viewBtnLabel}>View</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={s.buyBtn}
          onPress={() => handleBuy(item)}
          activeOpacity={0.85}
        >
          <Text style={s.buyBtnLabel}>Buy</Text>
        </TouchableOpacity>
      )}
    </View>
  );

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
    <>
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
      <PurchasePromptModal
        visible={purchaseModalVisible}
        onClose={() => setPurchaseModalVisible(false)}
      />
    </>
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
  cardLocked: { backgroundColor: COLORS.surfaceAlt, opacity: 0.85 },
  cardTop: { marginBottom: 10 },
  cardIcon: { fontSize: 28 },
  cardThumbnail: { width: '100%', height: 80, borderRadius: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  cardTitleLocked: { color: COLORS.textSecondary },
  cardDesc: { fontSize: 12, color: COLORS.textSecondary, lineHeight: 17, marginBottom: 12 },
  viewBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  viewBtnLabel: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 13 },
  buyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  buyBtnLabel: { fontWeight: '700', color: COLORS.accent, fontSize: 13 },
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
