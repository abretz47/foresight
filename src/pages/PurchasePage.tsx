/**
 * PurchasePage  (web only)
 *
 * Lists Platform Access and all published modules with title, description,
 * and price.  Anonymous browse is allowed; login/signup is prompted at
 * checkout.  Each "Buy" button creates a Stripe Checkout Session via the
 * `stripe-webhook` infrastructure (separate checkout initiation endpoint
 * or direct Stripe Checkout link).
 *
 * On native the user is directed here from PurchasePromptModal via their
 * device browser; this component is registered in the navigator but is
 * intended for web-only rendering.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS } from '../styles/styles';
import EmojiText from '../components/EmojiText';
import { fetchPublishedModules, TrainingModuleMeta } from '../lib/trainingCatalogService';
import type { RootStackParamList } from '../types/navigation';

interface Props {
  navigation: StackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'PurchasePage'>;
}

const PLATFORM_ACCESS_PRICE_ID = process.env.EXPO_PUBLIC_STRIPE_PLATFORM_PRICE_ID ?? '';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

/** Opens Stripe Checkout for the given Stripe Price ID. */
function openCheckout(priceId: string): void {
  if (!priceId) {
    console.warn('[PurchasePage] No Stripe Price ID configured for this product.');
    return;
  }
  const checkoutUrl = SUPABASE_URL + '/functions/v1/create-checkout-session?price_id=' + priceId;
  void Linking.openURL(checkoutUrl);
}

export default function PurchasePage({ navigation }: Props) {
  const [modules, setModules] = useState<TrainingModuleMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPublishedModules()
      .then(setModules)
      .catch(() => setError('Failed to load module catalog. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

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
      </View>
    );
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Training Modules</Text>
      <Text style={s.pageSubtitle}>
        Purchase Platform Access to unlock Training Home, then add individual modules.
      </Text>

      {/* Platform Access product */}
      <View style={s.productCard}>
        <View style={s.productTop}>
          <EmojiText style={s.productIcon}>🏆</EmojiText>
          <Text style={s.productTitle}>Platform Access</Text>
        </View>
        <Text style={s.productDesc}>
          Unlocks Training Home on web and native. Required before purchasing individual modules.
        </Text>
        <TouchableOpacity
          style={s.buyBtn}
          onPress={() => openCheckout(PLATFORM_ACCESS_PRICE_ID)}
          activeOpacity={0.85}
        >
          <Text style={s.buyBtnLabel}>Buy Access</Text>
        </TouchableOpacity>
      </View>

      {/* Individual modules */}
      {modules.map((m) => (
        <View key={m.slug} style={s.productCard}>
          <View style={s.productTop}>
            <EmojiText style={s.productIcon}>🏌️</EmojiText>
            <Text style={s.productTitle}>{m.title}</Text>
          </View>
          <Text style={s.productDesc}>{m.description}</Text>
          {m.stripe_price_id ? (
            <TouchableOpacity
              style={s.buyBtn}
              onPress={() => openCheckout(m.stripe_price_id!)}
              activeOpacity={0.85}
            >
              <Text style={s.buyBtnLabel}>Buy Module</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.comingSoon}>
              <Text style={s.comingSoonText}>Coming soon</Text>
            </View>
          )}
        </View>
      ))}

      <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
        <Text style={s.backBtnLabel}>← Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: COLORS.textLight, marginBottom: 8 },
  pageSubtitle: { fontSize: 14, color: COLORS.textMuted, lineHeight: 20, marginBottom: 28 },
  productCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  productTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 10 },
  productIcon: { fontSize: 28 },
  productTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary },
  productDesc: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 16 },
  buyBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buyBtnLabel: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 15 },
  comingSoon: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  comingSoonText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },
  errorIcon: { fontSize: 36, marginBottom: 12 },
  errorText: { color: COLORS.textLight, fontSize: 15, textAlign: 'center' },
  backBtn: { marginTop: 8, padding: 12, alignItems: 'center' },
  backBtnLabel: { color: COLORS.textMuted, fontSize: 15 },
});
