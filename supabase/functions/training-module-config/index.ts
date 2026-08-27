/**
 * training-module-config  —  Supabase Edge Function
 *
 * GET /functions/v1/training-module-config/{slug}/config
 *
 * 1. Verifies the caller has a valid Supabase JWT.
 * 2. Checks the JWT `entitlements` claim for `training:{slug}`.
 * 3. Returns the active manifest JSON from `training_module_configs`.
 *    - 401 if no valid JWT
 *    - 403 if the caller lacks the required entitlement
 *    - 404 if the module is unpublished or has no active config
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

serve(async (req: Request) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: 'Server misconfiguration.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Extract slug from path: /training-module-config/{slug}/config
  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  // segments may be: ['functions', 'v1', 'training-module-config', '{slug}', 'config']
  // or just: ['{slug}', 'config'] depending on how Supabase routes it.
  // Find the slug by looking for 'config' at the end.
  const configIdx = segments.lastIndexOf('config');
  const slug = configIdx > 0 ? segments[configIdx - 1] : null;

  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing module slug.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. Verify JWT.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const jwt = authHeader.slice(7);

  // Use the anon client with the caller's JWT to verify identity.
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: 'Bearer ' + jwt } },
  });

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Check entitlement: read from user_entitlements (service role).
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const entitlementKey = 'training:' + slug;
  const { data: entRow } = await adminClient
    .from('user_entitlements')
    .select('entitlement_key')
    .eq('user_id', user.id)
    .eq('entitlement_key', entitlementKey)
    .maybeSingle();

  if (!entRow) {
    return new Response(JSON.stringify({ error: 'Forbidden.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Fetch the active manifest (only for published modules).
  const { data: config, error: configError } = await adminClient
    .from('training_module_configs')
    .select('manifest, training_modules!inner(is_published)')
    .eq('module_slug', slug)
    .eq('is_active', true)
    .eq('training_modules.is_published', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (configError) {
    console.error('[training-module-config] Failed to fetch module config:', configError);
    return new Response(JSON.stringify({ error: 'Internal server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!config) {
    return new Response(JSON.stringify({ error: 'Module not found or not published.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(config.manifest), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=300',
    },
  });
});
