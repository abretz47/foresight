/**
 * create-embedded-checkout-session — Supabase Edge Function
 *
 * POST /functions/v1/create-embedded-checkout-session
 * Body: { "priceId": "price_..." }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@22';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const WEB_APP_URL = (
  Deno.env.get('WEB_APP_URL') ??
  Deno.env.get('EXPO_PUBLIC_WEB_APP_URL') ??
  ''
).replace(/\/$/, '');

const stripe = new Stripe(STRIPE_SECRET_KEY);

const adminClient = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

export default {
  async fetch(req: Request): Promise<Response> {
    try {
      if (req.method === 'OPTIONS') {
        return new Response('ok', {
          headers: corsHeaders,
        });
      }

      if (req.method !== 'POST') {
        return jsonResponse(
          { error: 'Method Not Allowed' },
          405,
        );
      }

      //
      // Verify server configuration
      //
      if (
        !STRIPE_SECRET_KEY ||
        !SUPABASE_URL ||
        !SUPABASE_SERVICE_ROLE_KEY ||
        !WEB_APP_URL
      ) {
        console.error('Missing checkout configuration', {
          hasStripeSecretKey: !!STRIPE_SECRET_KEY,
          hasSupabaseUrl: !!SUPABASE_URL,
          hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY,
          hasWebAppUrl: !!WEB_APP_URL,
        });

        return jsonResponse(
          { error: 'Server is not configured for checkout.' },
          500,
        );
      }

      //
      // Authenticate Supabase user
      //
      const authHeader =
        req.headers.get('Authorization') ?? '';

      const accessToken =
        authHeader.startsWith('Bearer ')
          ? authHeader.slice(7).trim()
          : '';

      if (!accessToken) {
        return jsonResponse(
          { error: 'Authentication required.' },
          401,
        );
      }

      const {
        data: userData,
        error: userError,
      } = await adminClient.auth.getUser(accessToken);

      if (userError) {
        console.error(
          'Supabase auth.getUser failed:',
          userError,
        );

        return jsonResponse(
          { error: 'Invalid auth token.' },
          401,
        );
      }

      const userId = userData.user?.id;

      if (!userId) {
        return jsonResponse(
          { error: 'Invalid auth token.' },
          401,
        );
      }

      //
      // Parse request
      //
      let payload: {
        priceId?: string;
      };

      try {
        payload = await req.json();
      } catch (error) {
        console.error(
          'Failed to parse request body:',
          error,
        );

        return jsonResponse(
          { error: 'Invalid request body.' },
          400,
        );
      }

      const priceId = payload.priceId?.trim();

      if (!priceId) {
        return jsonResponse(
          { error: 'priceId is required.' },
          400,
        );
      }

      //
      // Verify this is an actual published module
      //
      const {
        data: moduleRow,
        error: moduleError,
      } = await adminClient
        .from('training_modules')
        .select('slug')
        .eq('stripe_price_id', priceId)
        .eq('is_published', true)
        .maybeSingle();

      if (moduleError) {
        console.error(
          'training_modules lookup failed:',
          moduleError,
        );

        return jsonResponse(
          { error: 'Failed to verify module price.' },
          500,
        );
      }

      if (!moduleRow) {
        return jsonResponse(
          { error: 'Unknown module price.' },
          400,
        );
      }

      //
      // Create Stripe Embedded Checkout session
      //
      let session: Stripe.Checkout.Session;

      try {
        console.log(
          `Creating Stripe checkout session for user ${userId}, module ${moduleRow.slug}`,
        );

        session =
          await stripe.checkout.sessions.create({
            ui_mode: 'embedded',
            mode: 'payment',

            client_reference_id: userId,

            line_items: [
              {
                price: priceId,
                quantity: 1,
              },
            ],

            return_url:
              `${WEB_APP_URL}/purchase` +
              `?checkout=success` +
              `&session_id={CHECKOUT_SESSION_ID}`,

            metadata: {
              user_id: userId,
              module_slug: moduleRow.slug,
            },

            payment_intent_data: {
              metadata: {
                user_id: userId,
                module_slug: moduleRow.slug,
              },
            },
          });
      } catch (error) {
        //
        // IMPORTANT:
        // Don't hide the Stripe exception while debugging.
        //
        console.error(
          'Stripe checkout.sessions.create failed:',
          error,
        );

        if (error instanceof Stripe.errors.StripeError) {
          console.error('Stripe error details:', {
            type: error.type,
            code: error.code,
            message: error.message,
            requestId: error.requestId,
            statusCode: error.statusCode,
          });
        }

        return jsonResponse(
          { error: 'Failed to create checkout session.' },
          500,
        );
      }

      if (!session.client_secret) {
        console.error(
          'Stripe session did not contain client_secret:',
          session.id,
        );

        return jsonResponse(
          { error: 'Failed to create checkout session.' },
          500,
        );
      }

      console.log(
        `Created Stripe Checkout Session ${session.id}`,
      );

      return jsonResponse({
        clientSecret: session.client_secret,
      });
    } catch (error) {
      //
      // Last-resort error handler.
      //
      console.error(
        'Unhandled create-checkout error:',
        error,
      );

      return jsonResponse(
        { error: 'Internal server error.' },
        500,
      );
    }
  },
};