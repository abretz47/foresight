import React, { Component } from 'react';
import { TouchableOpacity, Text, View, Dimensions, Switch, Animated, PanResponder, StyleSheet, Modal, TouchableWithoutFeedback } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { styles, COLORS } from '../styles/styles';
import * as DB from '../data/db';
import { DataPoint, ShotProfile } from '../data/db';
import { RecordNavigationProp, RecordRouteProp } from '../types/navigation';
import * as PiTracService from '../lib/piTracService';
import type { PiTracShot } from '../lib/piTracService';
import { PITRAC_ENABLED } from '../lib/featureFlags';
import EmojiText from '../components/EmojiText';
import * as SessionService from '../lib/sessionService';
import { computeDispersionHull } from '../lib/dispersion';
import DispersionPolygon from '../components/DispersionPolygon';

/** Metres to yards conversion factor */
const M_TO_YD = 1.09361;

interface Props {
  navigation: RecordNavigationProp;
  route: RecordRouteProp;
}

interface State {
  screenWidth: number;
  screenHeight: number;
  shotName: string;
  targetDistance: string;
  targetRadius: string;
  missRadius: string;
  targetRadiusPx: number;
  missRadiusPx: number;
  modalVisible: boolean;
  clickedFrom: string;
  shotDistance: string;
  shotAccuracy: string;
  shotX: number | string;
  shotY: number | string;
  relX: number;
  relY: number;
  data: DataPoint[];
  shots: ShotProfile[];
  selectedShot: number;
  shotId: string;
  calledFrom: string;
  containerWidth: number;
  containerHeight: number;
  containerPageX: number;
  containerPageY: number;
  offTarget: boolean;
  pickerVisible: boolean;
  statsInfoVisible: null | 'left' | 'inPlay' | 'right';
  /** true while PiTrac WebSocket is open */
  piTracConnected: boolean;
  /** true when the dispersion hull overlay is shown in Analyze mode */
  showDispersionOverlay: boolean;
  /** pre-computed dispersion hull for the current data set (overlay) */
  dispersionHull: import('../lib/dispersion').Point[];
}

const CIRCLE_SIZE_RATIO = 0.7;
const MAX_CIRCLE_HEIGHT_RATIO = 0.5;
const PICKER_BUTTON_INITIAL_BOTTOM = 20;
const PICKER_BUTTON_INITIAL_RIGHT = 12;
const PICKER_WIDTH = 260;
const STATS_AMBER = '#F0A030';

