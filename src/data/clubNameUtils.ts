/**
 * Utilities for normalising golf club names and detecting whether two club
 * names refer to the same club (e.g. "3W", "3 Wood", and "3 w" are all the
 * same, while "3 Wood" and "3 i" are different).
 */

/** Maps full words and common variants to a canonical single-letter abbreviation. */
const WORD_TO_ABBR: Array<[RegExp, string]> = [
  [/\bpitching\s+wedge\b/g, 'pw'],
  [/\bsand\s+wedge\b/g, 'sw'],
  [/\blob\s+wedge\b/g, 'lw'],
  [/\bgap\s+wedge\b/g, 'gw'],
  [/\bapproach\s+wedge\b/g, 'aw'],
  [/\bwoods?\b/g, 'w'],
  [/\birons?\b/g, 'i'],
  [/\bdriver\b/g, 'd'],
  [/\bhybrids?\b/g, 'h'],
  [/\brescue\b/g, 'h'],
  [/\bputter\b/g, 'p'],
];

/**
 * Returns a canonical, lowercase, whitespace-free form of a club name that
 * can be used for similarity comparisons.
 *
 * Examples:
 *   "3 Wood"  → "3w"
 *   "3W"      → "3w"
 *   "3 w"     → "3w"
 *   "3 Iron"  → "3i"
 *   "Driver"  → "d"
 *   "PW"      → "pw"
 */
export function normalizeClubName(name: string): string {
  let s = name.toLowerCase().trim();

  // Expand multi-word patterns first (e.g. "pitching wedge" → "pw")
  for (const [pattern, abbr] of WORD_TO_ABBR) {
    s = s.replace(pattern, abbr);
  }

  // Collapse whitespace between a digit and a letter: "3 w" → "3w"
  s = s.replace(/(\d+)\s+([a-z])/g, '$1$2');
  s = s.replace(/([a-z])\s+(\d+)/g, '$1$2');

  // Strip any remaining spaces
  s = s.replace(/\s+/g, '');

  return s;
}

/**
 * Returns true when two club names normalise to the same canonical form,
 * i.e. they refer to the same club.
 */
export function clubNamesAreSimilar(name1: string, name2: string): boolean {
  return normalizeClubName(name1) === normalizeClubName(name2);
}
