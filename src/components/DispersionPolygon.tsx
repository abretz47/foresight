import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polygon, Circle, Line } from 'react-native-svg';
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
}

/**
 * Renders the dispersion convex hull as a filled SVG polygon.
 *
 * Coordinate mapping:
 *   normalised (0, 0) → canvas centre
 *   normalised (-1, -1) → top-left
 *   normalised (+1, +1) → bottom-right
 */
export default function DispersionPolygon({
  hull,
  width,
  height,
  fillColor = 'rgba(45,106,72,0.25)',
  strokeColor = COLORS.primaryLight,
}: Props) {
  if (hull.length === 0) {
    return <View style={[styles.placeholder, { width, height }]} />;
  }

  const cx = width / 2;
  const cy = height / 2;
  // Scale normalised coords to pixels; use half the smaller dimension so the
  // polygon fits comfortably within the card preview.
  const scale = Math.min(cx, cy) * 0.85;

  const toPixel = (p: Point) => ({
    px: cx + p.x * scale,
    py: cy + p.y * scale,
  });

  if (hull.length === 1) {
    const { px, py } = toPixel(hull[0]);
    return (
      <Svg width={width} height={height}>
        <Circle cx={px} cy={py} r={4} fill={strokeColor} />
      </Svg>
    );
  }

  if (hull.length === 2) {
    const p1 = toPixel(hull[0]);
    const p2 = toPixel(hull[1]);
    return (
      <Svg width={width} height={height}>
        <Line
          x1={p1.px}
          y1={p1.py}
          x2={p2.px}
          y2={p2.py}
          stroke={strokeColor}
          strokeWidth={2}
        />
      </Svg>
    );
  }

  const pixelPoints = hull.map(toPixel);
  const pointsStr = pixelPoints.map(({ px, py }) => `${px},${py}`).join(' ');

  return (
    <Svg width={width} height={height}>
      <Polygon
        points={pointsStr}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: 'transparent',
  },
});
