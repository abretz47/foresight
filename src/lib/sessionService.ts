/**
 * Practice session management.
 *
 * A practice session is a lightweight tag applied to all shots recorded after
 * the session is started, regardless of which club is active. Sessions persist
 * locally via AsyncStorage.
 *
 * Storage keys
 * ------------
 *  @foresight/active_session_{user}  – the active session ID (or absent)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

const activeSessionKey = (user: string) => `@foresight/active_session_${user}`;

/** Returns the active session ID for a user, or null if none is active. */
export async function getActiveSessionId(user: string): Promise<string | null> {
  const raw = await AsyncStorage.getItem(activeSessionKey(user));
  return raw ?? null;
}

/**
 * Starts a brand-new practice session and returns its ID.
 * Any previously active session is discarded (not deleted — shots already
 * tagged with the old session ID retain their tag).
 */
export async function startSession(user: string): Promise<string> {
  const id = generateId();
  await AsyncStorage.setItem(activeSessionKey(user), id);
  return id;
}

/**
 * Returns the active session ID if one exists, otherwise starts a new session
 * and returns its ID.  This is the "Start/Continue" semantics from the PRD.
 */
export async function continueOrStartSession(user: string): Promise<string> {
  const existing = await getActiveSessionId(user);
  if (existing) return existing;
  return startSession(user);
}

/** Stops the active session (subsequent shots will have no sessionId). */
export async function stopSession(user: string): Promise<void> {
  await AsyncStorage.removeItem(activeSessionKey(user));
}
