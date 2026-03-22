import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polygon, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Point } from '../lib/dispersion';
import { COLORS } from '../styles/styles';

interface Props {
  /** Hull vertices in normalised (relX, relY) coordinates [-1..+1 range). */
  hull: Point[];
  /** Rendered width in pixels. */
  width: number;
  /** Rendered height in pixels. */
  height: number;
  /** Fill colour for the polygon interior. */
  fillColor?: string;
  /** Stroke colour for the polygon outline. */
  strokeColor?: string;

  // ── Target-circle overlay ──────────────────────────────────────────────
  /** When true, draw the miss circle and (optionally) target circle as SVG rings. */
  showCircles?: boolean;
  /**
   * Ratio of targetRadius / missRadius (0..1).
   * When provided with showCircles, draws the inner (target) circle.
   */
  targetRadiusNorm?: number;
  /**
   * When true, show distance labels on the circles (max/min yardage) and a
   * radius indicator line.  Requires targetDistanceYds and missRadiusYds.
   */
  showLabels?: boolean;
  /** Target distance in yards — used for computing top/bottom yardage labels. */
  targetDistanceYds?: number;
  /** Miss radius in yards — label on the radius indicator. */
  missRadiusYds?: number;
  /** Target radius in yards — labels on the inner circle. */
  targetRadiusYds?: number;

  /**
   * Compact labels for smaller canvases (e.g. home-page cards).
   * Renders the target diameter (2 × targetRadiusYds) centred inside the target
   * circle, and the miss radius above the horizontal dashed indicator line.
   * Does NOT render the full top/bottom distance labels of showLabels.
   */
  showInnerLabels?: boolean;

  /**
   * Individual in-play shot positions in normalised coordinates to overlay as dots.
   * Each point uses the same (x, y) convention as hull vertices.
   */
  shots?: Array<{ x: number; y: number }>;

  // ── Scale override ─────────────────────────────────────────────────────
  /**
   * Explicit pixel radius for normalised coordinate 1.0.
   * When omitted the component auto-scales to fit the canvas (min(cx,cy)*0.85).
   * Pass missRadiusPx here to align the SVG overlay with real on-screen circles.
   */
  unitRadiusPx?: number;
}

/**
 * Renders the dispersion convex hull (and optionally target/miss circles with
 * distance labels) as an SVG overlay.
 *
 * Coordinate mapping:
 *   normalised (0, 0)   → canvas centre
 *   normalised (0, -1)  → top of miss circle (= max carry / "far" end)
 *   normalised (0, +1)  → bottom of miss circle (= min carry / "close" end)
 */
