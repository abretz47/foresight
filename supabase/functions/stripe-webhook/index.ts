/**
 * stripe-webhook  —  Supabase Edge Function
 *
 * POST /functions/v1/stripe-webhook
 *
 * Handles Stripe `checkout.session.completed` events:
 *   1. Verifies the Stripe webhook signature.
 *   2. Extracts `client_reference_id` (Supabase user_id) and `price_id`.
 *   3. Resolves the entitlement key for the price:
 *      - Platform Access price → 'paid-content-user'
 *      - Module price → looks up `training_modules.stripe_price_id` → `training:{slug}`
 *   4. Upserts a row in `user_entitlements` (idempotent on `stripe_event_id`).
 *
 * Environment variables required:
 *   STRIPE_WEBHOOK_SECRET  — webhook signing secret from Stripe Dashboard
 *   STRIPE_SECRET_KEY      — Stripe secret key (for verifying the event)
 *   SUPABASE_URL           — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   STRIPE_PLATFORM_PRICE_ID  — Price ID for the platform access product
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const PLATFORM_PRICE_ID = Deno.env.get('STRIPE_PLATFORM_PRICE_ID') ?? '';

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook signature verification failed.';
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.client_reference_id;
  if (!userId) {
    console.error('[stripe-webhook] Missing client_reference_id on session:', session.id);
    return new Response(JSON.stringify({ error: 'Missing user reference.' }), { status: 400 });
  }

  // Retrieve line items to get the Price ID(s).
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });

  const grants: Array<{ user_id: string; entitlement_key: string; source: string; stripe_event_id: string }> = [];

  for (const item of lineItems.data) {
    const priceId = item.price?.id;
    if (!priceId) continue;

    let entitlementKey: string | null = null;

    if (priceId === PLATFORM_PRICE_ID) {
      entitlementKey = 'paid-content-user';
    } else {
      // Look up module by stripe_price_id.
      const { data: moduleRow, error: moduleError } = await adminClient
        .from('training_modules')
        .select('slug')
        .eq('stripe_price_id', priceId)
        .maybeSingle();
      if (moduleError) {
        console.error('[stripe-webhook] Failed to resolve module price:', moduleError);
        return new Response(JSON.stringify({ error: 'Failed to resolve entitlement.' }), { status: 500 });
      }
      if (moduleRow) {
        entitlementKey = 'training:' + moduleRow.slug;
      }
    }

    if (entitlementKey) {
      grants.push({
        user_id: userId,
        entitlement_key: entitlementKey,
        source: 'stripe',
        stripe_event_id: event.id + ':' + priceId,
      });
    }
  }

  if (grants.length > 0) {
    const { error } = await adminClient
      .from('user_entitlements')
      .upsert(grants, { onConflict: 'user_id,entitlement_key', ignoreDuplicates: true });
    if (error) {
      console.error('[stripe-webhook] Failed to insert entitlements:', error);
      return new Response(JSON.stringify({ error: 'Failed to grant entitlements.' }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ received: true, granted: grants.length }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
