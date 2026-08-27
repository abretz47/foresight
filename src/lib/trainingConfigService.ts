/**
 * TrainingConfigService
 *
 * Fetches the entitlement-gated drill manifest for a module slug from the
 * `training-module-config` Supabase Edge Function and caches it locally
 * in AsyncStorage, keyed by `slug + version`.
 *
 * Cache is invalidated whenever the server returns a higher version number.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

export interface DrillStep {
  id: string;
  instruction: string;
  completionCriteria: 'manual' | string;
  name: string;
  drills?: Drill[];
  description?: string;
  [key: string]: unknown;
}
export interface Drill {
  name: string;
  description?: string;
  holes: number;
  puttsPerHole: number;
  targetRadius?: string;
}

export interface DrillManifest {
  id: string;
  name: string;
  description: string;
  icon: string;
  scheduledWeeks: number[]; // e.g. [1, 4, 8, 12]
  practiceNotes?: string[];
  title: string;
  version: number;
  estimatedDurationMinutes: number;
  steps: DrillStep[];
  parameters: Record<string, unknown>;
  assets: Record<string, string>;
  [key: string]: unknown;
}


export interface TrainingSession {
  id: string;
  moduleId: string;
  startedAt: string; // ISO string
  completedAt?: string; // ISO string
  weekNumber: number; // which scheduled week (1, 4, 8, 12…)
  drillResults: DrillResult[];
}

export interface DrillResult {
  sectionName: string;
  drillName: string;
  holeScores: number[]; // putts holed per hole attempt
  totalPotential: number; // total putts attempted
}

const CACHE_PREFIX = '@foresight/training_manifest_';

function cacheKey(slug: string, version: number): string {
  return `${CACHE_PREFIX}${slug}_v${version}`;
}

async function readCached(slug: string): Promise<DrillManifest | null> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const matchingKeys = keys.filter((k) => k.startsWith(`${CACHE_PREFIX}${slug}_v`));
    if (matchingKeys.length === 0) return null;

    const latestKey = matchingKeys.reduce((best, k) => {
      const v = Number(k.split('_v').pop());
      const bestV = Number(best.split('_v').pop());
      return v > bestV ? k : best;
    }, matchingKeys[0]);

    const raw = await AsyncStorage.getItem(latestKey);
    if (!raw) return null;
    return JSON.parse(raw) as DrillManifest;
  } catch {
    return null;
  }
}

async function writeCache(slug: string, manifest: DrillManifest): Promise<void> {
  try {
    await AsyncStorage.setItem(cacheKey(slug, manifest.version), JSON.stringify(manifest));
  } catch (e) {
    console.warn('[TrainingConfigService] Cache write failed:', e);
  }
}

/**
 * Fetches the drill manifest for `slug` from the Edge Function.
 * Returns a cached version when the network is unavailable and a prior fetch
 * was stored.  Throws when neither network nor cache is available.
 *
 * @param slug  The module slug (e.g. `'test-drill'`)
 */
export async function fetchManifest(slug: string): Promise<DrillManifest> {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  // Retrieve the current session for the Authorization header.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('No active session. Please sign in.');
  }

  const supabaseUrl = (supabase as unknown as { supabaseUrl?: string }).supabaseUrl
    ?? process.env.EXPO_PUBLIC_SUPABASE_URL
    ?? '';
  const edgeFunctionUrl = `${supabaseUrl}/functions/v1/training-module-config/${slug}/config`;

  try {
    const authHeader = 'Bearer ' + session.access_token;
    const response = await fetch(edgeFunctionUrl, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 403) {
      throw new Error('You do not have access to this module.');
    }
    if (response.status === 404) {
      throw new Error('Module not found or not published.');
    }
    if (!response.ok) {
      throw new Error(`Unexpected response: ${response.status}`);
    }

    const manifest = (await response.json()) as DrillManifest;
    await writeCache(slug, manifest);
    return manifest;
  } catch (networkError) {
    // Fall back to any previously cached version for this slug.
    const cached = await readCached(slug);
    if (cached) return cached;
    throw networkError;
  }
}