export default function DispersionPolygon({
  hull,
  width,
  height,
  fillColor = 'rgba(45,106,72,0.28)',
  strokeColor = COLORS.primaryLight,
  showCircles = false,
  targetRadiusNorm,
  showLabels = false,
  targetDistanceYds,
  missRadiusYds,
  targetRadiusYds,
  showInnerLabels = false,
  shots,
  unitRadiusPx,
}: Props) {
  const cx = width / 2;
  const cy = height / 2;
  // If an explicit scale is supplied (e.g. to align with real circles) use it;
  // otherwise auto-fit within the canvas.
  const scale = unitRadiusPx ?? Math.min(cx, cy) * 0.85;

  // Nothing to render at all
  if (hull.length === 0 && !showCircles && !shots?.length) {
    return <View style={[styles.placeholder, { width, height }]} />;
  }

  const toPixel = (p: Point) => ({
    px: cx + p.x * scale,
    py: cy + p.y * scale,
  });

  // ── Build hull element ───────────────────────────────────────────────
  let hullElement: React.ReactNode = null;
  if (hull.length === 1) {
    const { px, py } = toPixel(hull[0]);
    hullElement = <Circle cx={px} cy={py} r={4} fill={strokeColor} />;
  } else if (hull.length === 2) {
    const p1 = toPixel(hull[0]);
    const p2 = toPixel(hull[1]);
    hullElement = (
      <Line
        x1={p1.px} y1={p1.py}
        x2={p2.px} y2={p2.py}
        stroke={strokeColor}
        strokeWidth={2}
      />
    );
  } else if (hull.length >= 3) {
    const pointsStr = hull.map(toPixel).map(({ px, py }) => `${px},${py}`).join(' ');
    hullElement = (
      <Polygon
        points={pointsStr}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
      />
    );
  }

  // ── Label helpers ────────────────────────────────────────────────────
  const hasLabels =
    showLabels &&
    showCircles &&
    targetDistanceYds != null &&
    missRadiusYds != null;
  const dist = targetDistanceYds ?? 0;
  const missR = missRadiusYds ?? 0;
  const targR = targetRadiusYds ?? 0;
  const targNorm = targetRadiusNorm ?? 0;

  return (
    <Svg width={width} height={height}>
      {/* ── Miss circle ─────────────────────────────────────────── */}
      {showCircles && (
        <Circle
          cx={cx} cy={cy} r={scale}
          fill="none"
          stroke={COLORS.border}
          strokeWidth={1.5}
        />
      )}

      {/* ── Target (inner) circle ────────────────────────────────── */}
      {showCircles && targNorm > 0 && (
        <Circle
          cx={cx} cy={cy} r={targNorm * scale}
          fill="none"
          stroke="#E53935"
          strokeWidth={1.5}
        />
      )}

      {/* ── Hull polygon / line / dot ────────────────────────────── */}
      {hullElement}

      {/* ── Individual shot dots ─────────────────────────────────── */}
      {shots && shots.map((s, i) => {
        const { px, py } = toPixel(s);
        return (
          <Circle
            key={i}
            cx={px} cy={py} r={3}
            fill={strokeColor}
            opacity={0.55}
          />
        );
      })}

      {/* ── Distance labels (full) ───────────────────────────────── */}
      {hasLabels && (
        <>
          {/* Miss circle — far end (top, relY = -1) */}
          <SvgText
            x={cx} y={cy - scale - 5}
            textAnchor="middle"
            fontSize={9}
            fontWeight="600"
            fill={COLORS.textSecondary}
          >
            {(dist + missR).toFixed(0)}
          </SvgText>

          {/* Miss circle — close end (bottom, relY = +1) */}
          <SvgText
            x={cx} y={cy + scale + 13}
            textAnchor="middle"
            fontSize={9}
            fontWeight="600"
            fill={COLORS.textSecondary}
          >
            {(dist - missR).toFixed(0)} 
          </SvgText>

          {/* Target circle — far end */}
          {/* {targNorm > 0 && targR > 0 && (
            <SvgText
              x={cx} y={cy - targNorm * scale - 4}
              textAnchor="middle"
              fontSize={8}
              fill="#E53935"
            >
              {(dist + targR).toFixed(0)}
            </SvgText>
          )} */}

          {/* Target circle — close end */}
          {/* {targNorm > 0 && targR > 0 && (
            <SvgText
              x={cx} y={cy + targNorm * scale + 11}
              textAnchor="middle"
              fontSize={8}
              fill="#E53935"
            >
              {(dist - targR).toFixed(0)}
            </SvgText>
          )} */}

          {/* Radius indicator: centre → right edge of miss circle */}
          <Line
            x1={cx} y1={cy}
            x2={cx + scale} y2={cy}
            stroke={COLORS.textMuted}
            strokeWidth={1}
            strokeDasharray="3,3"
          />
          <SvgText
            x={cx + scale - 10} y={cy - 4}
            textAnchor="middle"
            fontSize={9}
            fill={COLORS.textMuted}
          >
            {missR}
          </SvgText>

          {/* Target diameter centred inside the target circle */}
          {targNorm > 0 && targR > 0 && (
            <SvgText
              x={cx} y={cy + 5}
              textAnchor="middle"
              fontSize={18}
              fontWeight="600"
              fill="#E53935"
            >
            {(targR * 2).toFixed(0)}
            </SvgText>
          )}
        </>
      )}

      {/* ── Compact inner labels (home-page cards) ───────────────── */}
      {showInnerLabels && showCircles && (
        <>
          {/* Radius indicator: centre → right edge of miss circle */}
          <Line
            x1={cx} y1={cy}
            x2={cx + scale} y2={cy}
            stroke={COLORS.textMuted}
            strokeWidth={1}
            strokeDasharray="3,3"
          />
          {missRadiusYds != null && missRadiusYds > 0 && (
            <SvgText
              x={cx + scale - 8 } y={cy - 3}
              textAnchor="middle"
              fontSize={8}
              fill={COLORS.textMuted}
            >
              {missRadiusYds}
            </SvgText>
          )}

          {/* Target diameter centred inside the target circle */}
          {targNorm > 0 && targetRadiusYds != null && targetRadiusYds > 0 && (
            <SvgText
              x={cx} y={cy + 4}
              textAnchor="middle"
              fontSize={12}
              fontWeight="600"
              fill="#E53935"
            >
            {(targetRadiusYds * 2).toFixed(0)}
            </SvgText>
          )}
        </>
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: 'transparent',
  },
});

