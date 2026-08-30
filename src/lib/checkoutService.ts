/**
 * checkoutService
 *
 * Shared utility for opening a Stripe Checkout session from the web client.
 */
import { Linking } from 'react-native';

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
