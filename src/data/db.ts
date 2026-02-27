import AsyncStorage from '@react-native-async-storage/async-storage';
import defaultShotProfiles from './defaultShotProfiles';

const CLUBS_INDEX_KEY = '@foresight/clubs_index';
const clubKey = (id: string) => `@foresight/club_${id}`;
const clubDataKey = (id: string) => `@foresight/club_${id}_shots`;

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
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
  clickedFrom: string;
  screenHeight: number;
  screenWidth: number;
  timestamp?: string;
}

export async function getShotProfile(user: string, _callback: (data: ShotProfile[]) => void): Promise<void> {
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
  if (id && id !== '') {
    await AsyncStorage.removeItem(clubKey(id));
    await AsyncStorage.removeItem(clubDataKey(id));
    const ids = await getClubsIndex(user);
    await setClubsIndex(user, ids.filter((i) => i !== id));
  }
}

export async function saveDataPoint(user: string, data: { id: string; shotX: number; shotY: number; clickedFrom: string; screenHeight: number; screenWidth: number }): Promise<void> {
  if (data.id && data.id !== '') {
    const raw = await AsyncStorage.getItem(clubDataKey(data.id));
    const shots: DataPoint[] = raw ? JSON.parse(raw) : [];
    const point: DataPoint = {
      id: generateId(),
      shotX: data.shotX,
      shotY: data.shotY,
      clickedFrom: data.clickedFrom,
      screenHeight: data.screenHeight,
      screenWidth: data.screenWidth,
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
  if (id && id !== '') {
    const raw = await AsyncStorage.getItem(clubDataKey(id));
    const data: DataPoint[] = raw ? JSON.parse(raw) : [];
    if (data.length) {
      _callback(data);
    }
  }
}

export async function deleteShotData(id: string): Promise<void> {
  if (id && id !== '') {
    await AsyncStorage.removeItem(clubDataKey(id));
  }
}

export async function hasShotData(id: string): Promise<boolean> {
  if (!id || id === '') return false;
  const raw = await AsyncStorage.getItem(clubDataKey(id));
  if (!raw) return false;
  const data: DataPoint[] = JSON.parse(raw);
  return data.length > 0;
}

export async function initializeDefaultProfiles(user: string): Promise<void> {
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
