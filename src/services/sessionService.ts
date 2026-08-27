import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { DrillResult, TrainingSession } from '../lib/trainingConfigService';

const LEGACY_STORAGE_KEY = 'foresight_academy_sessions';
const CACHE_PREFIX = '@foresight/training_sessions_cache_';
const PENDING_PREFIX = '@foresight/training_sessions_pending_';

type SessionMutation =
  | { type: 'upsert'; session: TrainingSession }
  | { type: 'delete'; sessionId: string };

interface TrainingSessionRow {
  id: string;
  user_id: string;
  module_id: string;
  started_at: string;
  completed_at: string | null;
  week_number: number;
  drill_results: DrillResult[];
  updated_at: string;
}

function cacheKey(scope: string): string {
  return `${CACHE_PREFIX}${scope}`;
}

function pendingKey(scope: string): string {
  return `${PENDING_PREFIX}${scope}`;
}

function mutationSessionId(mutation: SessionMutation): string {
  return mutation.type === 'upsert' ? mutation.session.id : mutation.sessionId;
}

function toRow(userId: string, session: TrainingSession): TrainingSessionRow {
  return {
    id: session.id,
    user_id: userId,
    module_id: session.moduleId,
    started_at: session.startedAt,
    completed_at: session.completedAt ?? null,
    week_number: session.weekNumber,
    drill_results: session.drillResults,
    updated_at: new Date().toISOString(),
  };
}

function fromRow(row: Partial<TrainingSessionRow>): TrainingSession {
  return {
    id: String(row.id ?? ''),
    moduleId: String(row.module_id ?? ''),
    startedAt: String(row.started_at ?? ''),
    completedAt: row.completed_at ?? undefined,
    weekNumber: Number(row.week_number ?? 0),
    drillResults: Array.isArray(row.drill_results) ? row.drill_results : [],
  };
}

async function getCloudUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id ?? null;
  } catch (e) {
    console.warn('[SessionService] Failed to read Supabase session:', e);
    return null;
  }
}

async function getStorageContext(): Promise<{ scope: string; userId: string | null }> {
  const userId = await getCloudUserId();
  return { scope: userId ?? 'local', userId };
}

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function writeJson(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function loadCachedSessions(scope: string): Promise<TrainingSession[]> {
  const scopedSessions = await readJson<TrainingSession[]>(cacheKey(scope));
  if (Array.isArray(scopedSessions)) {
    return scopedSessions;
  }

  const legacySessions = await readJson<TrainingSession[]>(LEGACY_STORAGE_KEY);
  if (!Array.isArray(legacySessions)) {
    return [];
  }

  try {
    await writeJson(cacheKey(scope), legacySessions);
    await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch (e) {
    console.warn('[SessionService] Failed to migrate legacy session cache:', e);
  }

  return legacySessions;
}

async function saveCachedSessions(scope: string, sessions: TrainingSession[]): Promise<void> {
  await writeJson(cacheKey(scope), sessions);
}

async function loadPendingMutations(scope: string): Promise<SessionMutation[]> {
  const pending = await readJson<SessionMutation[]>(pendingKey(scope));
  return Array.isArray(pending) ? pending : [];
}

async function savePendingMutations(scope: string, mutations: SessionMutation[]): Promise<void> {
  await writeJson(pendingKey(scope), mutations);
}

function sameMutation(left: SessionMutation, right: SessionMutation): boolean {
  if (left.type !== right.type) return false;
  return mutationSessionId(left) === mutationSessionId(right);
}

async function queueMutation(scope: string, mutation: SessionMutation): Promise<void> {
  const existing = await loadPendingMutations(scope);
  const next = existing.filter((item) => mutationSessionId(item) !== mutationSessionId(mutation));
  next.push(mutation);
  await savePendingMutations(scope, next);
}

async function removeQueuedMutation(scope: string, mutation: SessionMutation): Promise<void> {
  const existing = await loadPendingMutations(scope);
  const index = existing.findIndex((item) => sameMutation(item, mutation));
  if (index < 0) return;
  existing.splice(index, 1);
  await savePendingMutations(scope, existing);
}

async function fetchRemoteSessions(userId: string): Promise<TrainingSession[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('training_sessions')
    .select('id, module_id, started_at, completed_at, week_number, drill_results')
    .eq('user_id', userId)
    .order('started_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => fromRow(row as Partial<TrainingSessionRow>));
}

async function flushPendingMutations(scope: string, userId: string): Promise<void> {
  if (!supabase) return;

  const pending = await loadPendingMutations(scope);
  if (pending.length === 0) return;

  for (let index = 0; index < pending.length; index += 1) {
    const mutation = pending[index];
    if (mutation.type === 'upsert') {
      const { error } = await supabase
        .from('training_sessions')
        .upsert(toRow(userId, mutation.session), { onConflict: 'id' });
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('training_sessions')
        .delete()
        .eq('id', mutation.sessionId)
        .eq('user_id', userId);
      if (error) throw error;
    }

    await removeQueuedMutation(scope, mutation);
  }
}

async function syncRemoteSessions(
  scope: string,
  userId: string,
  transform?: (sessions: TrainingSession[]) => TrainingSession[]
): Promise<TrainingSession[]> {
  await flushPendingMutations(scope, userId);
  const remoteSessions = await fetchRemoteSessions(userId);
  const syncedSessions = transform ? transform(remoteSessions) : remoteSessions;
  await saveCachedSessions(scope, syncedSessions);
  return syncedSessions;
}

function upsertSession(sessions: TrainingSession[], session: TrainingSession): TrainingSession[] {
  return [...sessions.filter((item) => item.id !== session.id), session];
}

export async function getAllSessions(): Promise<TrainingSession[]> {
  const { scope, userId } = await getStorageContext();
  const cachedSessions = await loadCachedSessions(scope);

  if (!userId || !supabase) {
    return cachedSessions;
  }

  try {
    return await syncRemoteSessions(scope, userId);
  } catch (e) {
    console.warn('[SessionService] Failed to sync training sessions, using cache:', e);
    return cachedSessions;
  }
}

export async function getSessionsForModule(moduleId: string): Promise<TrainingSession[]> {
  const sessions = await getAllSessions();
  return sessions.filter((session) => session.moduleId === moduleId);
}

export async function saveSession(session: TrainingSession): Promise<void> {
  const { scope, userId } = await getStorageContext();
  const cachedSessions = await loadCachedSessions(scope);
  await saveCachedSessions(scope, upsertSession(cachedSessions, session));

  if (!userId || !supabase) {
    return;
  }

  await queueMutation(scope, { type: 'upsert', session });

  try {
    await syncRemoteSessions(scope, userId, (sessions) => upsertSession(sessions, session));
  } catch (e) {
    console.warn('[SessionService] Failed to save training session to Supabase:', e);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const { scope, userId } = await getStorageContext();
  const cachedSessions = await loadCachedSessions(scope);
  await saveCachedSessions(scope, cachedSessions.filter((session) => session.id !== sessionId));

  if (!userId || !supabase) {
    return;
  }

  await queueMutation(scope, { type: 'delete', sessionId });

  try {
    await syncRemoteSessions(scope, userId, (sessions) =>
      sessions.filter((session) => session.id !== sessionId)
    );
  } catch (e) {
    console.warn('[SessionService] Failed to delete training session from Supabase:', e);
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
