import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SupportedStorage } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Returns true when the Supabase env vars have been provided. */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
}

// Only instantiate when both env vars are present.
// createClient() throws synchronously for an empty/invalid URL, which crashes
// the JS runtime on native builds before any UI can render.
let _supabase: SupabaseClient | null = null;
if (isSupabaseConfigured()) {
  try {
    _supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // AsyncStorage is used so the auth session survives app restarts on mobile devices.
        // The cast is required because the Supabase SDK's Storage type expects synchronous
        // setters while AsyncStorage returns Promises, but the runtime behaviour is compatible.
        storage: AsyncStorage as unknown as SupportedStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  } catch (e) {
    console.warn('[Foresight] Failed to initialize Supabase client:', e);
  }
}

export const supabase: SupabaseClient | null = _supabase;

/** Sign out of the current Supabase session, if any.
 *  Attempts a global sign-out (invalidates the token server-side).
 *  If the Supabase host is unreachable, falls back to a local-only sign-out
 *  so the persisted auth token is always cleared from device storage. */
export async function signOut(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('[Foresight] Global signOut failed, clearing local session:', e);
    try {
      // scope: 'local' clears AsyncStorage without making an API call.
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e2) {
      console.warn(
        '[Foresight] Local signOut also failed – the persisted auth token may still be present in device storage. ' +
        'If the problem persists, clearing the app\'s data or reinstalling will remove it.',
        e2
      );
    }
  }
}
