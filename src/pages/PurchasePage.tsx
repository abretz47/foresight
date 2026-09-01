/**
 * PurchasePage  (web only)
 *
 * Lists Platform Access and all published modules with title, description,
 * and price. Anonymous browse is allowed; login/signup is prompted at
 * checkout. Each module card can expand an embedded Stripe checkout form.
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
  Platform,
} from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { COLORS } from '../styles/styles';
import EmojiText from '../components/EmojiText';
import EmbeddedStripeCheckout from '../components/EmbeddedStripeCheckout';
import { fetchPublishedModules, TrainingModuleMeta } from '../lib/trainingCatalogService';
import { hasEntitlement } from '../lib/entitlementService';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../types/navigation';

interface Props {
  navigation: StackNavigationProp<RootStackParamList>;
  route: RouteProp<RootStackParamList, 'PurchasePage'>;
}

interface PurchaseModuleCardData extends TrainingModuleMeta {
  owned: boolean;
}

export default function PurchasePage({ navigation, route }: Props) {
  const [modules, setModules] = useState<PurchaseModuleCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCheckoutSlug, setActiveCheckoutSlug] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isCheckoutRedirectPending, setIsCheckoutRedirectPending] = useState(false);
  const [currentUser, setCurrentUser] = useState(route.params?.user ?? '');

  useEffect(() => {
    let isMounted = true;
    const checkoutStatus =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('checkout')
        : null;
    const checkoutSuccess = checkoutStatus === 'success';
    if (isMounted) {
      setIsCheckoutRedirectPending(checkoutSuccess);
    }

    const initializePage = async () => {
      let sessionUser:
        | {
            id?: string;
            email?: string;
            user_metadata?: { display_name?: string; name?: string };
          }
        | undefined;

      if (supabase) {
        const { data } = await supabase.auth.getSession();
        sessionUser = data.session?.user as typeof sessionUser;
        if (isMounted) {
          setIsSignedIn(!!sessionUser?.id);
        }
      } else if (isMounted) {
        setIsSignedIn(false);
      }

      const userFromSession =
        route.params?.user ??
        sessionUser?.user_metadata?.display_name ??
        sessionUser?.user_metadata?.name ??
        sessionUser?.email ??
        '';
      if (isMounted && userFromSession) {
        setCurrentUser(userFromSession);
      }

      if (checkoutStatus === 'success') {
        if (userFromSession) {
          if (isMounted) {
            navigation.replace('TrainingHome', { user: userFromSession });
          }
          return;
        }
        if (isMounted) setIsCheckoutRedirectPending(false);
      }

      try {
        const catalog = await fetchPublishedModules();
        const withOwnership = await Promise.all(
          catalog.map(async (m) => ({
            ...m,
            owned: await hasEntitlement('training:' + m.slug),
          })),
        );
        if (isMounted) {
          setModules(withOwnership);
        }
      } catch {
        if (isMounted) {
          setError('Failed to load module catalog. Please try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    void initializePage();

    return () => {
      isMounted = false;
    };
  }, [navigation, route.params?.user]);

  if (isCheckoutRedirectPending) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

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

  const formatModulePrice = (module: PurchaseModuleCardData): string | null => {
    if (module.display_price_cents == null || !module.display_price_currency) {
      return null;
    }
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: module.display_price_currency,
      }).format(module.display_price_cents / 100);
    } catch {
      return null;
    }
  };

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      <Text style={s.pageTitle}>Training Modules</Text>
      <Text style={s.pageSubtitle}>
        Purchase individual training modules below. Your entitlements apply across web and native.
      </Text>

      {/* Individual modules */}
      {modules.map((m) => {
        const displayPrice = formatModulePrice(m);
        return (
          <View key={m.slug} style={s.productCard}>
            <View style={s.productTop}>
              <EmojiText style={s.productIcon}>🏌️</EmojiText>
              <Text style={s.productTitle}>{m.title}</Text>
            </View>
            {displayPrice ? <Text style={s.productPrice}>{displayPrice}</Text> : null}
            <Text style={s.productDesc}>{m.description}</Text>
            {m.owned ? (
              <TouchableOpacity
                style={s.buyBtn}
                onPress={() => navigation.navigate('TrainingModule', { user: currentUser, slug: m.slug, componentKey: m.component_key })}
                activeOpacity={0.85}
              >
                <Text style={s.buyBtnLabel}>View Module</Text>
              </TouchableOpacity>
            ) : m.stripe_price_id ? (
              <>
                <TouchableOpacity
                  style={s.buyBtn}
                  onPress={() => setActiveCheckoutSlug((prev) => (prev === m.slug ? null : m.slug))}
                  activeOpacity={0.85}
                >
                  <Text style={s.buyBtnLabel}>
                    {activeCheckoutSlug === m.slug ? 'Hide Checkout' : 'Buy Module'}
                  </Text>
                </TouchableOpacity>
                {activeCheckoutSlug === m.slug ? (
                  <View style={s.checkoutContainer}>
                    {!isSignedIn ? (
                      <View style={s.signInPrompt}>
                        <Text style={s.signInText}>Sign in to start checkout.</Text>
                        <TouchableOpacity
                          style={s.signInBtn}
                          onPress={() => navigation.navigate('Login')}
                          activeOpacity={0.85}
                        >
                          <Text style={s.signInBtnLabel}>Go to Login</Text>
                        </TouchableOpacity>
                      </View>
                    ) : Platform.OS === 'web' ? (
                      <EmbeddedStripeCheckout priceId={m.stripe_price_id} />
                    ) : (
                      <Text style={s.signInText}>Checkout is available on the web purchase page.</Text>
                    )}
                  </View>
                ) : null}
              </>
            ) : (
              <View style={s.comingSoon}>
                <Text style={s.comingSoonText}>Coming soon</Text>
              </View>
            )}
          </View>
        );
      })}

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
  productPrice: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 10 },
  productDesc: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 16 },
  buyBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buyBtnLabel: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 15 },
  checkoutContainer: { marginTop: 12 },
  signInPrompt: {
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    gap: 10,
    alignItems: 'center',
  },
  signInText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  signInBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  signInBtnLabel: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
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
