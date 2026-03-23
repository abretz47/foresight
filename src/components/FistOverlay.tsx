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
 *   lateral_n (dist) = D * tan(n * angle_per_fist)   ← proper arc formula
 *
 * Negative relX = left side of circle.
 */
import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../styles/styles'

interface FistPosition {
  /** 1-based fist index */
  n: number;
  /** pixel X position of the fist CENTER within the container */
  centerX: number;
  /** lateral distance in the user's preferred unit for this fist count */
  lateralDist: number;
}

export interface FistOverlayProps {
  /** Total width of the containing touch area */
  containerWidth: number;
  /** Total height of the containing touch area */
  containerHeight: number;
  /** Pixel radius of the miss circle */
  missRadiusPx: number;
  /** Miss radius in the user's preferred unit (from shot profile) */
  missRadius: number;
  /** Target distance in the user's preferred unit (from shot profile) */
  targetDistance: number;
  /** User's hand width in cm (ring-knuckle → pinky-knuckle, fist closed) */
  handWidthCm: number;
  /** User's arm length in cm (palm-base → inside shoulder) */
  armLengthCm: number;
  /** Preferred unit system — controls the distance label ('m' vs 'yds') */
  units?: 'imperial' | 'metric';
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
const MAX_FISTS = 3;

export default function FistOverlay({
  containerWidth,
  containerHeight,
  missRadiusPx,
  missRadius,
  targetDistance,
  handWidthCm,
  armLengthCm,
  units = 'imperial',
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

  /** Height of the fist icon in pixels. */
  const FIST_HEIGHT = FIST_SIZE;
  /** Width of the label container — wide enough for "8 fists = 999m" */
  const LABEL_WIDTH = 110;
  /** Height of the label. */
  const LABEL_HEIGHT = 18;

  // Build the list of fist positions (left side only).
  const positions: FistPosition[] = [];
  const distUnit = units === 'metric' ? 'm' : 'yds';
  for (let n = 1; n <= MAX_FISTS; n++) {
    // Arc-based lateral offset in the user's preferred unit (Z-axis body rotation)
    const lateralDist = targetDistance * Math.tan(n * anglePerFist);
    const relX = -lateralDist / missRadius; // negative = left

    const fx = centerX + relX * missRadiusPx;

    // For fists beyond the first: if the natural position overflows the left
    // edge, stop — clamping it would stack it on top of the previous fist.
    // The first fist is always included (possibly clamped in the render).
    if (n > 1 && fx - LABEL_WIDTH / 2 < 0) break;

    positions.push({ n, centerX: fx, lateralDist });
  }

  if (positions.length === 0) return null;

  return (
    <>
      {positions.map(({ n, centerX: fx, lateralDist }) => {
        const distLabel = `${lateralDist.toFixed(1)}${distUnit}`;
        const label = n === 1
          ? `1 fist = ${distLabel}`
          : `${n} fists = ${distLabel}`;
        return (
          <View
            key={n}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: Math.max(0, fx - LABEL_WIDTH / 2),
              top: centerY - (FIST_HEIGHT + LABEL_HEIGHT) / 2,
              width: LABEL_WIDTH,
              height: FIST_HEIGHT + LABEL_HEIGHT,
              opacity: FIST_OPACITY,
              zIndex: 4,
              alignItems: 'center',
            }}
          >
            <MaterialCommunityIcons
              name="hand-back-right"
              size={FIST_SIZE}
              color={FIST_COLOR}
            />
            <Text
              style={{
                color: FIST_COLOR,
                fontSize: 11,
                fontWeight: '700',
                textAlign: 'center',
                lineHeight: LABEL_HEIGHT,
              }}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </>
  );
}
