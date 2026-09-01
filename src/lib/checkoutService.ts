/**
 * checkoutService
 *
 * Shared utility for opening a Stripe Checkout session from the web client.
 */
import { Linking } from 'react-native';
import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

/** Opens Stripe Checkout for the given Stripe Price ID (web only). */
export function openCheckout(priceId: string): void {
  if (!priceId) {
    console.warn('[checkoutService] No Stripe Price ID configured for this product.');
    return;
  }
  const checkoutUrl =
    SUPABASE_URL +
    '/functions/v1/create-checkout-session?price_id=' +
    encodeURIComponent(priceId);
  void Linking.openURL(checkoutUrl);
}

/** Creates an embedded Stripe Checkout Session and returns its client secret. */
export async function createEmbeddedCheckoutSession(priceId: string): Promise<string> {
  if (!priceId) {
    throw new Error('No Stripe Price ID configured for this product.');
  }
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Please sign in to continue.');
  }

  const { data, error } = await supabase.functions.invoke('create-embedded-checkout-session', {
    body: { priceId },
  });
  if (error) {
    throw new Error(error.message || 'Failed to create checkout session.');
  }

  const clientSecret = (data as { clientSecret?: string } | null)?.clientSecret;
  if (!clientSecret) {
    throw new Error('Checkout session is missing a client secret.');
  }
  return clientSecret;
}
