/**
 * Cloud database operations backed by Supabase.
 * All functions assume that supabase.auth.getSession() returns an active session;
 * the user_id is derived directly from the authenticated session.
 */
import { supabase } from '../lib/supabase';
import { ShotProfile, DataPoint } from './db';
import defaultShotProfiles from './defaultShotProfiles';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

async function getAuthUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch (e) {
    console.warn('[Foresight] getAuthUserId error:', e);
    return null;
  }
}

export async function getShotProfile(callback: (data: ShotProfile[]) => void): Promise<void> {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('shot_profiles')
    .select('id, name, distance, target_radius, miss_radius, updated_at');
  if (error) {
    console.error('Supabase getShotProfile error:', error.message);
    return;
  }
  const profiles: ShotProfile[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    distance: row.distance as string,
    targetRadius: row.target_radius as string,
    missRadius: row.miss_radius as string,
    timestamp: row.updated_at as string,
  }));
  profiles.sort((a, b) => (Number(b.distance) || 0) - (Number(a.distance) || 0));
  if (profiles.length > 0) {
    callback(profiles);
  }
}

export async function saveShot(shot: {
  id: string;
  name: string;
  targetDistance: string;
  targetRadius: string;
  missRadius: string;
}): Promise<void> {
  if (!supabase) return;
  const userId = await getAuthUserId();
  if (!userId) return;

  if (shot.id && shot.id !== '') {
    const { error } = await supabase
      .from('shot_profiles')
      .update({
        name: shot.name,
        distance: shot.targetDistance,
        target_radius: shot.targetRadius,
        miss_radius: shot.missRadius,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shot.id);
    if (error) console.error('Supabase saveShot (update) error:', error.message);
  } else {
    const id = generateId();
    const { error } = await supabase.from('shot_profiles').insert({
      id,
      user_id: userId,
      name: shot.name,
      distance: shot.targetDistance,
      target_radius: shot.targetRadius,
      miss_radius: shot.missRadius,
    });
    if (error) console.error('Supabase saveShot (insert) error:', error.message);
  }
}

export async function deleteShot(id: string): Promise<void> {
  if (!supabase || !id) return;
  // data_points rows cascade-delete via the FK constraint.
  const { error } = await supabase.from('shot_profiles').delete().eq('id', id);
  if (error) console.error('Supabase deleteShot error:', error.message);
}

export async function saveDataPoint(data: {
  id: string;
  shotX: number;
  shotY: number;
  relX?: number;
  relY?: number;
  clickedFrom: string;
  screenHeight: number;
  screenWidth: number;
  offTarget: boolean;
}): Promise<void> {
  if (!supabase) return;
  if (!data.id) {
    console.error('error: no shot id!');
    return;
  }
  const userId = await getAuthUserId();
  if (!userId) return;

  const pointId = generateId();
  const { error } = await supabase.from('data_points').insert({
    id: pointId,
    profile_id: data.id,
    user_id: userId,
    shot_x: data.shotX,
    shot_y: data.shotY,
    rel_x: data.relX ?? null,
    rel_y: data.relY ?? null,
    clicked_from: data.clickedFrom,
    screen_height: data.screenHeight,
    screen_width: data.screenWidth,
    off_target: data.offTarget,
  });
  if (error) console.error('Supabase saveDataPoint error:', error.message);
}

export async function getShotData(
  id: string,
  callback: (data: DataPoint[]) => void
): Promise<void> {
  if (!supabase || !id) return;
  const { data, error } = await supabase
    .from('data_points')
    .select('id, shot_x, shot_y, rel_x, rel_y, clicked_from, screen_height, screen_width, off_target, created_at')
    .eq('profile_id', id);
  if (error) {
    console.error('Supabase getShotData error:', error.message);
    return;
  }
  const points: DataPoint[] = (data ?? []).map((row) => ({
    id: row.id as string,
    shotX: row.shot_x as number,
    shotY: row.shot_y as number,
    relX: (row.rel_x as number | null) ?? undefined,
    relY: (row.rel_y as number | null) ?? undefined,
    clickedFrom: row.clicked_from as string,
    screenHeight: row.screen_height as number,
    screenWidth: row.screen_width as number,
    offTarget: row.off_target as boolean,
    timestamp: row.created_at as string,
  }));
  if (points.length > 0) {
    callback(points);
  }
}

export async function deleteShotData(id: string): Promise<void> {
  if (!supabase || !id) return;
  const { error } = await supabase.from('data_points').delete().eq('profile_id', id);
  if (error) console.error('Supabase deleteShotData error:', error.message);
}

export async function hasShotData(id: string): Promise<boolean> {
  if (!supabase || !id) return false;
  const { count, error } = await supabase
    .from('data_points')
    .select('*', { count: 'exact', head: true })
    .eq('profile_id', id);
  if (error) {
    console.error('Supabase hasShotData error:', error.message);
    return false;
  }
  return (count ?? 0) > 0;
}

export async function deleteAllUserProfiles(): Promise<void> {
  if (!supabase) return;
  const userId = await getAuthUserId();
  if (!userId) return;
  // Cascade delete removes associated data_points rows via FK constraint.
  const { error } = await supabase.from('shot_profiles').delete().eq('user_id', userId);
  if (error) console.error('Supabase deleteAllUserProfiles error:', error.message);
}

export async function insertProfile(profile: {
  name: string;
  distance: string;
  targetRadius: string;
  missRadius: string;
}): Promise<string | null> {
  if (!supabase) return null;
  const userId = await getAuthUserId();
  if (!userId) return null;
  const id = generateId();
  const { error } = await supabase.from('shot_profiles').insert({
    id,
    user_id: userId,
    name: profile.name,
    distance: profile.distance,
    target_radius: profile.targetRadius,
    miss_radius: profile.missRadius,
  });
  if (error) {
    console.error('Supabase insertProfile error:', error.message);
    return null;
  }
  return id;
}

export async function getAllProfiles(): Promise<ShotProfile[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('shot_profiles')
    .select('id, name, distance, target_radius, miss_radius, updated_at');
  if (error) {
    console.error('Supabase getAllProfiles error:', error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    distance: row.distance as string,
    targetRadius: row.target_radius as string,
    missRadius: row.miss_radius as string,
    timestamp: row.updated_at as string,
  }));
}

