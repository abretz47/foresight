import type {DrillManifest , TrainingSession } from '../lib/trainingConfigService';

/**
 * Given a module and its sessions, determine which scheduled week number
 * the user is currently on (1-based index into scheduledWeeks array),
 * whether a session is due, and how many days remain / overdue.
 */
export function getModuleProgress(module: DrillManifest, sessions: TrainingSession[]) {
  const completed = sessions.filter((s) => s.completedAt);
  const completedWeekNumbers = new Set(completed.map((s) => s.weekNumber));

  // Total possible sessions
  const totalSessions = module.scheduledWeeks.length;
  const completedCount = completedWeekNumbers.size;

  // Find the next due week
  const nextDueWeek = module.scheduledWeeks.find((w) => !completedWeekNumbers.has(w)) ?? null;

  return {
    totalSessions,
    completedCount,
    nextDueWeek,
    isComplete: completedCount >= totalSessions,
    completedWeekNumbers,
  };
}

/**
 * Compute aggregate stats across all completed sessions for a module.
 */
export function getAggregateStats(sessions: TrainingSession[]) {
  const completed = sessions.filter((s) => s.completedAt);
  if (completed.length === 0) return null;

  let totalHoled = 0;
  let totalAttempts = 0;

  for (const session of completed) {
    for (const result of session.drillResults) {
      totalHoled += result.holeScores.reduce((a, b) => a + b, 0);
      totalAttempts += result.totalPotential;
    }
  }

  const avgPercent = totalAttempts > 0 ? Math.round((totalHoled / totalAttempts) * 100) : 0;

  return {
    sessionsCompleted: completed.length,
    totalHoled,
    totalAttempts,
    avgPercent,
  };
}
