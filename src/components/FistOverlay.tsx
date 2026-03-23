/**
 * FistOverlay
 *
 * Renders a row of numbered fist silhouettes on the LEFT side of the
 * target/miss circle, showing the golfer how many fist-widths left
 * a given position is at arm's length and target distance.
 *
 * Math
 * ────
 * When the user holds their arm out and rotates on the Z-axis (body spin)
 * by N fist-widths, the lateral offset at distance D is:
 *
 *   angle_per_fist  = arctan(handWidth / armLength)
 *   lateral_n (yds) = D * tan(n * angle_per_fist)   ← proper arc formula
 *
 * Negative relX = left side of circle.
 */
import React from 'react';
import { View } from 'react-native';
import Svg, { G, Path, Circle, Text as SvgText } from 'react-native-svg';
import { COLORS } from '../styles/styles'

// ── Fist silhouette SVG ─────────────────────────────────────────────────────
// Drawn in a 40×52 viewport: four knuckled fingers + folded thumb + palm.
// All four fingers share a flat top row (knuckle bumps) and taper to the palm.
function FistSvg({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 40 52">
      {/* ── Palm / base of hand ── */}
      <Path
        d="M5,35 L5,45 Q5,50 10,50 L30,50 Q35,50 35,45 L35,35 Z"
        fill={color}
      />
      {/* ── Four fingers as a single flat-top block with rounded knuckle bumps ── */}
      {/* Index */}
      <Path
        d="M7,35 L7,18 Q7,13 11,13 Q15,13 15,18 L15,35 Z"
        fill={color}
      />
      {/* Middle (tallest) */}
      <Path
        d="M15,35 L15,14 Q15,9 19,9 Q23,9 23,14 L23,35 Z"
        fill={color}
      />
      {/* Ring */}
      <Path
        d="M23,35 L23,17 Q23,12 27,12 Q31,12 31,17 L31,35 Z"
        fill={color}
      />
      {/* Pinky */}
      <Path
        d="M31,35 L31,21 Q31,17 34,17 Q37,17 37,21 L37,35 Z"
        fill={color}
      />
      {/* ── Thumb folded across the front of the fingers ── */}
      <Path
        d="M5,35 Q3,32 4,27 Q5,22 9,20 Q13,18 14,22 Q11,24 10,28 L9,35 Z"
        fill={color}
      />
    </Svg>
  );
}

interface FistPosition {
  /** 1-based fist index */
  n: number;
  /** pixel X position of the fist CENTER within the container */
  centerX: number;
}

export interface FistOverlayProps {
  /** Total width of the containing touch area */
  containerWidth: number;
  /** Total height of the containing touch area */
  containerHeight: number;
  /** Pixel radius of the miss circle */
  missRadiusPx: number;
  /** Miss radius in yards (from shot profile) */
  missRadius: number;
  /** Target distance in yards (from shot profile) */
  targetDistance: number;
  /** User's hand width in cm (ring-knuckle → pinky-knuckle, fist closed) */
  handWidthCm: number;
  /** User's arm length in cm (palm-base → inside shoulder) */
  armLengthCm: number;
}

// Default body measurements (cm) used when the user hasn't set their profile.
export const DEFAULT_HAND_WIDTH_CM = 8;
export const DEFAULT_ARM_LENGTH_CM = 60;

/** Pixel width of each fist icon (height = size * 1.3 to accommodate the taller viewport). */
const FIST_SIZE = 56;
/** Opacity of the fist icons. */
const FIST_OPACITY = 0.55;
/** Fist icon fill colour (semi-transparent dark). */
const FIST_COLOR = COLORS.accent;
/** Maximum number of fist markers to display. */
const MAX_FISTS = 8;

export default function FistOverlay({
  containerWidth,
  containerHeight,
  missRadiusPx,
  missRadius,
  targetDistance,
  handWidthCm,
  armLengthCm,
}: FistOverlayProps) {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    missRadiusPx <= 0 ||
    missRadius <= 0 ||
    targetDistance <= 0 ||
    handWidthCm <= 0 ||
    armLengthCm <= 0
  ) {
    return null;
  }

  const anglePerFist = Math.atan(handWidthCm / armLengthCm); // radians (both inputs in cm, same unit, ratio is dimensionless)
  const centerX = containerWidth / 2;
  const centerY = containerHeight / 2;

  // Build the list of fist positions (left side only).
  const positions: FistPosition[] = [];
  for (let n = 1; n <= MAX_FISTS; n++) {
    // Arc-based lateral offset in yards (Z-axis body rotation)
    const lateralYards = targetDistance * Math.tan(n * anglePerFist);
    const relX = -lateralYards / missRadius; // negative = left

    // Stop once we've gone more than 10% beyond the miss circle edge
    if (relX < -1.1) break;

    positions.push({ n, centerX: centerX + relX * missRadiusPx });
  }

  if (positions.length === 0) return null;

  /** Height of the fist SVG in pixels (viewBox is taller than it is wide). */
  const FIST_HEIGHT = FIST_SIZE * 1.3;
  /** Height of the numeric label SVG below the fist. */
  const LABEL_HEIGHT = 20;

  return (
    <>
      {positions.map(({ n, centerX: fx }) => (
        <View
          key={n}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: fx - FIST_SIZE / 2,
            top: centerY - FIST_HEIGHT / 2,
            width: FIST_SIZE,
            height: FIST_HEIGHT + LABEL_HEIGHT,
            opacity: FIST_OPACITY,
            zIndex: 4,
            alignItems: 'center',
          }}
        >
          <FistSvg size={FIST_SIZE} color={FIST_COLOR} />
          {/* Numeric label below the fist */}
          <Svg
            width={FIST_SIZE}
            height={LABEL_HEIGHT}
          >
            <SvgText
              x={FIST_SIZE / 2}
              y={15}
              textAnchor="middle"
              fontSize="14"
              fontWeight="700"
              fill={FIST_COLOR}
            >
              {n}
            </SvgText>
          </Svg>
        </View>
      ))}
    </>
  );
}