export async function findProfileByName(name: string): Promise<ShotProfile | null> {
  if (!supabase) return null;
  const userId = await getAuthUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('shot_profiles')
    .select('id, name, distance, target_radius, miss_radius, updated_at')
    .eq('user_id', userId)
    .eq('name', name)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return {
    id: row.id as string,
    name: row.name as string,
    distance: row.distance as string,
    targetRadius: row.target_radius as string,
    missRadius: row.miss_radius as string,
    timestamp: row.updated_at as string,
  };
}

export async function insertDataPointForProfile(
  profileId: string,
  point: DataPoint
): Promise<void> {
  if (!supabase || !profileId) return;
  const userId = await getAuthUserId();
  if (!userId) return;
  const pointId = generateId();
  const { error } = await supabase.from('data_points').insert({
    id: pointId,
    profile_id: profileId,
    user_id: userId,
    shot_x: point.shotX,
    shot_y: point.shotY,
    rel_x: point.relX ?? null,
    rel_y: point.relY ?? null,
    clicked_from: point.clickedFrom,
    screen_height: point.screenHeight,
    screen_width: point.screenWidth,
    off_target: point.offTarget ?? false,
  });
  if (error) console.error('Supabase insertDataPointForProfile error:', error.message);
}

export async function initializeDefaultProfiles(): Promise<void> {
  if (!supabase) return;
  const userId = await getAuthUserId();
  if (!userId) return;

  const { count, error } = await supabase
    .from('shot_profiles')
    .select('*', { count: 'exact', head: true });
  if (error) {
    console.error('Supabase initializeDefaultProfiles error:', error.message);
    return;
  }
  if ((count ?? 0) > 0) return;

  for (const shot of defaultShotProfiles) {
    const id = generateId();
    const { error: insertError } = await supabase.from('shot_profiles').insert({
      id,
      user_id: userId,
      name: shot.name,
      distance: shot.distance,
      target_radius: shot.targetRadius,
      miss_radius: shot.missRadius,
    });
    if (insertError) {
      console.error('Supabase initializeDefaultProfiles insert error:', insertError.message);
    }
  }
}
