/**
 * EntitlementService
 *
 * Parses JWT access token claims to read the `entitlements` array injected
 * by the Supabase Custom Access Token Auth Hook, and exposes helpers to
 * check entitlements and refresh the session.
 *
 * The Auth Hook populates `app_metadata.entitlements` (or a top-level
 * `entitlements` claim depending on hook implementation).  We check both
 * locations so the service works with either convention.
 */
import { supabase } from './supabase';

/** Decodes the payload of a JWT without verifying its signature. */
function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return {};

    // Base64url → base64 (+ padding) before decoding.
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);

    const atobFn = (globalThis as unknown as { atob?: (s: string) => string }).atob
      ?? ((s: string) => Buffer.from(s, 'base64').toString('binary'));

    const json = atobFn(padded);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Returns the entitlements array from the current JWT, or [] when unavailable. */
async function getEntitlements(): Promise<string[]> {
  if (!supabase) return [];
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return [];
    const payload = decodeJwtPayload(session.access_token);

    // Auth Hook may inject at top-level or inside app_metadata.
    const topLevel = payload['entitlements'];
    if (Array.isArray(topLevel)) return topLevel as string[];

    const appMeta = payload['app_metadata'];
    if (appMeta && typeof appMeta === 'object') {
      const nested = (appMeta as Record<string, unknown>)['entitlements'];
      if (Array.isArray(nested)) return nested as string[];
    }
  } catch (e) {
    console.warn('[EntitlementService] Failed to read session:', e);
  }
  return [];
}

/**
 * Returns true when the current JWT includes the given entitlement key.
 * @param key  e.g. `'training:putting-gate-drill'`
 */
export async function hasEntitlement(key: string): Promise<boolean> {
  const entitlements = await getEntitlements();
  return entitlements.includes(key);
}

/**
 * Returns true when the user has at least one entitlement of the given type.
 * Training entitlements use the `training:{slug}` key pattern.
 * @param type  e.g. `'training'`
 */
export async function hasAnyEntitlementOfType(type: string): Promise<boolean> {
  const entitlements = await getEntitlements();
  return entitlements.some((k) => k.startsWith(type + ':'));
}

/**
 * Forces a session refresh so that newly granted entitlements are picked up
 * from the server without requiring a manual log-out/log-in.
 */
export async function refreshSession(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.auth.refreshSession();
  } catch (e) {
    console.warn('[EntitlementService] Session refresh failed:', e);
  }
}
