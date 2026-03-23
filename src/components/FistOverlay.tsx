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

// ── Tiny fist silhouette SVG ────────────────────────────────────────────────
// Drawn in a 32×32 viewport, filled solid.
function FistSvg({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      {/* Palm base */}
      <Path
        d="M8,26 Q7,30 12,31 Q16,32 20,31 Q25,30 24,26"
        fill={color}
      />
      {/* Index finger */}
      <Path
        d="M11,26 L10,16 Q10,12 13,12 Q16,12 16,16 L16,26"
        fill={color}
      />
      {/* Middle finger */}
      <Path
        d="M16,26 L15,13 Q15,9 18,9 Q21,9 21,13 L21,26"
        fill={color}
      />
      {/* Ring finger */}
      <Path
        d="M21,26 L20,15 Q20,11 23,11 Q26,11 26,15 L26,26"
        fill={color}
      />
      {/* Pinky finger */}
      <Path
        d="M26,26 L24,19 Q24,15 27,15 Q30,15 30,19 L29,26"
        fill={color}
      />
      {/* Thumb (folded across) */}
      <Path
        d="M8,26 Q6,22 8,18 Q10,14 13,14 Q14,16 12,18 L11,26"
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

/** Pixel size of each fist icon. */
const FIST_SIZE = 28;
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

  return (
    <>
      {positions.map(({ n, centerX: fx }) => (
        <View
          key={n}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: fx - FIST_SIZE / 2,
            top: centerY - FIST_SIZE / 2,
            width: FIST_SIZE,
            height: FIST_SIZE,
            opacity: FIST_OPACITY,
            zIndex: 4,
            alignItems: 'center',
          }}
        >
          <FistSvg size={FIST_SIZE} color={FIST_COLOR} />
          {/* Numeric label below the fist */}
          <Svg
            width={FIST_SIZE}
            height={14}
            style={{ position: 'absolute', top: FIST_SIZE - 2 }}
          >
            <SvgText
              x={FIST_SIZE / 2}
              y={11}
              textAnchor="middle"
              fontSize="10"
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
