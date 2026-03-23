export interface DefaultShotProfile {
  name: string;
  distance: string;
  targetRadius: string;
  missRadius: string;
}

// ── Scratch (handicap 0–9) — imperial (yards) ─────────────────────────────
// Mirrors default-shot-profile-scratch.yaml
const scratchProfiles: DefaultShotProfile[] = [
  { name: 'Driver',  distance: '280', targetRadius: '10', missRadius: '30' },
  { name: '3 Wood',  distance: '255', targetRadius: '9',  missRadius: '25' },
  { name: '5 Wood',  distance: '235', targetRadius: '9',  missRadius: '22' },
  { name: '3 Iron',  distance: '220', targetRadius: '8',  missRadius: '20' },
  { name: '4 Iron',  distance: '210', targetRadius: '8',  missRadius: '18' },
  { name: '5 Iron',  distance: '200', targetRadius: '7',  missRadius: '16' },
  { name: '6 Iron',  distance: '185', targetRadius: '7',  missRadius: '15' },
  { name: '7 Iron',  distance: '172', targetRadius: '6',  missRadius: '14' },
  { name: '8 Iron',  distance: '158', targetRadius: '6',  missRadius: '13' },
  { name: '9 Iron',  distance: '145', targetRadius: '5',  missRadius: '12' },
  { name: 'PW',      distance: '130', targetRadius: '5',  missRadius: '10' },
  { name: 'SW',      distance: '95',  targetRadius: '4',  missRadius: '8'  },
];

// ── Scratch (handicap 0–9) — metric (metres) ──────────────────────────────
const scratchProfilesMetric: DefaultShotProfile[] = [
  { name: 'Driver',  distance: '256', targetRadius: '9',  missRadius: '27' },
  { name: '3 Wood',  distance: '233', targetRadius: '8',  missRadius: '23' },
  { name: '5 Wood',  distance: '215', targetRadius: '8',  missRadius: '20' },
  { name: '3 Iron',  distance: '201', targetRadius: '7',  missRadius: '18' },
  { name: '4 Iron',  distance: '192', targetRadius: '7',  missRadius: '17' },
  { name: '5 Iron',  distance: '183', targetRadius: '6',  missRadius: '15' },
  { name: '6 Iron',  distance: '169', targetRadius: '6',  missRadius: '14' },
  { name: '7 Iron',  distance: '157', targetRadius: '6',  missRadius: '13' },
  { name: '8 Iron',  distance: '145', targetRadius: '6',  missRadius: '12' },
  { name: '9 Iron',  distance: '133', targetRadius: '5',  missRadius: '11' },
  { name: 'PW',      distance: '119', targetRadius: '5',  missRadius: '9'  },
  { name: 'SW',      distance: '87',  targetRadius: '4',  missRadius: '7'  },
];

// ── Low handicap (handicap 10–18) — imperial (yards) ─────────────────────
// Mirrors default-shot-profile-low.yaml
const lowHandicapProfiles: DefaultShotProfile[] = [
  { name: 'Driver',  distance: '250', targetRadius: '13', missRadius: '42' },
  { name: '3 Wood',  distance: '225', targetRadius: '12', missRadius: '36' },
  { name: '5 Wood',  distance: '210', targetRadius: '11', missRadius: '32' },
  { name: '3 Iron',  distance: '200', targetRadius: '10', missRadius: '30' },
  { name: '4 Iron',  distance: '190', targetRadius: '10', missRadius: '28' },
  { name: '5 Iron',  distance: '180', targetRadius: '9',  missRadius: '25' },
  { name: '6 Iron',  distance: '168', targetRadius: '8',  missRadius: '22' },
  { name: '7 Iron',  distance: '156', targetRadius: '8',  missRadius: '20' },
  { name: '8 Iron',  distance: '143', targetRadius: '7',  missRadius: '18' },
  { name: '9 Iron',  distance: '130', targetRadius: '6',  missRadius: '16' },
  { name: 'PW',      distance: '115', targetRadius: '5',  missRadius: '14' },
  { name: 'SW',      distance: '85',  targetRadius: '4',  missRadius: '12' },
];

// ── Low handicap (handicap 10–18) — metric (metres) ──────────────────────
const lowHandicapProfilesMetric: DefaultShotProfile[] = [
  { name: 'Driver',  distance: '229', targetRadius: '12', missRadius: '38' },
  { name: '3 Wood',  distance: '206', targetRadius: '11', missRadius: '33' },
  { name: '5 Wood',  distance: '192', targetRadius: '10', missRadius: '29' },
  { name: '3 Iron',  distance: '183', targetRadius: '9',  missRadius: '27' },
  { name: '4 Iron',  distance: '174', targetRadius: '9',  missRadius: '26' },
  { name: '5 Iron',  distance: '165', targetRadius: '8',  missRadius: '23' },
  { name: '6 Iron',  distance: '154', targetRadius: '7',  missRadius: '20' },
  { name: '7 Iron',  distance: '143', targetRadius: '7',  missRadius: '18' },
  { name: '8 Iron',  distance: '131', targetRadius: '6',  missRadius: '17' },
  { name: '9 Iron',  distance: '119', targetRadius: '6',  missRadius: '15' },
  { name: 'PW',      distance: '105', targetRadius: '5',  missRadius: '13' },
  { name: 'SW',      distance: '78',  targetRadius: '4',  missRadius: '11' },
];

