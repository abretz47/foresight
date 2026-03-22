import React, { PureComponent } from 'react';
import {
  View,
  Text,
  PanResponder,
  PanResponderInstance,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { COLORS } from '../styles/styles';

interface Props {
  /** The absolute start of the selectable range. */
  minDate: Date;
  /** The absolute end of the selectable range. */
  maxDate: Date;
  /** Currently selected start — must be within [minDate, maxDate]. */
  startDate: Date;
  /** Currently selected end — must be within [minDate, maxDate]. */
  endDate: Date;
  /** Called live as the user drags either handle. */
  onRangeChange: (start: Date, end: Date) => void;
}

interface State {
  trackWidth: number;
}

const THUMB_SIZE = 24;
const TRACK_HEIGHT = 4;

/** Formats a date as MM/DD/YYYY. */
function fmt(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const y = d.getFullYear();
  return `${m}/${day}/${y}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * A dual-handle range slider for selecting a date sub-range.
 *
 * The slider track spans [minDate, maxDate].  The two draggable thumbs
 * represent the currently selected [startDate, endDate].  The parent is
 * notified on every move via `onRangeChange`.
 */
export default class TimeRangeSlider extends PureComponent<Props, State> {
  /** Fraction at the moment the gesture was started — per handle. */
  private startInitFrac = 0;
  private endInitFrac = 0;

  private startPan: PanResponderInstance;
  private endPan: PanResponderInstance;

  constructor(props: Props) {
    super(props);
    this.state = { trackWidth: 0 };

    // Build one PanResponder per handle.  The callbacks access `this.props`
    // and `this.state` dynamically so they always see the latest values.
    this.startPan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        this.startInitFrac = this.dateToFrac(this.props.startDate);
      },
      onPanResponderMove: (_, gs) => {
        const { trackWidth } = this.state;
        if (trackWidth === 0) return;
        const endFrac = this.dateToFrac(this.props.endDate);
        const newFrac = clamp(
          this.startInitFrac + gs.dx / trackWidth,
          0,
          endFrac,
        );
        this.props.onRangeChange(this.fracToDate(newFrac), this.props.endDate);
      },
    });

    this.endPan = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        this.endInitFrac = this.dateToFrac(this.props.endDate);
      },
      onPanResponderMove: (_, gs) => {
        const { trackWidth } = this.state;
        if (trackWidth === 0) return;
        const startFrac = this.dateToFrac(this.props.startDate);
        const newFrac = clamp(
          this.endInitFrac + gs.dx / trackWidth,
          startFrac,
          1,
        );
        this.props.onRangeChange(this.props.startDate, this.fracToDate(newFrac));
      },
    });
  }

  // ── Date ↔ fraction helpers ───────────────────────────────────────────────

  private dateToFrac = (d: Date): number => {
    const { minDate, maxDate } = this.props;
    const span = maxDate.getTime() - minDate.getTime();
    if (span === 0) return 0;
    return clamp((d.getTime() - minDate.getTime()) / span, 0, 1);
  };

  private fracToDate = (f: number): Date => {
    const { minDate, maxDate } = this.props;
    const span = maxDate.getTime() - minDate.getTime();
    return new Date(Math.round(minDate.getTime() + f * span));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  render() {
    const { minDate, maxDate, startDate, endDate } = this.props;
    const { trackWidth } = this.state;

    const startFrac = this.dateToFrac(startDate);
    const endFrac = this.dateToFrac(endDate);
    const startPx = startFrac * trackWidth;
    const endPx = endFrac * trackWidth;

    // Whether the handles have been moved away from the full extent
    const isConstrained = startFrac > 0.005 || endFrac < 0.995;

    return (
      <View style={sliderStyles.root}>
        {/* ── Track + thumbs ─────────────────────────────────────── */}
        <View
          style={sliderStyles.trackWrapper}
          onLayout={(e: LayoutChangeEvent) =>
            this.setState({ trackWidth: e.nativeEvent.layout.width })
          }
        >
          {/* Background rail */}
          <View style={sliderStyles.trackBg} />

          {/* Active range fill */}
          {trackWidth > 0 && (
            <View
              style={[
                sliderStyles.trackFill,
                { left: startPx, width: Math.max(0, endPx - startPx) },
              ]}
            />
          )}

          {/* Start thumb */}
          {trackWidth > 0 && (
            <View
              style={[sliderStyles.thumb, { left: startPx - THUMB_SIZE / 2 }]}
              {...this.startPan.panHandlers}
            />
          )}

          {/* End thumb */}
          {trackWidth > 0 && (
            <View
              style={[sliderStyles.thumb, { left: endPx - THUMB_SIZE / 2 }]}
              {...this.endPan.panHandlers}
            />
          )}
        </View>

        {/* ── Bound labels (always shown) ───────────────────────── */}
        <View style={sliderStyles.boundRow}>
          <Text style={sliderStyles.boundLabel}>{fmt(minDate)}</Text>
          <Text style={sliderStyles.boundLabel}>{fmt(maxDate)}</Text>
        </View>

        {/* ── Selected-range pill (shown only when constrained) ─── */}
        {isConstrained && (
          <View style={sliderStyles.rangeRow}>
            <Text style={sliderStyles.rangeLabel}>From {fmt(startDate)}</Text>
            <Text style={sliderStyles.rangeLabel}>To {fmt(endDate)}</Text>
          </View>
        )}
      </View>
    );
  }
}

const sliderStyles = StyleSheet.create({
  root: {
    paddingTop: 4,
    paddingBottom: 4,
  },
  trackWrapper: {
    height: THUMB_SIZE,
    // Extra horizontal margin so thumbs at 0% / 100% aren't clipped
    marginHorizontal: THUMB_SIZE / 2,
    justifyContent: 'center',
  },
  trackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: COLORS.border,
  },
  trackFill: {
    position: 'absolute',
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: COLORS.primaryLight,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: COLORS.surface,
    borderWidth: 2.5,
    borderColor: COLORS.primaryLight,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
  },
  boundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  boundLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rangeLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
