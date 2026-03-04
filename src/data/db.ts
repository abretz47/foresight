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
  offTarget?: boolean;
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

export async function saveDataPoint(user: string, data: { id: string; shotX: number; shotY: number; clickedFrom: string; screenHeight: number; screenWidth: number; offTarget: boolean }): Promise<void> {
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

function escapeCSVField(value: string | number | boolean | undefined): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

export async function exportAllDataAsCSV(user: string): Promise<string> {
  const ids = await getClubsIndex(user);
  const rows: string[] = [
    'type,profile_id,name,distance,targetRadius,missRadius,timestamp,shotX,shotY,clickedFrom,screenHeight,screenWidth,offTarget,data_timestamp',
  ];
  for (const id of ids) {
    const raw = await AsyncStorage.getItem(clubKey(id));
    if (raw) {
      const club: ShotProfile = JSON.parse(raw);
      rows.push(
        [
          'profile',
          escapeCSVField(club.id),
          escapeCSVField(club.name),
          escapeCSVField(club.distance),
          escapeCSVField(club.targetRadius),
          escapeCSVField(club.missRadius),
          escapeCSVField(club.timestamp),
          '', '', '', '', '', '',
        ].join(',')
      );
      const dataRaw = await AsyncStorage.getItem(clubDataKey(id));
      const dataPoints: DataPoint[] = dataRaw ? JSON.parse(dataRaw) : [];
      for (const point of dataPoints) {
        rows.push(
          [
            'data',
            escapeCSVField(id),
            '', '', '', '', '',
            escapeCSVField(point.shotX),
            escapeCSVField(point.shotY),
            escapeCSVField(point.clickedFrom),
            escapeCSVField(point.screenHeight),
            escapeCSVField(point.screenWidth),
            escapeCSVField(point.offTarget ?? false),
            escapeCSVField(point.timestamp),
          ].join(',')
        );
      }
    }
  }
  return rows.join('\n');
}

export async function importFromCSV(user: string, csvContent: string): Promise<void> {
  const lines = csvContent.trim().split('\n').slice(1); // skip header
  const profileMap: Record<string, string> = {};
  for (const line of lines) {
    const cols = parseCSVLine(line);
    if (cols[0] === 'profile') {
      const [, origId, name, distance, targetRadius, missRadius, timestamp] = cols;
      const id = generateId();
      const newClub = { id, name, distance, targetRadius, missRadius, timestamp: timestamp || new Date().toISOString() };
      await AsyncStorage.setItem(clubKey(id), JSON.stringify(newClub));
      const currentIds = await getClubsIndex(user);
      await setClubsIndex(user, [...currentIds, id]);
      profileMap[origId] = id;
    }
  }
  const dataByProfile: Record<string, DataPoint[]> = {};
  for (const line of lines) {
    const cols = parseCSVLine(line);
    if (cols[0] === 'data') {
      const origId = cols[1];
      const newId = profileMap[origId];
      if (!newId) continue;
      const shotX = Number(cols[7]);
      const shotY = Number(cols[8]);
      const screenHeight = Number(cols[10]);
      const screenWidth = Number(cols[11]);
      if (isNaN(shotX) || isNaN(shotY) || isNaN(screenHeight) || isNaN(screenWidth)) continue;
      if (!dataByProfile[newId]) dataByProfile[newId] = [];
      dataByProfile[newId].push({
        id: generateId(),
        shotX,
        shotY,
        clickedFrom: cols[9],
        screenHeight,
        screenWidth,
        offTarget: cols[12] === 'true',
        timestamp: cols[13] || new Date().toISOString(),
      });
    }
  }
  for (const [newId, points] of Object.entries(dataByProfile)) {
    await AsyncStorage.setItem(clubDataKey(newId), JSON.stringify(points));
  }
}
