/**
 * create-embedded-checkout-session — Supabase Edge Function
 *
 * POST /functions/v1/create-embedded-checkout-session
 * Body: { "priceId": "price_..." }
 *
 * Creates a Stripe Checkout Session in embedded mode for a published
 * training module price and returns the Checkout client secret.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14?target=deno';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEB_APP_URL = (Deno.env.get('WEB_APP_URL') ?? Deno.env.get('EXPO_PUBLIC_WEB_APP_URL') ?? '').replace(/\/$/, '');

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !WEB_APP_URL) {
    return new Response(JSON.stringify({ error: 'Server is not configured for checkout.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'Authentication required.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: userData, error: userError } = await adminClient.auth.getUser(accessToken);
  const userId = userData.user?.id;
  if (userError || !userId) {
    return new Response(JSON.stringify({ error: 'Invalid auth token.' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: { priceId?: string };
  try {
    payload = (await req.json()) as { priceId?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const priceId = payload.priceId?.trim();
  if (!priceId) {
    return new Response(JSON.stringify({ error: 'priceId is required.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: moduleRow, error: moduleError } = await adminClient
    .from('training_modules')
    .select('slug')
    .eq('stripe_price_id', priceId)
    .eq('is_published', true)
    .maybeSingle();

  if (moduleError) {
    return new Response(JSON.stringify({ error: 'Failed to verify module price.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!moduleRow) {
    return new Response(JSON.stringify({ error: 'Unknown module price.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      client_reference_id: userId,
      line_items: [{ price: priceId, quantity: 1 }],
      return_url: `${WEB_APP_URL}/purchase?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      metadata: { module_slug: moduleRow.slug },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to create checkout session.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!session.client_secret) {
    return new Response(JSON.stringify({ error: 'Failed to create checkout session.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
