import AsyncStorage from '@react-native-async-storage/async-storage';
import defaultShotProfiles from './defaultShotProfiles';
import { supabase } from '../lib/supabase';
import * as SupabaseDB from './supabaseDb';

const CLUBS_INDEX_KEY = '@foresight/clubs_index';
const clubKey = (id: string) => `@foresight/club_${id}`;
const clubDataKey = (id: string) => `@foresight/club_${id}_shots`;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Session cache ─────────────────────────────────────────────────────────────
// Avoid repeated async getSession() calls by tracking auth state in-memory.
let _cloudMode = false;

if (supabase) {
  // Hydrate from persisted storage on module load, then keep in sync.
  (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      _cloudMode = !!session;
    } catch (e) {
      console.warn('[Foresight] getSession error during init (local mode will be used):', e);
    }
  })();

  supabase.auth.onAuthStateChange((_event, session) => {
    _cloudMode = !!session;
  });
}

/** Returns true when the user has an active Supabase session. */
export function isCloudMode(): boolean {
  return _cloudMode;
}

async function getClubsIndex(user: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(`${CLUBS_INDEX_KEY}_${user}`);
  return raw ? JSON.parse(raw) : [];
}

async function setClubsIndex(user: string, ids: string[]): Promise<void> {
  await AsyncStorage.setItem(`${CLUBS_INDEX_KEY}_${user}`, JSON.stringify(ids));
}

export interface ShotProfile {
  id: string;
  name: string;
  distance: string;
  targetRadius: string;
  missRadius: string;
  timestamp?: string;
}

export interface DataPoint {
  id?: string;
  shotX: number;
  shotY: number;
  /** Horizontal offset from circle center, normalized by missRadiusPx (negative = left). */
  relX?: number;
  /** Vertical offset from circle center, normalized by missRadiusPx (negative = up / longer). */
  relY?: number;
  clickedFrom: string;
  screenHeight: number;
  screenWidth: number;
  offTarget?: boolean;
  timestamp?: string;
}

export async function getShotProfile(user: string, _callback: (data: ShotProfile[]) => void): Promise<void> {
  if (isCloudMode()) {
    try {
      return await SupabaseDB.getShotProfile(_callback);
    } catch (e) {
      console.warn('[Foresight] Cloud getShotProfile failed, using local:', e);
    }
  }
  const ids = await getClubsIndex(user);
  const clubs: ShotProfile[] = [];
  for (const id of ids) {
    const raw = await AsyncStorage.getItem(clubKey(id));
    if (raw) {
      clubs.push(JSON.parse(raw));
    }
  }
  clubs.sort((a, b) => (Number(b.distance) || 0) - (Number(a.distance) || 0));
  if (clubs.length) {
    _callback(clubs);
  }
}

export async function saveShot(user: string, shot: { id: string; name: string; targetDistance: string; targetRadius: string; missRadius: string }): Promise<void> {
  if (isCloudMode()) {
    try {
      return await SupabaseDB.saveShot(shot);
    } catch (e) {
      console.warn('[Foresight] Cloud saveShot failed, using local:', e);
    }
  }
  if (shot.id && shot.id !== '') {
    const raw = await AsyncStorage.getItem(clubKey(shot.id));
    const existing = raw ? JSON.parse(raw) : {};
    const updated = {
      ...existing,
      id: shot.id,
      name: shot.name,
      distance: shot.targetDistance,
      targetRadius: shot.targetRadius,
      missRadius: shot.missRadius,
      timestamp: new Date().toISOString(),
    };
    await AsyncStorage.setItem(clubKey(shot.id), JSON.stringify(updated));
  } else {
    const id = generateId();
    const newClub = {
      id,
      name: shot.name,
      distance: shot.targetDistance,
      targetRadius: shot.targetRadius,
      missRadius: shot.missRadius,
      timestamp: new Date().toISOString(),
    };
    await AsyncStorage.setItem(clubKey(id), JSON.stringify(newClub));
    const ids = await getClubsIndex(user);
    await setClubsIndex(user, [...ids, id]);
  }
}

