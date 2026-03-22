import React, { Component } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import { styles, COLORS } from '../styles/styles';
import { ShotDetailsNavigationProp, ShotDetailsRouteProp } from '../types/navigation';
import * as DB from '../data/db';
import { DataPoint, ShotProfile } from '../data/db';
import { computeDispersionHull, filterByDateRange } from '../lib/dispersion';
import DispersionPolygon from '../components/DispersionPolygon';
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
  startDateText: string;
  endDateText: string;
  startDate: Date | null;
  endDate: Date | null;
  dateError: string;
  containerWidth: number;
  showShots: boolean;
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
      startDateText: '',
      endDateText: '',
      startDate: null,
      endDate: null,
      dateError: '',
      containerWidth: 0,
      showShots: false,
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

  private parseDate(text: string): Date | null {
    if (!text.trim()) return null;
    const parts = text.trim().split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    const d = new Date(year, month, day);
    if (isNaN(d.getTime())) return null;
    return d;
  }

  private handleApplyDates = () => {
    const { startDateText, endDateText } = this.state;
    const startDate = this.parseDate(startDateText);
    const endDate = this.parseDate(endDateText);

    if (startDateText.trim() && !startDate) {
      this.setState({ dateError: 'Invalid start date. Use YYYY-MM-DD.' });
      return;
    }
    if (endDateText.trim() && !endDate) {
      this.setState({ dateError: 'Invalid end date. Use YYYY-MM-DD.' });
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      this.setState({ dateError: 'Start date must be before end date.' });
      return;
    }

    let adjustedEnd = endDate;
    if (adjustedEnd) {
      adjustedEnd = new Date(adjustedEnd);
      adjustedEnd.setHours(23, 59, 59, 999);
    }

    this.setState({ startDate, endDate: adjustedEnd, dateError: '' }, this.applyFilter);
  };

  private handleClearDates = () => {
    this.setState(
      { startDateText: '', endDateText: '', startDate: null, endDate: null, dateError: '' },
      this.applyFilter
    );
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
      startDateText,
      endDateText,
      dateError,
      showShots,
    } = this.state;

    const inPlayCount = filteredShots.filter((d) => d.offTarget === false).length;
    const totalCount = filteredShots.length;
    const isFiltered = !!(this.state.startDate || this.state.endDate);

    // Dispersion color based on in-play percentage
    const inPlayPct = totalCount > 0 ? inPlayCount / totalCount : -1;
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

    return (
      <View style={styles.template}>
        <ScrollView
          style={sdStyles.scroll}
          contentContainerStyle={sdStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Club header */}
          <View style={sdStyles.header}>
            <Text style={sdStyles.clubName}>{clubName}</Text>
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
              <Text style={sdStyles.actionBtnSecondaryText}>✏️ Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Dispersion polygon */}
          <View style={sdStyles.polygonCard}>
            <View style={sdStyles.sectionTitleRow}>
              <Text style={sdStyles.sectionTitle}>Shot Dispersion (80% in-play)</Text>
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

          {/* Date range filter */}
          <View style={sdStyles.filterCard}>
            <Text style={[sdStyles.sectionTitle, { marginBottom: 12 }]}>Filter by Date</Text>
            <View style={sdStyles.dateRow}>
              <View style={sdStyles.dateField}>
                <Text style={sdStyles.dateLabel}>From</Text>
                <TextInput
                  style={sdStyles.dateInput}
                  value={startDateText}
                  onChangeText={(t) => this.setState({ startDateText: t, dateError: '' })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                  autoCorrect={false}
                />
              </View>
              <View style={sdStyles.dateField}>
                <Text style={sdStyles.dateLabel}>To</Text>
                <TextInput
                  style={sdStyles.dateInput}
                  value={endDateText}
                  onChangeText={(t) => this.setState({ endDateText: t, dateError: '' })}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={COLORS.textMuted}
                  keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
                  autoCorrect={false}
                />
              </View>
            </View>
            {!!dateError && <Text style={sdStyles.errorText}>{dateError}</Text>}
            <View style={sdStyles.filterBtnRow}>
              <TouchableOpacity style={sdStyles.applyBtn} onPress={this.handleApplyDates}>
                <Text style={sdStyles.applyBtnText}>Apply</Text>
              </TouchableOpacity>
              {isFiltered && (
                <TouchableOpacity style={sdStyles.clearBtn} onPress={this.handleClearDates}>
                  <Text style={sdStyles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  dateField: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  dateInput: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.danger,
    marginBottom: 8,
    fontWeight: '500',
  },
  filterBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  applyBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  applyBtnText: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 13,
  },
  clearBtn: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clearBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
});

