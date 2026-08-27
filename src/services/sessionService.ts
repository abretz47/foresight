import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrainingSession } from '../lib/trainingConfigService';

const STORAGE_KEY = 'foresight_academy_sessions';

async function loadSessions(): Promise<TrainingSession[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TrainingSession[]) : [];
  } catch {
    return [];
  }
}

async function saveSessions(sessions: TrainingSession[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export async function getAllSessions(): Promise<TrainingSession[]> {
  return loadSessions();
}

export async function getSessionsForModule(moduleId: string): Promise<TrainingSession[]> {
  const sessions = await loadSessions();
  return sessions.filter((s) => s.moduleId === moduleId);
}

export async function saveSession(session: TrainingSession): Promise<void> {
  const sessions = (await loadSessions()).filter((s) => s.id !== session.id);
  sessions.push(session);
  await saveSessions(sessions);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = (await loadSessions()).filter((s) => s.id !== sessionId);
  await saveSessions(sessions);
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