export async function deleteShot(user: string, id: string): Promise<void> {
  if (isCloudMode()) {
    try {
      return await SupabaseDB.deleteShot(id);
    } catch (e) {
      console.warn('[Foresight] Cloud deleteShot failed, using local:', e);
    }
  }
  if (id && id !== '') {
    await AsyncStorage.removeItem(clubKey(id));
    await AsyncStorage.removeItem(clubDataKey(id));
    const ids = await getClubsIndex(user);
    await setClubsIndex(user, ids.filter((i) => i !== id));
  }
}

export async function saveDataPoint(user: string, data: { id: string; shotX: number; shotY: number; relX?: number; relY?: number; clickedFrom: string; screenHeight: number; screenWidth: number; offTarget: boolean }): Promise<void> {
  if (isCloudMode()) {
    try {
      return await SupabaseDB.saveDataPoint(data);
    } catch (e) {
      console.warn('[Foresight] Cloud saveDataPoint failed, using local:', e);
    }
  }
  if (data.id && data.id !== '') {
    const raw = await AsyncStorage.getItem(clubDataKey(data.id));
    const shots: DataPoint[] = raw ? JSON.parse(raw) : [];
    const point: DataPoint = {
      id: generateId(),
      shotX: data.shotX,
      shotY: data.shotY,
      relX: data.relX,
      relY: data.relY,
      clickedFrom: data.clickedFrom,
      screenHeight: data.screenHeight,
      screenWidth: data.screenWidth,
      offTarget: data.offTarget,
      timestamp: new Date().toISOString(),
    };
    shots.push(point);
    await AsyncStorage.setItem(clubDataKey(data.id), JSON.stringify(shots));
  } else {
    console.error('error: no shot id!');
  }
}

export async function getUsers(): Promise<string[]> {
  const allKeys = await AsyncStorage.getAllKeys();
  const prefix = `${CLUBS_INDEX_KEY}_`;
  const users = allKeys
    .filter((key) => key.startsWith(prefix))
    .map((key) => key.slice(prefix.length));

  const withTimestamps = await Promise.all(
    users.map(async (user) => {
      const ids = await getClubsIndex(user);
      let maxTimestamp = '';
      if (ids.length > 0) {
        const pairs = await AsyncStorage.multiGet(ids.map(clubKey));
        for (const [, raw] of pairs) {
          if (raw) {
            const club = JSON.parse(raw);
            if (club.timestamp && club.timestamp > maxTimestamp) {
              maxTimestamp = club.timestamp;
            }
          }
        }
      }
      return { user, timestamp: maxTimestamp };
    })
  );

  withTimestamps.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return withTimestamps.map((u) => u.user);
}

export async function getShotData(user: string, id: string, _callback: (data: DataPoint[]) => void): Promise<void> {
  if (isCloudMode()) {
    try {
      return await SupabaseDB.getShotData(id, _callback);
    } catch (e) {
      console.warn('[Foresight] Cloud getShotData failed, using local:', e);
    }
  }
  if (id && id !== '') {
    const raw = await AsyncStorage.getItem(clubDataKey(id));
    const data: DataPoint[] = raw ? JSON.parse(raw) : [];
    if (data.length) {
      _callback(data);
    }
  }
}

export async function deleteShotData(id: string): Promise<void> {
  if (isCloudMode()) {
    try {
      return await SupabaseDB.deleteShotData(id);
    } catch (e) {
      console.warn('[Foresight] Cloud deleteShotData failed, using local:', e);
    }
  }
  if (id && id !== '') {
    await AsyncStorage.removeItem(clubDataKey(id));
  }
}

