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

/** Sign out of the current Supabase session, if any. */
export async function signOut(): Promise<void> {
  try {
    await supabase?.auth.signOut();
  } catch (e) {
    console.warn('[Foresight] signOut error (ignored):', e);
  }
}
