import { createClient } from '@supabase/supabase-js';
import type { SupportedStorage } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// AsyncStorage is used so the auth session survives app restarts on mobile devices.
// The cast is required because the Supabase SDK's Storage type expects synchronous
// setters while AsyncStorage returns Promises, but the runtime behaviour is compatible.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage as unknown as SupportedStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Returns true when the Supabase env vars have been provided. */
export function isSupabaseConfigured(): boolean {
  return !!(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
}

/** Sign out of the current Supabase session, if any. */
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