export async function hasShotData(id: string): Promise<boolean> {
  if (isCloudMode()) {
    try {
      return await SupabaseDB.hasShotData(id);
    } catch (e) {
      console.warn('[Foresight] Cloud hasShotData failed, using local:', e);
    }
  }
  if (!id || id === '') return false;
  const raw = await AsyncStorage.getItem(clubDataKey(id));
  if (!raw) return false;
  const data: DataPoint[] = JSON.parse(raw);
  return data.length > 0;
}

export async function initializeDefaultProfiles(user: string): Promise<void> {
  if (isCloudMode()) {
    try {
      return await SupabaseDB.initializeDefaultProfiles();
    } catch (e) {
      console.warn('[Foresight] Cloud initializeDefaultProfiles failed, using local:', e);
    }
  }
  const ids = await getClubsIndex(user);
  if (ids.length > 0) return;
  for (const shot of defaultShotProfiles) {
    const id = generateId();
    const newClub = {
      id,
      name: shot.name,
      distance: shot.distance,
      targetRadius: shot.targetRadius,
      missRadius: shot.missRadius,
      timestamp: new Date().toISOString(),
    };
    await AsyncStorage.setItem(clubKey(id), JSON.stringify(newClub));
    const currentIds = await getClubsIndex(user);
    await setClubsIndex(user, [...currentIds, id]);
  }
}

export interface MigrationOptions {
  /** When true, import shot profiles in addition to shot data. */
  includeProfiles: boolean;
  /** 'add' appends to existing cloud data; 'overwrite' replaces it. */
  mode: 'add' | 'overwrite';
}

export interface MigrationResult {
  profilesImported: number;
  shotsImported: number;
}

/**
 * Migrates local AsyncStorage data for `localUser` into the currently
 * authenticated Supabase account.
 *
 * - `includeProfiles: true`  → creates new cloud profiles from local ones.
 * - `includeProfiles: false` → matches local profiles to existing cloud
 *   profiles by name and imports shot data only.
 * - `mode: 'overwrite'` with profiles → deletes all existing cloud profiles
 *   (cascades shot data) before importing.
 * - `mode: 'overwrite'` without profiles → clears shot data from each
 *   matched cloud profile before importing.
 */
export async function migrateLocalToCloud(
  localUser: string,
  options: MigrationOptions
): Promise<MigrationResult> {
  if (!isCloudMode()) throw new Error('Not in cloud mode');

  const ids = await getClubsIndex(localUser);
  if (ids.length === 0) return { profilesImported: 0, shotsImported: 0 };

  const profiles: ShotProfile[] = [];
  for (const id of ids) {
    const raw = await AsyncStorage.getItem(clubKey(id));
    if (raw) profiles.push(JSON.parse(raw));
  }

  let profilesImported = 0;
  let shotsImported = 0;

  if (options.mode === 'overwrite' && options.includeProfiles) {
    await SupabaseDB.deleteAllUserProfiles();
  }

  for (const profile of profiles) {
    let cloudProfileId: string | null = null;

    if (options.includeProfiles) {
      cloudProfileId = await SupabaseDB.insertProfile({
        name: profile.name,
        distance: profile.distance,
        targetRadius: profile.targetRadius,
        missRadius: profile.missRadius,
      });
      if (cloudProfileId) profilesImported++;
    } else {
      const existing = await SupabaseDB.findProfileByName(profile.name);
      cloudProfileId = existing?.id ?? null;
      if (cloudProfileId && options.mode === 'overwrite') {
        await SupabaseDB.deleteShotData(cloudProfileId);
      }
    }

    if (!cloudProfileId) continue;

    const raw = await AsyncStorage.getItem(clubDataKey(profile.id));
    const points: DataPoint[] = raw ? JSON.parse(raw) : [];
    await Promise.all(
      points.map((point) => SupabaseDB.insertDataPointForProfile(cloudProfileId as string, point))
    );
    shotsImported += points.length;
  }

  return { profilesImported, shotsImported };
}