// ── Standard / mid handicap (handicap 19–28) — imperial (yards) ───────────
// Mirrors default-shot-profile-mid.yaml (also used as the generic default)
const midHandicapProfiles: DefaultShotProfile[] = [
  { name: 'Driver',  distance: '220', targetRadius: '16', missRadius: '55' },
  { name: '3 Wood',  distance: '200', targetRadius: '14', missRadius: '46' },
  { name: '5 Wood',  distance: '185', targetRadius: '13', missRadius: '40' },
  { name: '3 Iron',  distance: '175', targetRadius: '12', missRadius: '36' },
  { name: '4 Iron',  distance: '168', targetRadius: '11', missRadius: '33' },
  { name: '5 Iron',  distance: '160', targetRadius: '10', missRadius: '30' },
  { name: '6 Iron',  distance: '150', targetRadius: '9',  missRadius: '27' },
  { name: '7 Iron',  distance: '138', targetRadius: '9',  missRadius: '26' },
  { name: '8 Iron',  distance: '125', targetRadius: '8',  missRadius: '24' },
  { name: '9 Iron',  distance: '113', targetRadius: '7',  missRadius: '22' },
  { name: 'PW',      distance: '100', targetRadius: '6',  missRadius: '18' },
  { name: 'SW',      distance: '72',  targetRadius: '5',  missRadius: '16' },
];

// ── Standard / mid handicap (handicap 19–28) — metric (metres) ────────────
const midHandicapProfilesMetric: DefaultShotProfile[] = [
  { name: 'Driver',  distance: '201', targetRadius: '15', missRadius: '50' },
  { name: '3 Wood',  distance: '183', targetRadius: '13', missRadius: '42' },
  { name: '5 Wood',  distance: '169', targetRadius: '12', missRadius: '37' },
  { name: '3 Iron',  distance: '160', targetRadius: '11', missRadius: '33' },
  { name: '4 Iron',  distance: '154', targetRadius: '10', missRadius: '30' },
  { name: '5 Iron',  distance: '146', targetRadius: '9',  missRadius: '27' },
  { name: '6 Iron',  distance: '137', targetRadius: '8',  missRadius: '25' },
  { name: '7 Iron',  distance: '126', targetRadius: '8',  missRadius: '24' },
  { name: '8 Iron',  distance: '114', targetRadius: '7',  missRadius: '22' },
  { name: '9 Iron',  distance: '103', targetRadius: '6',  missRadius: '20' },
  { name: 'PW',      distance: '91',  targetRadius: '6',  missRadius: '17' },
  { name: 'SW',      distance: '66',  targetRadius: '5',  missRadius: '15' },
];

// ── High handicap (handicap 29+) — imperial (yards) ──────────────────────
// Mirrors default-shot-profile-high.yaml
const highHandicapProfiles: DefaultShotProfile[] = [
  { name: 'Driver',  distance: '185', targetRadius: '20', missRadius: '70' },
  { name: '3 Wood',  distance: '168', targetRadius: '18', missRadius: '60' },
  { name: '5 Wood',  distance: '155', targetRadius: '16', missRadius: '52' },
  { name: '5 Iron',  distance: '140', targetRadius: '14', missRadius: '42' },
  { name: '6 Iron',  distance: '130', targetRadius: '13', missRadius: '38' },
  { name: '7 Iron',  distance: '120', targetRadius: '12', missRadius: '35' },
  { name: '8 Iron',  distance: '108', targetRadius: '11', missRadius: '32' },
  { name: '9 Iron',  distance: '96',  targetRadius: '10', missRadius: '28' },
  { name: 'PW',      distance: '85',  targetRadius: '8',  missRadius: '24' },
  { name: 'SW',      distance: '60',  targetRadius: '7',  missRadius: '20' },
];

// ── High handicap (handicap 29+) — metric (metres) ───────────────────────
const highHandicapProfilesMetric: DefaultShotProfile[] = [
  { name: 'Driver',  distance: '169', targetRadius: '18', missRadius: '64' },
  { name: '3 Wood',  distance: '154', targetRadius: '17', missRadius: '55' },
  { name: '5 Wood',  distance: '142', targetRadius: '15', missRadius: '48' },
  { name: '5 Iron',  distance: '128', targetRadius: '13', missRadius: '38' },
  { name: '6 Iron',  distance: '119', targetRadius: '12', missRadius: '35' },
  { name: '7 Iron',  distance: '110', targetRadius: '11', missRadius: '32' },
  { name: '8 Iron',  distance: '99',  targetRadius: '10', missRadius: '29' },
  { name: '9 Iron',  distance: '88',  targetRadius: '9',  missRadius: '26' },
  { name: 'PW',      distance: '78',  targetRadius: '7',  missRadius: '22' },
  { name: 'SW',      distance: '55',  targetRadius: '6',  missRadius: '18' },
];

/**
 * Returns the appropriate default shot profile collection based on
 * the player's handicap (and optionally age). If neither handicap
 * nor age is provided the mid-handicap set is used as a safe default.
 *
 * Handicap bands (mirrors the YAML files in the project root):
 *   0–9   → scratch
 *   10–18 → low
 *   19–28 → mid
 *   29+   → high
 *
 * Pass units='metric' to receive distances/radii in metres instead of yards.
 */
export function getDefaultProfilesForPlayer(
  handicap?: number | null,
  _age?: number | null,
  units?: 'imperial' | 'metric' | null,
): DefaultShotProfile[] {
  const metric = units === 'metric';
  if (handicap == null) return metric ? midHandicapProfilesMetric : midHandicapProfiles;
  if (handicap <= 9)  return metric ? scratchProfilesMetric    : scratchProfiles;
  if (handicap <= 18) return metric ? lowHandicapProfilesMetric : lowHandicapProfiles;
  if (handicap <= 28) return metric ? midHandicapProfilesMetric : midHandicapProfiles;
  return metric ? highHandicapProfilesMetric : highHandicapProfiles;
}

// Generic default exported for backwards-compatibility (mid-handicap set).
const defaultShotProfiles: DefaultShotProfile[] = midHandicapProfiles;

export default defaultShotProfiles;
