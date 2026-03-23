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
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../styles/styles'

interface FistPosition {
  /** 1-based fist index */
  n: number;
  /** pixel X position of the fist CENTER within the container */
  centerX: number;
  /** lateral distance in yards for this fist count */
  lateralYards: number;
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
const MAX_FISTS = 3;

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

  /** Height of the fist icon in pixels. */
  const FIST_HEIGHT = FIST_SIZE;
  /** Width of the label container — wide enough for "8 fists = 99.9yds" */
  const LABEL_WIDTH = 110;
  /** Height of the label. */
  const LABEL_HEIGHT = 18;

  // Build the list of fist positions (left side only).
  const positions: FistPosition[] = [];
  let hitLeftEdge = false;
  for (let n = 1; n <= MAX_FISTS; n++) {
    // Arc-based lateral offset in yards (Z-axis body rotation)
    const lateralYards = targetDistance * Math.tan(n * anglePerFist);
    const relX = -lateralYards / missRadius; // negative = left

    const fx = centerX + relX * missRadiusPx;

    // If a previous fist was already clamped to the left edge, adding more
    // would just stack them on top of each other — stop here.
    if (hitLeftEdge) break;

    // If this fist's natural position would overflow the left edge, clamp it
    // (handled in the render below) and stop after this one.
    if (fx - LABEL_WIDTH / 2 < 0) hitLeftEdge = true;

    positions.push({ n, centerX: fx, lateralYards });
  }

  if (positions.length === 0) return null;

  return (
    <>
      {positions.map(({ n, centerX: fx, lateralYards }) => {
        const distLabel = `${lateralYards.toFixed(1)}yds`;
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
