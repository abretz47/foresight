/**
 * Shot dispersion utilities
 *
 * Implements the dispersion polygon logic described in the PRD:
 *  1. Filter to in-play shots (offTarget === false).
 *  2. Select the closest ceil(0.8 × n) points to the centre using
 *     normalised (relX, relY) coordinates.
 *  3. Compute the convex hull of the selected points.
 *  4. Return hull vertices as { x, y } pairs in normalised space.
 */

import { DataPoint } from '../data/db';

export interface Point {
  x: number;
  y: number;
}

// ── 80 % selection ──────────────────────────────────────────────────────────

/**
 * Selects the ceil(0.8 × n) points closest to the origin in relX/relY space.
 * Points without relX/relY are skipped.
 */
export function selectClosest80Percent(points: Point[]): Point[] {
  if (points.length === 0) return [];

  const withDist = points.map((p) => ({ p, d: p.x * p.x + p.y * p.y }));
  withDist.sort((a, b) => a.d - b.d);

  const count = Math.ceil(0.8 * points.length);
  return withDist.slice(0, count).map((entry) => entry.p);
}

// ── Convex hull (Graham scan) ───────────────────────────────────────────────

function cross(O: Point, A: Point, B: Point): number {
  return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
}

/**
 * Computes the convex hull of a set of points using the Graham scan algorithm.
 * Returns the hull vertices in counter-clockwise order.
 * Handles degenerate cases: 0, 1, 2, or collinear points.
 */
export function convexHull(points: Point[]): Point[] {
  const n = points.length;
  if (n < 3) return [...points];

  // Sort lexicographically by (x, y)
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);

  const lower: Point[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  // Remove the last point of each half because it is repeated
  lower.pop();
  upper.pop();

  return [...lower, ...upper];
}

// ── Main entry point ────────────────────────────────────────────────────────

/**
 * Computes the dispersion hull for a collection of DataPoints.
 *
 * Steps:
 *  1. Keep only in-play shots (offTarget === false) that have relX and relY.
 *  2. Select the closest 80 % to centre.
 *  3. Compute convex hull.
 *
 * Returns hull vertices in normalised (relX / relY) coordinates, or an empty
 * array when there are insufficient data points.
 */
export function computeDispersionHull(dataPoints: DataPoint[]): Point[] {
  const inPlay = dataPoints.filter(
    (d) => d.offTarget === false && typeof d.relX === 'number' && typeof d.relY === 'number'
  );

  if (inPlay.length === 0) return [];

  const pts: Point[] = inPlay.map((d) => ({ x: d.relX as number, y: d.relY as number }));

  const closest = selectClosest80Percent(pts);

  if (closest.length < 2) {
    // 0 or 1 points cannot form a hull; return them as-is so the
    // DispersionPolygon component can render a dot (1 point) or nothing (0).
    return closest;
  }

  return convexHull(closest);
}

/**
 * Filters data points by an optional date range.
 * Points without a timestamp are excluded when a range is provided.
 */
export function filterByDateRange(
  dataPoints: DataPoint[],
  startDate: Date | null,
  endDate: Date | null
): DataPoint[] {
  if (!startDate && !endDate) return dataPoints;
  return dataPoints.filter((d) => {
    if (!d.timestamp) return false;
    const t = new Date(d.timestamp).getTime();
    if (startDate && t < startDate.getTime()) return false;
    if (endDate && t > endDate.getTime()) return false;
    return true;
  });
}
