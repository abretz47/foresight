import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { createEmbeddedCheckoutSession } from '../lib/checkoutService';
import { COLORS } from '../styles/styles';

interface Props {
  priceId: string;
}

const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export default function EmbeddedStripeCheckout({ priceId }: Props) {
  const options = useMemo(
    () => ({
      fetchClientSecret: async () => createEmbeddedCheckoutSession(priceId),
    }),
    [priceId],
  );

  if (!publishableKey || !stripePromise) {
    return (
      <View style={s.notice}>
        <Text style={s.noticeText}>
          Checkout is unavailable because EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is not configured.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 460,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceAlt,
  },
  notice: {
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
  },
  noticeText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
});
