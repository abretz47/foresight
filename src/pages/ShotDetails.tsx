import React, { Component } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles, COLORS } from '../styles/styles';
import { ShotDetailsNavigationProp, ShotDetailsRouteProp } from '../types/navigation';
import * as DB from '../data/db';
import { DataPoint, ShotProfile } from '../data/db';
import { computeDispersionHull, filterByDateRange } from '../lib/dispersion';
import DispersionPolygon from '../components/DispersionPolygon';
import TimeRangeSlider from '../components/TimeRangeSlider';
import type { Point } from '../lib/dispersion';

interface Props {
  navigation: ShotDetailsNavigationProp;
  route: ShotDetailsRouteProp;
}

interface State {
  allShots: DataPoint[];
  filteredShots: DataPoint[];
  hull: Point[];
  clubProfile: ShotProfile | null;
  startDate: Date | null;
  endDate: Date | null;
  containerWidth: number;
  showShots: boolean;
  infoVisible: boolean;
}

const POLYGON_SIZE = 260;

export default class ShotDetails extends Component<Props, State> {
  private focusListener: (() => void) | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      allShots: [],
      filteredShots: [],
      hull: [],
      clubProfile: null,
      startDate: null,
      endDate: null,
      containerWidth: 0,
      showShots: false,
      infoVisible: false,
    };
  }

  componentDidMount() {
    this.focusListener = this.props.navigation.addListener('focus', () => {
      this.loadData();
    });
  }

  componentWillUnmount() {
    if (this.focusListener) this.focusListener();
  }

  private loadData = async () => {
    const { clubId, user } = this.props.route.params;
    const [allShots, clubs] = await Promise.all([
      DB.getShotDataAsync(clubId),
      DB.getShotProfileAsync(user),
    ]);
    const clubProfile = clubs.find((c) => c.id === clubId) ?? null;
    this.setState({ allShots, clubProfile }, this.applyFilter);
  };

  private applyFilter = () => {
    const { allShots, startDate, endDate } = this.state;
    const filteredShots = filterByDateRange(allShots, startDate, endDate);
    const hull = computeDispersionHull(filteredShots);
    this.setState({ filteredShots, hull });
  };

  /** Returns the [min, max] Date of all shots that have a timestamp, or null. */
  private getDateBounds(): { min: Date; max: Date } | null {
    const { allShots } = this.state;
    const ts = allShots
      .filter((d) => !!d.timestamp)
      .map((d) => new Date(d.timestamp!).getTime());
    if (ts.length < 2) return null;
    const min = new Date(Math.min(...ts));
    const max = new Date(Math.max(...ts));
    if (min.getTime() === max.getTime()) return null;
    return { min, max };
  }

  private handleRangeChange = (start: Date, end: Date) => {
    const bounds = this.getDateBounds();
    if (!bounds) return;

    // When handles are at the absolute extremes, remove the filter entirely
    // so that shots without timestamps are still included.
    const atMin = start.getTime() <= bounds.min.getTime();
    const atMax = end.getTime() >= bounds.max.getTime();

    const startDate: Date | null = atMin ? null : start;
    let endDate: Date | null = null;
    if (!atMax) {
      endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
    }

    this.setState({ startDate, endDate }, this.applyFilter);
  };

  private handleResetDates = () => {
    this.setState({ startDate: null, endDate: null }, this.applyFilter);
  };

  private handleRecord = () => {
    const { user, clubId } = this.props.route.params;
    const { clubProfile } = this.state;
    if (!clubProfile) return;
    this.props.navigation.navigate('Record', {
      user,
      id: clubId,
      shotName: clubProfile.name,
      targetDistance: clubProfile.distance,
      targetRadius: clubProfile.targetRadius,
      missRadius: clubProfile.missRadius,
      calledFrom: 'Record',
    });
  };

  private handleEditProfile = () => {
    const { user, clubId } = this.props.route.params;
    this.props.navigation.navigate('ShotProfile', { user, selectedClubId: clubId });
  };

  render() {
    const { clubName } = this.props.route.params;
    const {
      filteredShots,
      allShots,
      hull,
      clubProfile,
      showShots,
      infoVisible,
    } = this.state;

    const inPlayCount = filteredShots.filter((d) => d.offTarget === false).length;
    const totalCount = filteredShots.length;
    const isFiltered = !!(this.state.startDate || this.state.endDate);

    // Actual in-play percentage for the title
    const inPlayPct = totalCount > 0 ? inPlayCount / totalCount : -1;
    const inPlayPctLabel =
      inPlayPct >= 0 ? `${Math.round(inPlayPct * 100)}%` : '--';

    // Dispersion color based on in-play percentage
    let dispersionFill: string;
    let dispersionStroke: string;
    if (inPlayPct < 0) {
      dispersionFill = 'rgba(45,106,72,0.28)';
      dispersionStroke = '#2D6A48';
    } else if (inPlayPct >= 0.7) {
      dispersionFill = 'rgba(45,122,79,0.30)';
      dispersionStroke = '#2D7A4F';
    } else if (inPlayPct >= 0.5) {
      dispersionFill = 'rgba(212,160,23,0.28)';
      dispersionStroke = '#C68A00';
    } else {
      dispersionFill = 'rgba(217,79,61,0.28)';
      dispersionStroke = '#D94F3D';
    }

    // Individual shot dots (in-play only, only when toggled on)
    const shotDots = showShots
      ? filteredShots
          .filter((d): d is DataPoint & { relX: number; relY: number } =>
            d.offTarget === false && typeof d.relX === 'number' && typeof d.relY === 'number'
          )
          .map((d) => ({ x: d.relX, y: d.relY }))
      : undefined;

    const targetRadiusNorm =
      clubProfile && Number(clubProfile.missRadius) > 0
        ? Number(clubProfile.targetRadius) / Number(clubProfile.missRadius)
        : undefined;
    const targetDistanceYds = clubProfile ? Number(clubProfile.distance) : undefined;
    const missRadiusYds = clubProfile ? Number(clubProfile.missRadius) : undefined;
    const targetRadiusYds = clubProfile ? Number(clubProfile.targetRadius) : undefined;

    const dateBounds = this.getDateBounds();

    return (
      <View style={styles.template}>
        {/* ── Info modal ───────────────────────────────────────── */}
        <Modal
          visible={infoVisible}
          transparent
          animationType="fade"
          onRequestClose={() => this.setState({ infoVisible: false })}
        >
          <TouchableOpacity
            style={sdStyles.modalOverlay}
            activeOpacity={1}
            onPress={() => this.setState({ infoVisible: false })}
          >
            <View style={sdStyles.infoBox}>
              <Text style={sdStyles.infoTitle}>How is this calculated?</Text>
              <Text style={sdStyles.infoBody}>
                The dispersion polygon shows where 80% of your in-play shots land.
                {'\n\n'}
                All shots that land within the miss circle are considered "in-play".
                The closest 80% of those in-play shots to the target center are
                selected, and a convex hull is drawn around them. This filters out
                outliers and gives you a realistic picture of your typical shot
                dispersion.
              </Text>
              <TouchableOpacity
                style={sdStyles.infoDismissBtn}
                onPress={() => this.setState({ infoVisible: false })}
              >
                <Text style={sdStyles.infoDismissBtnText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <ScrollView
          style={sdStyles.scroll}
          contentContainerStyle={sdStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Club header */}
          <View style={sdStyles.header}>
            <Text style={sdStyles.clubName}>{clubName} - {targetDistanceYds}</Text>
            <Text style={sdStyles.statLine}>
              {isFiltered
                ? `${totalCount} shots in range · ${inPlayCount} in-play`
                : `${allShots.length} shots total · ${inPlayCount} in-play`}
            </Text>
          </View>

          {/* Quick-action buttons */}
          <View style={sdStyles.actionRow}>
            <TouchableOpacity
              style={[sdStyles.actionBtn, !clubProfile && sdStyles.actionBtnDisabled]}
              onPress={this.handleRecord}
              disabled={!clubProfile}
            >
              <Text style={sdStyles.actionBtnText}>📍 Record Shots</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={sdStyles.actionBtnSecondary}
              onPress={this.handleEditProfile}
            >
              <Text style={sdStyles.actionBtnSecondaryText}>✏️ Edit Shot</Text>
            </TouchableOpacity>
          </View>

          {/* Dispersion polygon */}
          <View style={sdStyles.polygonCard}>
            <View style={sdStyles.sectionTitleRow}>
              <Text style={sdStyles.sectionTitle}>
                Shot Dispersion ({inPlayPctLabel} in-play)
              </Text>
              {/* Info icon */}
              <TouchableOpacity
                style={sdStyles.infoIconBtn}
                onPress={() => this.setState({ infoVisible: true })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={18}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
              {/* Show shots toggle */}
              <TouchableOpacity
                style={[sdStyles.shotsToggleBtn, showShots && sdStyles.shotsToggleBtnActive]}
                onPress={() => this.setState((s) => ({ showShots: !s.showShots }))}
              >
                <Text style={[sdStyles.shotsToggleBtnText, showShots && sdStyles.shotsToggleBtnTextActive]}>
                  {showShots ? 'Hide Shots' : 'Show Shots'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={sdStyles.polygonContainer}>
              <DispersionPolygon
                hull={hull}
                width={POLYGON_SIZE}
                height={POLYGON_SIZE}
                showCircles
                showLabels
                targetRadiusNorm={targetRadiusNorm}
                targetDistanceYds={targetDistanceYds}
                missRadiusYds={missRadiusYds}
                targetRadiusYds={targetRadiusYds}
                fillColor={dispersionFill}
                strokeColor={dispersionStroke}
                shots={shotDots}
              />
              {hull.length === 0 && (
                <View style={[sdStyles.emptyOverlay, { width: POLYGON_SIZE, height: POLYGON_SIZE }]}>
                  <Text style={sdStyles.emptyText}>
                    {inPlayCount === 0 ? 'No in-play shots yet' : 'Not enough data'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Date range slider */}
          {dateBounds && (
            <View style={sdStyles.filterCard}>
              <View style={sdStyles.filterTitleRow}>
                <Text style={[sdStyles.sectionTitle, sdStyles.filterTitle]}>Date Range</Text>
                {isFiltered && (
                  <TouchableOpacity
                    style={sdStyles.resetBtn}
                    onPress={this.handleResetDates}
                  >
                    <Text style={sdStyles.resetBtnText}>Reset</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TimeRangeSlider
                minDate={dateBounds.min}
                maxDate={dateBounds.max}
                startDate={this.state.startDate ?? dateBounds.min}
                endDate={this.state.endDate ?? dateBounds.max}
                onRangeChange={this.handleRangeChange}
              />
            </View>
          )}
        </ScrollView>
      </View>
    );
  }
}

const sdStyles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 12,
  },
  clubName: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textLight,
    marginBottom: 4,
  },
  statLine: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.4,
  },
  actionBtnText: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 13,
  },
  actionBtnSecondary: {
    flex: 1,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtnSecondaryText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  polygonCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    alignItems: 'center',
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 5,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  shotsToggleBtn: {
    marginLeft: 'auto',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shotsToggleBtnActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryLight,
  },
  shotsToggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  shotsToggleBtnTextActive: {
    color: COLORS.textLight,
  },
  polygonContainer: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  emptyText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  filterCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 5,
  },
  filterTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  filterTitle: {
    flex: 1,
  },
  resetBtn: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resetBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  // ── Info modal ──────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  infoIconBtn: {
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,46,30,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  infoBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 22,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  infoBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
    marginBottom: 18,
  },
  infoDismissBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  infoDismissBtnText: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 14,
  },
});

