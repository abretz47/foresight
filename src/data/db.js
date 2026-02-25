import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const CLUBS_INDEX_KEY = '@foresight/clubs_index';
const clubKey = (id) => `@foresight/club_${id}`;
const clubDataKey = (id) => `@foresight/club_${id}_shots`;

// Generate a simple unique id
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Read the clubs index (array of ids) for a user
async function getClubsIndex(user) {
  const raw = await AsyncStorage.getItem(`${CLUBS_INDEX_KEY}_${user}`);
  return raw ? JSON.parse(raw) : [];
}

// Write the clubs index for a user
async function setClubsIndex(user, ids) {
  await AsyncStorage.setItem(`${CLUBS_INDEX_KEY}_${user}`, JSON.stringify(ids));
}

export async function getShotProfile(user, _callback) {
  const ids = await getClubsIndex(user);
  const clubs = [];
  for (const id of ids) {
    const raw = await AsyncStorage.getItem(clubKey(id));
    if (raw) {
      clubs.push(JSON.parse(raw));
    }
  }
  // Sort descending by distance (mirrors previous Firestore orderBy)
  clubs.sort((a, b) => (Number(b.distance) || 0) - (Number(a.distance) || 0));
  if (clubs.length) {
    _callback(clubs);
  }
}

export async function saveShot(user, shot) {
  if (shot.id && shot.id !== '') {
    // Update existing club
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
    console.log('Successfully updated shot type for:', shot.id);
  } else {
    // Add new club
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
    console.log('Successfully added shot type:', id);
  }
}

export async function deleteShot(user, id) {
  if (id && id !== '') {
    await AsyncStorage.removeItem(clubKey(id));
    await AsyncStorage.removeItem(clubDataKey(id));
    const ids = await getClubsIndex(user);
    await setClubsIndex(user, ids.filter((i) => i !== id));
    console.log('Successfully deleted doc id:', id);
  }
}

export async function saveDataPoint(user, data) {
  if (data.id && data.id !== '') {
    const raw = await AsyncStorage.getItem(clubDataKey(data.id));
    const shots = raw ? JSON.parse(raw) : [];
    const point = {
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
    console.log('Successfully added data:', point.id);
  } else {
    console.error('error: no shot id!');
  }
}

export async function getShotData(user, id, _callback) {
  if (id && id !== '') {
    const raw = await AsyncStorage.getItem(clubDataKey(id));
    const data = raw ? JSON.parse(raw) : [];
    if (data.length) {
      _callback(data);
    }
  }
}