export default class Record extends Component<Props, State> {
  private focusListener: (() => void) | null = null;
  private containerRef = React.createRef<View>();
  private pickerButtonRef = React.createRef<View>();
  private panValue = new Animated.ValueXY({ x: 0, y: 0 });
  /** Animated value for the PiTrac live-indicator pulse (opacity 1 → 0.15 loop) */
  private piTracPulse = new Animated.Value(1);
  private piTracPulseAnim: Animated.CompositeAnimation | null = null;
  private unsubPiTracShot: (() => void) | null = null;
  private unsubPiTracConn: (() => void) | null = null;
  private panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      this.panValue.setOffset({
        x: (this.panValue.x as any)._value,
        y: (this.panValue.y as any)._value,
      });
      this.panValue.setValue({ x: 0, y: 0 });
    },
    onPanResponderMove: Animated.event(
      [null, { dx: this.panValue.x, dy: this.panValue.y }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: (evt, gestureState) => {
      this.panValue.flattenOffset();
      // Tap (not drag): toggle picker
      if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
        this.setState((prev) => ({ pickerVisible: !prev.pickerVisible }));
      }
    },
  });

  constructor(props: Props) {
    super(props);
    const { route } = this.props;
    this.state = {
      screenWidth: Math.round(Dimensions.get('window').width),
      screenHeight: Math.round(Dimensions.get('window').height),
      shotName: route.params?.shotName ?? '--',
      targetDistance: route.params?.targetDistance ?? '--',
      targetRadius: route.params?.targetRadius ?? '--',
      missRadius: route.params?.missRadius ?? '--',
      targetRadiusPx:
        Math.round(
          Math.round(Dimensions.get('window').width) *
            ((Number(route.params?.targetRadius) || 1) / (Number(route.params?.missRadius) || 1)) *
            CIRCLE_SIZE_RATIO
        ) / 2,
      missRadiusPx: Math.round(Math.round(Dimensions.get('window').width) * CIRCLE_SIZE_RATIO) / 2,
      modalVisible: false,
      clickedFrom: '',
      shotDistance: '',
      shotAccuracy: '',
      shotX: '',
      shotY: '',
      relX: 0,
      relY: 0,
      data: [],
      shots: [],
      selectedShot: 0,
      shotId: route.params?.id ?? '--',
      calledFrom: route.params?.calledFrom ?? 'Default',
      containerWidth: 0,
      containerHeight: 0,
      containerPageX: 0,
      containerPageY: 0,
      offTarget: false,
      pickerVisible: false,
      statsInfoVisible: null,
      piTracConnected: PiTracService.isConnected(),
      showDispersionOverlay: false,
      dispersionHull: [],
    };
  }

  componentDidMount() {
    const { navigation } = this.props;
    this.focusListener = navigation.addListener('focus', () => {
      const { route } = this.props;
      const shotId = route.params?.id ?? this.state.shotId;
      const targetRadius = route.params?.targetRadius ?? this.state.targetRadius;
      const missRadius = route.params?.missRadius ?? this.state.missRadius;
      const { containerWidth, containerHeight } = this.state;
      const missDiameter = Math.min(containerWidth * CIRCLE_SIZE_RATIO, containerHeight * MAX_CIRCLE_HEIGHT_RATIO);
      this.setState(
        {
          shotId,
          shotName: route.params?.shotName ?? this.state.shotName,
          targetDistance: route.params?.targetDistance ?? this.state.targetDistance,
          targetRadius,
          missRadius,
          targetRadiusPx:
            Math.round(missDiameter * ((Number(targetRadius) || 1) / (Number(missRadius) || 1))) / 2,
          missRadiusPx: Math.round(missDiameter) / 2,
        },
        () => {
          this.loadData(shotId);
          this.loadShots();
        }
      );
    });

    // Subscribe to PiTrac connection state changes
    if (PITRAC_ENABLED) {
      this.unsubPiTracConn = PiTracService.addConnectionListener((connected) => {
        this.setState({ piTracConnected: connected });
        if (connected) {
          this.startPiTracPulse();
        } else {
          this.stopPiTracPulse();
        }
      });

      // Subscribe to incoming PiTrac shots
      this.unsubPiTracShot = PiTracService.addShotListener((shot) => {
        // Only auto-log when in Record mode
        if (this.state.calledFrom === 'Record') {
          this.handlePiTracShot(shot);
        }
      });

      // If already connected when we mount, start the animation
      if (PiTracService.isConnected()) {
        this.startPiTracPulse();
      }
    }
  }

  componentWillUnmount() {
    if (this.focusListener) {
      this.focusListener();
    }
    if (this.unsubPiTracShot) this.unsubPiTracShot();
    if (this.unsubPiTracConn) this.unsubPiTracConn();
    this.stopPiTracPulse();
  }

  // ── PiTrac helpers ──────────────────────────────────────────────────────

  private startPiTracPulse() {
    if (this.piTracPulseAnim) return;
    this.piTracPulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(this.piTracPulse, { toValue: 0.15, duration: 600, useNativeDriver: true }),
        Animated.timing(this.piTracPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    this.piTracPulseAnim.start();
  }

  private stopPiTracPulse() {
    if (this.piTracPulseAnim) {
      this.piTracPulseAnim.stop();
      this.piTracPulseAnim = null;
    }
    this.piTracPulse.setValue(1);
  }

  /**
   * Converts a PiTrac shot payload into Foresight's relX/relY coordinates
   * and opens the confirmation modal.
   *
   * Coordinate mapping
   * ------------------
   *  PiTrac carry  (metres) → yards → relY = (targetDistance - carryYd) / missRadius
   *  PiTrac side_angle (deg, +right) → lateral offset → relX = lateralYd / missRadius
   */
  private handlePiTracShot = (shot: PiTracShot) => {
    const { targetDistance, missRadius, missRadiusPx, containerWidth, containerHeight } = this.state;

    const targetDist = Number(targetDistance);
    const missR = Number(missRadius);

    // Convert carry from metres to yards, guarding against invalid values
    const rawCarry = typeof shot.carry === 'number' && isFinite(shot.carry) ? shot.carry : 0;
    const carryYd = rawCarry * M_TO_YD;

    // Lateral offset: carry × sin(sideAngle)
    const rawSide = typeof shot.side_angle === 'number' && isFinite(shot.side_angle) ? shot.side_angle : 0;
    const sideAngleRad = (rawSide * Math.PI) / 180;
    const lateralYd = carryYd * Math.sin(sideAngleRad);

    const relX = missR > 0 ? lateralYd / missR : 0;
    const relY = missR > 0 ? (targetDist - carryYd) / missR : 0;

    const distFromCenter = Math.sqrt(relX * relX + relY * relY);
    const offTarget = distFromCenter > 1;

    const targetRatioPx = this.state.targetRadiusPx;
    const clickedFrom =
      distFromCenter * missRadiusPx <= targetRatioPx ? 'target' : 'miss';

    // Physical pixel coords for storage (re-project rel onto the current canvas)
    const shotX = containerWidth / 2 + relX * missRadiusPx;
    const shotY = containerHeight / 2 + relY * missRadiusPx;

    this.setState({
      shotDistance: carryYd.toFixed(0),
      shotAccuracy: lateralYd.toFixed(0),
      shotX,
      shotY,
      relX,
      relY,
      clickedFrom,
      offTarget,
      modalVisible: true,
    });
  };

  targetStyle = () => ({
    position: 'absolute' as const,
    left: (this.state.containerWidth - this.state.targetRadiusPx * 2) / 2,
    top: (this.state.containerHeight - this.state.targetRadiusPx * 2) / 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    backgroundColor: 'red' as const,
    width: this.state.targetRadiusPx * 2,
    height: this.state.targetRadiusPx * 2,
    borderRadius: this.state.targetRadiusPx,
    zIndex: 2,
  });

  dataStyle = (left: number, top: number) => ({
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    backgroundColor: 'black' as const,
    width: 10,
    height: 10,
    position: 'absolute' as const,
    left,
    top,
    borderRadius: 5,
    zIndex: 1000,
  });

  missStyle = () => ({
    position: 'absolute' as const,
    left: (this.state.containerWidth - this.state.missRadiusPx * 2) / 2,
    top: (this.state.containerHeight - this.state.missRadiusPx * 2) / 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    width: this.state.missRadiusPx * 2,
    height: this.state.missRadiusPx * 2,
    backgroundColor: '#FFFFFF' as const,
    borderRadius: this.state.missRadiusPx,
    zIndex: 1,
  });

  /**
   * Returns the normalized (relX, relY) coordinates for a stored DataPoint,
   * relative to the circle center divided by missRadiusPx.
   * New shots have relX/relY stored directly; for legacy shots that only have
   * absolute shotX/shotY we fall back to estimating the original missRadiusPx
   * from the stored screenWidth.
   */
  getRelCoords = (item: DataPoint): { relX: number; relY: number } => {
    if (item.relX !== undefined && item.relY !== undefined) {
      return { relX: item.relX, relY: item.relY };
    }
    // Legacy fallback: estimate missRadiusPx from stored screen dimensions
    const oldMissRadiusPx =
      Math.round(
        Math.min(
          item.screenWidth * CIRCLE_SIZE_RATIO,
          item.screenHeight * MAX_CIRCLE_HEIGHT_RATIO
        )
      ) / 2 || 1;
    return {
      relX: (item.shotX - item.screenWidth / 2) / oldMissRadiusPx,
      relY: (item.shotY - item.screenHeight / 2) / oldMissRadiusPx,
    };
  };


  convertShotAccuracy = (number: string | number) => {
    const absVal = Math.abs(Number(number));
    if (Number(number) <= 0) {
      return String(absVal) + ' Left';
    } else {
      return String(absVal) + ' Right';
    }
  };

  loadData = (id: string) => {
    const user = this.props.route.params?.user ?? '';
    DB.getShotData(user, id, (data) => {
      this.setState({ data, dispersionHull: computeDispersionHull(data) });
    });
  };

  loadShots = () => {
    const user = this.props.route.params?.user ?? '';
    DB.getShotProfile(user, (shots) => {
      const { shotId } = this.state;
      const selectedShot = Math.max(0, shots.findIndex((s) => s.id === shotId));
      this.setState({ shots, selectedShot });
    });
  };

  selectionChange = (index: number) => {
    const selection = this.state.shots[index];
    if (!selection) return;
    const { containerWidth, containerHeight } = this.state;
    const missDiameter = Math.min(containerWidth * CIRCLE_SIZE_RATIO, containerHeight * MAX_CIRCLE_HEIGHT_RATIO);
    const targetRadius = selection.targetRadius;
    const missRadius = selection.missRadius;
    this.setState(
      {
        selectedShot: index,
        shotId: selection.id,
        shotName: selection.name,
        targetDistance: selection.distance,
        targetRadius,
        missRadius,
        targetRadiusPx: Math.round(missDiameter * ((Number(targetRadius) || 1) / (Number(missRadius) || 1))) / 2,
        missRadiusPx: Math.round(missDiameter) / 2,
        data: [],
      },
      () => {
        this.loadData(selection.id);
      }
    );
  };

  render() {
    const { piTracConnected, calledFrom } = this.state;
    const showPiTracIndicator = PITRAC_ENABLED && piTracConnected && calledFrom === 'Record';

    return (
      <View style={styles.template}>
        {/* Shot info bar */}
        <View style={recordStyles.infoBar}>
          <Text style={recordStyles.shotInfoText}>
            {this.state.shotName}
          </Text>
          {showPiTracIndicator ? (
            <View style={recordStyles.piTracBadge}>
              <Animated.View style={[recordStyles.piTracBadgeDot, { opacity: this.piTracPulse }]} />
              <Text style={recordStyles.piTracBadgeText}>PiTrac Live</Text>
            </View>
          ) : (
            <Text style={recordStyles.shotDistanceText}>
              Target: {this.state.targetDistance} yds
            </Text>
          )}
        </View>

        {/* Record / Analyze toggle */}
        <View style={styles.sliderRow}>
          <Text style={styles.sliderLabel}>Record</Text>
          <Switch
            value={this.state.calledFrom === 'Analyze'}
            onValueChange={(value) => {
              const calledFrom = value ? 'Analyze' : 'Record';
              this.setState({ calledFrom });
              if (value) {
                const { shotId } = this.state;
                this.loadData(shotId);
              }
            }}
            thumbColor={COLORS.accent}
            trackColor={{ false: COLORS.textSecondary, true: COLORS.primaryLight }}
          />
          <Text style={styles.sliderLabel}>Analyze</Text>
          {/* Dispersion overlay toggle — only shown in Analyze mode */}
          {this.state.calledFrom === 'Analyze' && (
            <TouchableOpacity
              style={[
                recordStyles.overlayBtn,
                this.state.showDispersionOverlay && recordStyles.overlayBtnActive,
              ]}
              onPress={() =>
                this.setState((prev) => ({
                  showDispersionOverlay: !prev.showDispersionOverlay,
                }))
              }
            >
              <Text
                style={[
                  recordStyles.overlayBtnText,
                  this.state.showDispersionOverlay && recordStyles.overlayBtnTextActive,
                ]}
              >
                Dispersion
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats bar — always rendered so layout height is consistent between Record and Analyze modes */}
        {(() => {
          const showStats = this.state.calledFrom === 'Analyze' && this.state.data.length > 0;
          let leftPct = 0;
          let inPlayPct = 0;
          let rightPct = 0;
          let avgLeft: string = '--';
          let avgDistance: string = '--';
          let avgRight: string = '--';
          if (showStats) {
            const { data, missRadius, targetDistance } = this.state;
            const total = data.length;
            const missR = Number(missRadius);
            const targetDist = Number(targetDistance);
            const onTargetShots = data.filter((s) => s.offTarget === false);
            const leftShots = onTargetShots.filter((s) => this.getRelCoords(s).relX < 0);
            const rightShots = onTargetShots.filter((s) => this.getRelCoords(s).relX >= 0);
            const onTargetTotal = onTargetShots.length;
            leftPct = onTargetTotal > 0 ? Math.round((leftShots.length / onTargetTotal) * 100) : 0;
            rightPct = onTargetTotal > 0 ? Math.round((rightShots.length / onTargetTotal) * 100) : 0;
            inPlayPct = Math.round((onTargetShots.length / total) * 100);
            avgLeft = leftShots.length > 0
              ? (leftShots.reduce((sum, s) => sum + Math.abs(this.getRelCoords(s).relX * missR), 0) / leftShots.length).toFixed(1)
              : '--';
            avgRight = rightShots.length > 0
              ? (rightShots.reduce((sum, s) => sum + (this.getRelCoords(s).relX * missR), 0) / rightShots.length).toFixed(1)
              : '--';
            avgDistance = onTargetShots.length > 0
              ? (onTargetShots.reduce((sum, s) => sum + (targetDist - this.getRelCoords(s).relY * missR), 0) / onTargetShots.length).toFixed(1)
              : '--';
          }

          // Color avgDistance by percentage of target distance
          const { targetDistance } = this.state;
          const targetDist = Number(targetDistance);
          const avgDistNum = Number(avgDistance);
          const avgDistPct = avgDistance !== '--' && targetDist > 0 ? (avgDistNum / targetDist) * 100 : null;
          const avgDistColor =
            avgDistPct === null ? COLORS.textLight
            : avgDistPct < 85 ? COLORS.danger
            : avgDistPct <= 92 ? STATS_AMBER
            : avgDistPct >= 93 ? COLORS.success
            : COLORS.textLight;

          return (
            <View style={[styles.statsRow, !showStats && { opacity: 0, pointerEvents: 'none' }]}
              accessibilityElementsHidden={!showStats}
              importantForAccessibility={!showStats ? 'no-hide-descendants' : 'auto'}
            >
              {/* Left column */}
              <View style={styles.statCell}>
                <View style={recordStyles.statLabelRow}>
                  <Text style={styles.statLabel}>◀ Left</Text>
                  <TouchableOpacity onPress={() => this.setState({ statsInfoVisible: 'left' })} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <MaterialCommunityIcons name="information-outline" size={12} color={COLORS.accentLight} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.statValue}>{leftPct}%</Text>
                <Text style={styles.statValue}>{avgLeft}</Text>
              </View>
              {/* In Play column */}
              <View style={styles.statCell}>
                <View style={recordStyles.statLabelRow}>
                  <Text style={styles.statLabel}>In Play</Text>
                  <TouchableOpacity onPress={() => this.setState({ statsInfoVisible: 'inPlay' })} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <MaterialCommunityIcons name="information-outline" size={12} color={COLORS.accentLight} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.statValue}>{inPlayPct}%</Text>
                <Text style={[styles.statValue, { color: avgDistColor }]}>{avgDistance}</Text>
              </View>
              {/* Right column */}
              <View style={styles.statCell}>
                <View style={recordStyles.statLabelRow}>
                  <Text style={styles.statLabel}>Right ▶</Text>
                  <TouchableOpacity onPress={() => this.setState({ statsInfoVisible: 'right' })} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <MaterialCommunityIcons name="information-outline" size={12} color={COLORS.accentLight} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.statValue}>{rightPct}%</Text>
                <Text style={styles.statValue}>{avgRight}</Text>
              </View>
            </View>
          );
        })()}

        {/* Stats info tooltip modal */}
        <Modal
          visible={this.state.statsInfoVisible !== null}
          transparent
          animationType="fade"
          onRequestClose={() => this.setState({ statsInfoVisible: null })}
        >
          <TouchableWithoutFeedback onPress={() => this.setState({ statsInfoVisible: null })}>
            <View style={[styles.modalContainer, recordStyles.backdrop]}>
              {/* Inner touchable stops backdrop tap from reaching the content card */}
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={[styles.modalContent, recordStyles.infoModalContent]}>
                  <Text style={recordStyles.infoModalTitle}>
                    {this.state.statsInfoVisible === 'left' && '◀ Left'}
                    {this.state.statsInfoVisible === 'inPlay' && 'In Play'}
                    {this.state.statsInfoVisible === 'right' && 'Right ▶'}
                  </Text>
                  <Text style={recordStyles.infoModalBody}>
                    {this.state.statsInfoVisible === 'left' &&
                      'Top: % of in-play shots that landed left of centre.\nBottom: average left deviation from centre (yards).'}
                    {this.state.statsInfoVisible === 'inPlay' &&
                      'Top: % of shots that landed within the miss radius (in play).\nBottom: average carry distance of in-play shots (yards). Coloured green ≥93 %, amber <=92 %, red <85 % of target distance.'}
                    {this.state.statsInfoVisible === 'right' &&
                      'Top: % of in-play shots that landed right of centre.\nBottom: average right deviation from centre (yards).'}
                  </Text>
                  <TouchableOpacity style={recordStyles.infoModalClose} onPress={() => this.setState({ statsInfoVisible: null })}>
                    <Text style={styles.buttonLabelLight}>Close</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Main touch area */}
        <TouchableOpacity
          ref={this.containerRef}
          style={styles.touchableContainer}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width !== this.state.containerWidth || height !== this.state.containerHeight) {
              const { targetRadius, missRadius } = this.state;
              const missDiameter = Math.min(width * CIRCLE_SIZE_RATIO, height * MAX_CIRCLE_HEIGHT_RATIO);
              const newMissRadiusPx = Math.round(missDiameter) / 2;
              const newTargetRadiusPx =
                Math.round(
                  missDiameter * ((Number(targetRadius) || 1) / (Number(missRadius) || 1))
                ) / 2;
              this.setState(
                {
                  containerWidth: width,
                  containerHeight: height,
                  missRadiusPx: newMissRadiusPx,
                  targetRadiusPx: newTargetRadiusPx,
                },
                () => {
                  // Track page-relative position for web click coordinate fallback
                  if (this.containerRef.current) {
                    this.containerRef.current.measureInWindow((pageX, pageY) => {
                      this.setState({ containerPageX: pageX, containerPageY: pageY });
                    });
                  }
                }
              );
            }
          }}
          onPress={(evt) => {
            // Manual input is disabled when PiTrac is connected in Record mode
            if (this.state.calledFrom === 'Record' && PITRAC_ENABLED && this.state.piTracConnected) {
              return;
            }
            if (this.state.calledFrom === 'Record') {
              const centerX = this.state.containerWidth / 2;
              const centerY = this.state.containerHeight / 2;
              let locationX = evt.nativeEvent.locationX;
              let locationY = evt.nativeEvent.locationY;
              // Web fallback: locationX/Y may be NaN on web; compute from page coordinates
              if (isNaN(locationX) || isNaN(locationY)) {
                const webEvent = evt.nativeEvent as any;
                locationX = (webEvent.pageX ?? webEvent.clientX ?? 0) - this.state.containerPageX;
                locationY = (webEvent.pageY ?? webEvent.clientY ?? 0) - this.state.containerPageY;
              }
              const dx = locationX - centerX;
              const dy = locationY - centerY;
              const distFromCenter = Math.sqrt(dx * dx + dy * dy);
              const clickedFrom = distFromCenter <= this.state.targetRadiusPx ? 'target' : 'miss';
              const offTarget = distFromCenter > this.state.missRadiusPx;
              const relX = dx / this.state.missRadiusPx;
              const relY = dy / this.state.missRadiusPx;
              this.setState({
                shotDistance: (
                  Number(this.state.targetDistance) -
                  relY * Number(this.state.missRadius)
                ).toFixed(0),
                shotAccuracy: (
                  relX * Number(this.state.missRadius)
                ).toFixed(0),
                shotX: locationX,
                shotY: locationY,
                relX,
                relY,
                clickedFrom,
                offTarget,
                modalVisible: true,
              });
            }
          }}
        >
          {/* Miss circle */}
          <View style={this.missStyle()} pointerEvents="none">
            <Text style={styles.circleLabelTop}>
              {(Number(this.state.targetDistance) + Number(this.state.missRadius)).toFixed(0)}
            </Text>
            <Text style={styles.circleLabelBottom}>
              {(Number(this.state.targetDistance) - Number(this.state.missRadius)).toFixed(0)}
            </Text>
          </View>
          {/* Target circle */}
          <View style={this.targetStyle()} pointerEvents="none">
            <Text style={styles.circleLabelInnerTop}>
              {(Number(this.state.targetDistance) + Number(this.state.targetRadius)).toFixed(0)}
            </Text>
            <Text style={styles.circleLabelInnerBottom}>
              {(Number(this.state.targetDistance) - Number(this.state.targetRadius)).toFixed(0)}
            </Text>
          </View>
          {/* Radius indicator line */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: this.state.containerWidth / 2,
              top: this.state.containerHeight / 2,
              width: this.state.missRadiusPx,
              height: 1.5,
              backgroundColor: COLORS.textSecondary,
              zIndex: 3,
            }}
          />
          <Text
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: this.state.containerWidth / 2 + 50,
              top: this.state.containerHeight / 2 - 16,
              width: this.state.missRadiusPx,
              textAlign: 'center',
              fontSize: 11,
              zIndex: 3,
              color: COLORS.textSecondary,
              fontWeight: '600',
            }}
          >
            {this.state.missRadius} yds
          </Text>
          {/* Data points (Analyze mode) */}
          {this.state.calledFrom === 'Analyze' &&
            Object.keys(this.state.data).map((key) => {
              const item = this.state.data[Number(key)];
              const { relX, relY } = this.getRelCoords(item);
              const dotX = this.state.containerWidth / 2 + relX * this.state.missRadiusPx - 5;
              const dotY = this.state.containerHeight / 2 + relY * this.state.missRadiusPx - 5;
              return <View style={this.dataStyle(dotX, dotY)} key={key} />;
            })}
          {/* Dispersion overlay (Analyze mode, when toggled on) */}
          {this.state.showDispersionOverlay &&
            this.state.calledFrom === 'Analyze' &&
            this.state.missRadiusPx > 0 && (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: (this.state.containerWidth - this.state.missRadiusPx * 2) / 2,
                  top: (this.state.containerHeight - this.state.missRadiusPx * 2) / 2,
                  width: this.state.missRadiusPx * 2,
                  height: this.state.missRadiusPx * 2,
                  zIndex: 5,
                }}
              >
                <DispersionPolygon
                  hull={computeDispersionHull(this.state.data)}
                  width={this.state.missRadiusPx * 2}
                  height={this.state.missRadiusPx * 2}
                  unitRadiusPx={this.state.missRadiusPx}
                  showCircles={false}
                  fillColor="rgba(45,106,72,0.30)"
                  strokeColor={COLORS.primaryLight}
                />
              </View>
            )}
        </TouchableOpacity>

        {/* Floating draggable picker button */}
        <Animated.View
          style={{
            position: 'absolute',
            bottom: PICKER_BUTTON_INITIAL_BOTTOM,
            right: PICKER_BUTTON_INITIAL_RIGHT,
            zIndex: 100,
            alignItems: 'flex-end',
            transform: this.panValue.getTranslateTransform(),
          }}
        >
          {/* Picker shown above button when open */}
          {this.state.pickerVisible && (
            <View
              style={{
                width: PICKER_WIDTH,
                backgroundColor: COLORS.surfaceAlt,
                borderRadius: 12,
                marginBottom: 6,
                elevation: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
              }}
            >
              <Picker
                selectedValue={this.state.selectedShot}
                style={{ color: COLORS.textPrimary }}
                onValueChange={(itemValue) => {
                  this.selectionChange(Number(itemValue));
                }}
              >
                {this.state.shots.map((shot, index) => (
                  <Picker.Item label={shot.distance + ' – ' + shot.name} value={index} key={shot.id} />
                ))}
              </Picker>
            </View>
          )}
          {/* Draggable handle / toggle button — panHandlers scoped here only so
              the Picker overlay above receives its own native touch events on iOS/Web */}
          <View
            ref={this.pickerButtonRef}
            style={{
              backgroundColor: this.state.pickerVisible ? COLORS.primary : COLORS.primaryLight,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 9,
              elevation: 5,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              minWidth: 80,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
            {...this.panResponder.panHandlers}
          >
            <MaterialCommunityIcons name="drag" size={18} color="rgba(255,255,255,0.7)" />
            <Text style={{ color: COLORS.textLight, fontWeight: '700', fontSize: 12, flexShrink: 1 }}>
              {this.state.shots[this.state.selectedShot]
                ? this.state.shots[this.state.selectedShot].distance + ' – ' + this.state.shots[this.state.selectedShot].name
                : 'Select Shot'}
            </Text>
          </View>
        </Animated.View>

        {/* Shot confirmation modal */}
        <Modal
          visible={this.state.modalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => this.setState({ modalVisible: false })}
        >
          <View style={[styles.modalContainer, recordStyles.backdrop]}>
            <View style={styles.modalContent}>
            <Text style={recordStyles.modalTitle}>Confirm Shot</Text>
            <View style={recordStyles.modalStats}>
              <View style={recordStyles.modalStatCell}>
                <Text style={recordStyles.modalStatLabel}>Distance</Text>
                <Text style={recordStyles.modalStatValue}>{this.state.shotDistance} yds</Text>
              </View>
              <View style={recordStyles.modalDivider} />
              <View style={recordStyles.modalStatCell}>
                <Text style={recordStyles.modalStatLabel}>Accuracy</Text>
                <Text style={recordStyles.modalStatValue}>
                  {this.convertShotAccuracy(this.state.shotAccuracy)}
                </Text>
              </View>
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.buttonDanger}
                onPress={() => this.setState({ modalVisible: false })}
              >
                <Text style={styles.buttonLabelLight}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.buttonSuccess}
                onPress={async () => {
                  const user = this.props.route.params?.user ?? '';
                  const sessionId = (await SessionService.getActiveSessionId(user)) ?? undefined;
                  DB.saveDataPoint(user, {
                    id: this.state.shotId,
                    shotX: Number(this.state.shotX),
                    shotY: Number(this.state.shotY),
                    relX: this.state.relX,
                    relY: this.state.relY,
                    clickedFrom: this.state.clickedFrom,
                    screenHeight: this.state.screenHeight,
                    screenWidth: this.state.screenWidth,
                    offTarget: this.state.offTarget,
                    sessionId,
                  });
                  this.setState({ modalVisible: false });
                }}
              >
                <EmojiText style={styles.buttonLabelLight}>Save ✓</EmojiText>
              </TouchableOpacity>
            </View>
          </View>
          </View>
        </Modal>
      </View>
    );
  }
}

const recordStyles = StyleSheet.create({
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
  },
  shotInfoText: {
    fontWeight: '700',
    fontSize: 15,
    color: COLORS.textLight,
  },
  shotDistanceText: {
    fontWeight: '600',
    fontSize: 13,
    color: COLORS.accentLight,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  modalStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  modalStatCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalDivider: {
    width: 1,
    height: 50,
    backgroundColor: COLORS.border,
  },
  modalStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modalStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  infoModalContent: {
    alignItems: 'flex-start',
    padding: 20,
  },
  infoModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  infoModalBody: {
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  infoModalClose: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },

  // ── Modal backdrop ───────────────────────────────────────────
  backdrop: {
    backgroundColor: COLORS.overlay,
  },

  // ── Dispersion overlay toggle button ─────────────────────────
  overlayBtn: {
    position: 'absolute',
    right: 12,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  overlayBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  overlayBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  overlayBtnTextActive: {
    color: COLORS.textPrimary,
  },

  // ── PiTrac live indicator ─────────────────────────────────────
  piTracBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45,122,79,0.25)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
  },
  piTracBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.success,
  },
  piTracBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accentLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
