/**
 * Feature flags
 *
 * Set the corresponding EXPO_PUBLIC_* variable to "true" in an .env.local
 * file (git-ignored) to enable an experimental feature during development.
 * Production builds that omit the variable will have the feature disabled.
 *
 * Example .env.local:
 *   EXPO_PUBLIC_ENABLE_PITRAC=true
 */

/**
 * PiTrac launch-monitor WebSocket integration.
 * When false the PiTrac card, auto-discovery, and live-shot intake are all
 * hidden; the underlying service code is kept intact so the feature does not
 * go stale while it awaits its first production release.
 */
export const PITRAC_ENABLED =
  process.env.EXPO_PUBLIC_ENABLE_PITRAC === 'true';
