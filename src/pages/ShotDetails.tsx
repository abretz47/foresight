import React, { Component } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { styles, COLORS } from '../styles/styles';
import { ShotDetailsNavigationProp, ShotDetailsRouteProp } from '../types/navigation';
import * as DB from '../data/db';
import { DataPoint } from '../data/db';
import * as SessionService from '../lib/sessionService';
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
  startDateText: string;
  endDateText: string;
  startDate: Date | null;
  endDate: Date | null;
  dateError: string;
  activeSessionId: string | null;
  sessionLoading: boolean;
  containerWidth: number;
}

const POLYGON_SIZE = 220;

export default class ShotDetails extends Component<Props, State> {
  private focusListener: (() => void) | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      allShots: [],
      filteredShots: [],
      hull: [],
      startDateText: '',
      endDateText: '',
      startDate: null,
      endDate: null,
      dateError: '',
      activeSessionId: null,
      sessionLoading: false,
      containerWidth: 0,
    };
  }

  componentDidMount() {
    this.focusListener = this.props.navigation.addListener('focus', () => {
      this.loadData();
      this.loadSession();
    });
  }

  componentWillUnmount() {
    if (this.focusListener) this.focusListener();
  }

  private loadData = async () => {
    const { clubId } = this.props.route.params;
    const allShots = await DB.getShotDataAsync(clubId);
    this.setState({ allShots }, this.applyFilter);
  };

  private loadSession = async () => {
    const { user } = this.props.route.params;
    const activeSessionId = await SessionService.getActiveSessionId(user);
    this.setState({ activeSessionId });
  };

  private applyFilter = () => {
    const { allShots, startDate, endDate } = this.state;
    const filteredShots = filterByDateRange(allShots, startDate, endDate);
    const hull = computeDispersionHull(filteredShots);
    this.setState({ filteredShots, hull });
  };

  private parseDate(text: string): Date | null {
    if (!text.trim()) return null;
    // Parse YYYY-MM-DD explicitly to avoid timezone ambiguity
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

    // Set endDate to end of day
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

  private handleStartContinueSession = async () => {
    const { user } = this.props.route.params;
    this.setState({ sessionLoading: true });
    try {
      const sessionId = await SessionService.continueOrStartSession(user);
      this.setState({ activeSessionId: sessionId });
      Alert.alert(
        'Session Active',
        'All shots you record will now be tagged to this practice session.',
        [{ text: 'OK' }]
      );
    } finally {
      this.setState({ sessionLoading: false });
    }
  };

  private handleStopSession = async () => {
    const { user } = this.props.route.params;
    await SessionService.stopSession(user);
    this.setState({ activeSessionId: null });
  };

  render() {
    const { clubName } = this.props.route.params;
    const {
      filteredShots,
      allShots,
      hull,
      startDateText,
      endDateText,
      dateError,
      activeSessionId,
      sessionLoading,
    } = this.state;

    const inPlayCount = filteredShots.filter((d) => d.offTarget === false).length;
    const totalCount = filteredShots.length;
    const isFiltered = !!(this.state.startDate || this.state.endDate);

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

          {/* Dispersion polygon */}
          <View style={sdStyles.polygonCard}>
            <Text style={sdStyles.sectionTitle}>Shot Dispersion (80% in-play)</Text>
            <View style={sdStyles.polygonContainer}>
              {hull.length > 0 ? (
                <DispersionPolygon hull={hull} width={POLYGON_SIZE} height={POLYGON_SIZE} />
              ) : (
                <View style={[sdStyles.emptyPolygon, { width: POLYGON_SIZE, height: POLYGON_SIZE }]}>
                  <Text style={sdStyles.emptyText}>
                    {inPlayCount === 0 ? 'No in-play shots yet' : 'Not enough data'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Date range filter */}
          <View style={sdStyles.filterCard}>
            <Text style={sdStyles.sectionTitle}>Filter by Date</Text>
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

          {/* Practice session */}
          <View style={sdStyles.sessionCard}>
            <Text style={sdStyles.sectionTitle}>Practice Session</Text>
            {activeSessionId ? (
              <>
                <Text style={sdStyles.sessionStatus}>
                  ✅ Session active — new shots will be tagged
                </Text>
                <TouchableOpacity style={sdStyles.sessionBtnSecondary} onPress={this.handleStopSession}>
                  <Text style={sdStyles.sessionBtnSecondaryText}>Stop Session</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={sdStyles.sessionStatus}>No active session</Text>
                <TouchableOpacity
                  style={[sdStyles.sessionBtn, sessionLoading && sdStyles.sessionBtnDisabled]}
                  onPress={this.handleStartContinueSession}
                  disabled={sessionLoading}
                >
                  <Text style={sdStyles.sessionBtnText}>
                    {sessionLoading ? 'Starting…' : 'Start / Continue Session'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
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
    marginBottom: 16,
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
  polygonContainer: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPolygon: {
    borderRadius: 110,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 12,
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
  sessionCard: {
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
  sessionStatus: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
    fontWeight: '500',
  },
  sessionBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sessionBtnDisabled: {
    opacity: 0.5,
  },
  sessionBtnText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  sessionBtnSecondary: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sessionBtnSecondaryText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
});
