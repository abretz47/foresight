import AsyncStorage from '@react-native-async-storage/async-storage';
import defaultShotProfiles from './defaultShotProfiles';
import { supabase } from '../lib/supabase';
import * as SupabaseDB from './supabaseDb';
import { clubNamesAreSimilar } from './clubNameUtils';

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
  /** Optional practice-session tag set when a session is active at record time. */
  sessionId?: string;
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

/** Fetches all shot profiles for a user as a plain promise (no callback). */
export async function getShotProfileAsync(user: string): Promise<ShotProfile[]> {
  if (isCloudMode()) {
    try {
      return await SupabaseDB.getAllProfiles();
    } catch (e) {
      console.warn('[Foresight] Cloud getShotProfileAsync failed, using local:', e);
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
  return clubs;
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

export async function saveDataPoint(user: string, data: { id: string; shotX: number; shotY: number; relX?: number; relY?: number; clickedFrom: string; screenHeight: number; screenWidth: number; offTarget: boolean; sessionId?: string }): Promise<void> {
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
      sessionId: data.sessionId,
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

/** Fetches all data points for a club as a plain promise (no callback). */
export async function getShotDataAsync(id: string): Promise<DataPoint[]> {
  if (isCloudMode()) {
    try {
      const points: DataPoint[] = [];
      await SupabaseDB.getShotData(id, (data) => points.push(...data));
      return points;
    } catch (e) {
      console.warn('[Foresight] Cloud getShotDataAsync failed, using local:', e);
    }
  }
  if (!id || id === '') return [];
  const raw = await AsyncStorage.getItem(clubDataKey(id));
  return raw ? (JSON.parse(raw) as DataPoint[]) : [];
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

/**
 * Deletes all local AsyncStorage data for `localUser`:
 * each club profile, each club's shot data, and the clubs index.
 */
export async function deleteLocalUserData(localUser: string): Promise<void> {
  const ids = await getClubsIndex(localUser);
  await Promise.all([
    ...ids.map((id) =>
      AsyncStorage.removeItem(clubKey(id)).catch((e) =>
        console.warn(`[Foresight] Failed to remove club ${id}:`, e)
      )
    ),
    ...ids.map((id) =>
      AsyncStorage.removeItem(clubDataKey(id)).catch((e) =>
        console.warn(`[Foresight] Failed to remove shot data for club ${id}:`, e)
      )
    ),
    AsyncStorage.removeItem(`${CLUBS_INDEX_KEY}_${localUser}`).catch((e) =>
      console.warn(`[Foresight] Failed to remove clubs index for ${localUser}:`, e)
    ),
  ]);
}

export interface MigrationOptions {
  /** When true, import shot profiles in addition to shot data. */
  includeProfiles: boolean;
  /** 'add' appends to existing cloud data; 'overwrite' replaces it. */
  mode: 'add' | 'overwrite';
  /**
   * Per-club merge decisions for clubs whose names are similar between the
   * local and cloud accounts.  Only consulted when `includeProfiles: true`
   * and `mode: 'add'`.
   */
  mergeDecisions?: ClubMergeDecision[];
}

export interface MigrationResult {
  profilesImported: number;
  shotsImported: number;
}

/** A pair of local and cloud profiles whose names are deemed similar. */
export interface SimilarClubPair {
  localProfile: ShotProfile;
  cloudProfile: ShotProfile;
}

/** Which profile's parameters to keep when merging a similar pair. */
export type MergeChoice = 'cloud' | 'local' | 'both';

/** User's decision for a single similar-name club conflict. */
export interface ClubMergeDecision {
  localProfileId: string;
  cloudProfileId: string;
  keepWhich: MergeChoice;
}

/**
 * Scans the local user's clubs and the active cloud account for clubs with
 * similar names (e.g. "3W" ≈ "3 Wood").  Returns one pair per match found.
 */
export async function detectSimilarClubs(localUser: string): Promise<SimilarClubPair[]> {
  if (!isCloudMode()) return [];

  const ids = await getClubsIndex(localUser);
  if (ids.length === 0) return [];

  const localProfiles: ShotProfile[] = [];
  for (const id of ids) {
    const raw = await AsyncStorage.getItem(clubKey(id));
    if (raw) localProfiles.push(JSON.parse(raw));
  }

  const cloudProfiles = await SupabaseDB.getAllProfiles();
  const pairs: SimilarClubPair[] = [];

  for (const local of localProfiles) {
    for (const cloud of cloudProfiles) {
      if (clubNamesAreSimilar(local.name, cloud.name)) {
        pairs.push({ localProfile: local, cloudProfile: cloud });
      }
    }
  }

  return pairs;
}

/**
 * Re-normalises a shot's relX/relY from `donorMissRadius` to
 * `targetMissRadius` so that the physical yard distance is preserved, and
 * recomputes the `offTarget` flag accordingly.
 */
function transformShot(
  point: DataPoint,
  donorMissRadius: number,
  targetMissRadius: number
): DataPoint {
  if (!donorMissRadius || !targetMissRadius || donorMissRadius === targetMissRadius) {
    return point;
  }
  const ratio = donorMissRadius / targetMissRadius;
  const newRelX = point.relX !== undefined ? point.relX * ratio : point.relX;
  const newRelY = point.relY !== undefined ? point.relY * ratio : point.relY;
  const offTarget =
    newRelX !== undefined && newRelY !== undefined
      ? Math.sqrt(newRelX * newRelX + newRelY * newRelY) > 1.0
      : point.offTarget;
  return { ...point, relX: newRelX, relY: newRelY, offTarget };
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
 * - `mergeDecisions` (only when `includeProfiles: true` and `mode: 'add'`) →
 *   for each similar-name conflict, specifies whether to keep the cloud
 *   profile, the local profile, or create both.  Shot coordinates are
 *   re-normalised when the two profiles have different missRadius values.
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

  // Pre-load cloud profile map if we have merge decisions that might need it.
  let cloudProfilesById: Record<string, ShotProfile> = {};
  if (
    options.includeProfiles &&
    options.mode === 'add' &&
    options.mergeDecisions &&
    options.mergeDecisions.length > 0
  ) {
    const allCloud = await SupabaseDB.getAllProfiles();
    cloudProfilesById = Object.fromEntries(allCloud.map((p) => [p.id, p]));
  }

  for (const profile of profiles) {
    // ── Merge-decision path (Shots & Profiles + Add mode only) ──────────────
    const decision =
      options.includeProfiles && options.mode === 'add'
        ? options.mergeDecisions?.find((d) => d.localProfileId === profile.id)
        : undefined;

    if (decision) {
      const cloudProfile = cloudProfilesById[decision.cloudProfileId];
      const localMissR = parseFloat(profile.missRadius) || 0;
      const cloudMissR = parseFloat(cloudProfile?.missRadius ?? '0') || 0;

      if (decision.keepWhich === 'cloud') {
        // Keep cloud profile parameters; merge local shots in (transform if
        // radii differ so physical yard distances are preserved).
        const raw = await AsyncStorage.getItem(clubDataKey(profile.id));
        const localPoints: DataPoint[] = raw ? JSON.parse(raw) : [];
        const transformed = localPoints.map((p) =>
          transformShot(p, localMissR, cloudMissR)
        );
        await Promise.all(
          transformed.map((p) =>
            SupabaseDB.insertDataPointForProfile(decision.cloudProfileId, p)
          )
        );
        shotsImported += transformed.length;

      } else if (decision.keepWhich === 'local') {
        // Keep local profile parameters; transform existing cloud shots so
        // their yard distances are preserved, then add the local shots.
        let existingCloudShots: DataPoint[] = [];
        await SupabaseDB.getShotData(decision.cloudProfileId, (data) => {
          existingCloudShots = data;
        });

        // Update cloud profile to local parameters.
        await SupabaseDB.saveShot({
          id: decision.cloudProfileId,
          name: profile.name,
          targetDistance: profile.distance,
          targetRadius: profile.targetRadius,
          missRadius: profile.missRadius,
        });

        // Replace existing cloud shots with transformed versions.
        await SupabaseDB.deleteShotData(decision.cloudProfileId);
        const transformedCloud = existingCloudShots.map((p) =>
          transformShot(p, cloudMissR, localMissR)
        );
        await Promise.all(
          transformedCloud.map((p) =>
            SupabaseDB.insertDataPointForProfile(decision.cloudProfileId, p)
          )
        );

        // Insert local shots as-is (already normalised to local radii).
        const raw = await AsyncStorage.getItem(clubDataKey(profile.id));
        const localPoints: DataPoint[] = raw ? JSON.parse(raw) : [];
        await Promise.all(
          localPoints.map((p) =>
            SupabaseDB.insertDataPointForProfile(decision.cloudProfileId, p)
          )
        );

        shotsImported += transformedCloud.length + localPoints.length;

      } else {
        // keepWhich === 'both': create a brand-new cloud profile for the
        // local club and import its shots without any transformation.
        const newId = await SupabaseDB.insertProfile({
          name: profile.name,
          distance: profile.distance,
          targetRadius: profile.targetRadius,
          missRadius: profile.missRadius,
        });
        if (newId) {
          profilesImported++;
          const raw = await AsyncStorage.getItem(clubDataKey(profile.id));
          const localPoints: DataPoint[] = raw ? JSON.parse(raw) : [];
          await Promise.all(
            localPoints.map((p) => SupabaseDB.insertDataPointForProfile(newId, p))
          );
          shotsImported += localPoints.length;
        }
      }

      continue;
    }

    // ── Standard path ────────────────────────────────────────────────────────
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
