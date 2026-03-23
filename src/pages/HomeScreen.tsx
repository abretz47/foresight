import React, { Component } from 'react';
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Animated,
  Modal,
  FlatList,
  ListRenderItemInfo,
} from 'react-native';
import { styles, COLORS } from '../styles/styles';
import { HomeNavigationProp, HomeRouteProp } from '../types/navigation';
import * as DB from '../data/db';
import { ShotProfile, DataPoint } from '../data/db';
import * as PiTracService from '../lib/piTracService';
import { PITRAC_ENABLED } from '../lib/featureFlags';
import EmojiText from '../components/EmojiText';
import DispersionPolygon from '../components/DispersionPolygon';
import { computeDispersionHull } from '../lib/dispersion';
import type { Point } from '../lib/dispersion';

interface Props {
  navigation: HomeNavigationProp;
  route: HomeRouteProp;
}

interface ClubCardData {
  club: ShotProfile;
  hull: Point[];
  inPlayPct: number;   // 0..1, or -1 when no shots recorded
  totalShots: number;
}

interface State {
  piTracProbing: boolean;
  piTracDetected: boolean;
  piTracConnected: boolean;
  piTracUrl: string;
  urlModalVisible: boolean;
  urlDraft: string;
  menuVisible: boolean;
  clubCards: ClubCardData[];
  loading: boolean;
}

const CARD_POLYGON_SIZE = 130;

/** Returns fill/stroke colors for the dispersion polygon based on in-play percentage.
 *  inPlayPct == -1 means no shots recorded → use default neutral color. */
function dispersionColor(inPlayPct: number): { fill: string; stroke: string } {
  if (inPlayPct < 0) return { fill: 'rgba(45,106,72,0.28)', stroke: COLORS.primaryLight };
  if (inPlayPct >= 0.7) return { fill: 'rgba(45,122,79,0.30)', stroke: '#2D7A4F' };
  if (inPlayPct >= 0.5) return { fill: 'rgba(212,160,23,0.28)', stroke: '#C68A00' };
  return { fill: 'rgba(217,79,61,0.28)', stroke: '#D94F3D' };
}

export default class HomeScreen extends Component<Props, State> {
  private piTracPulse = new Animated.Value(1);
  private unsubConnection: (() => void) | null = null;
  private pulseAnim: Animated.CompositeAnimation | null = null;
  private focusListener: (() => void) | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      piTracProbing: false,
      piTracDetected: false,
      piTracConnected: PiTracService.isConnected(),
      piTracUrl: PiTracService.getUrl() ?? PiTracService.buildWsUrl('pitrac.local'),
      urlModalVisible: false,
      urlDraft: '',
      menuVisible: false,
      clubCards: [],
      loading: true,
    };
  }

  componentDidMount() {
    const user = this.props.route.params?.user ?? 'local_user';
    DB.initializeDefaultProfiles(user);

    this.focusListener = this.props.navigation.addListener('focus', () => {
      this.loadClubCards();
    });

    this.checkFistSetup(user);

    if (PITRAC_ENABLED) {
      this.unsubConnection = PiTracService.addConnectionListener((connected) => {
        this.setState({ piTracConnected: connected });
        if (connected) {
          this.startPulse();
        } else {
          this.stopPulse();
        }
      });

      if (PiTracService.isConnected()) {
        this.setState({ piTracDetected: true });
        this.startPulse();
      }

      this.probePiTrac();
    }

    this.loadClubCards();
  }

  componentWillUnmount() {
    if (this.unsubConnection) this.unsubConnection();
    if (this.focusListener) this.focusListener();
    this.stopPulse();
  }

  // ── Fist-setup redirect ──────────────────────────────────────────────────

  /** Redirect to UserSetup (fist-only mode) when the user has a shot profile
   *  but hasn't entered arm/hand measurements yet. */
  private checkFistSetup = async (user: string) => {
    const profile = await DB.getUserProfile(user);
    if (!profile || (profile.handWidth && profile.armLength)) return;
    const clubs = await DB.getShotProfileAsync(user);
    if (clubs.length > 0) {
      this.props.navigation.navigate('UserSetup', { user, fistOnly: true });
    }
  };

  // ── Club cards ──────────────────────────────────────────────────────────

  private loadClubCards = async () => {
    const user = this.props.route.params?.user ?? 'local_user';
    this.setState({ loading: true });
    try {
      const clubs = await DB.getShotProfileAsync(user);

      const cards: ClubCardData[] = await Promise.all(
        clubs.map(async (club) => {
          const shots: DataPoint[] = await DB.getShotDataAsync(club.id);
          const hull = computeDispersionHull(shots);
          const totalShots = shots.length;
          const inPlayCount = shots.filter((s) => s.offTarget === false).length;
          const inPlayPct = totalShots > 0 ? inPlayCount / totalShots : -1;
          return { club, hull, inPlayPct, totalShots };
        })
      );

      this.setState({ clubCards: cards, loading: false });
    } catch {
      this.setState({ loading: false });
    }
  };

  // ── PiTrac helpers ─────────────────────────────────────────────────────

  private startPulse() {
    this.stopPulse();
    this.pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(this.piTracPulse, {
          toValue: 0.2,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(this.piTracPulse, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    this.pulseAnim.start();
  }

  private stopPulse() {
    if (this.pulseAnim) {
      this.pulseAnim.stop();
      this.pulseAnim = null;
    }
    this.piTracPulse.setValue(1);
  }

  private async probePiTrac() {
    if (PiTracService.isConnected()) return;

    this.setState({ piTracProbing: true });

    const stored = await PiTracService.getStoredUrl();
    if (stored) {
      try {
        const parsed = new URL(stored);
        const host = parsed.hostname;
        const port = parseInt(parsed.port || '8080', 10);
        const found = await PiTracService.probe(host, port);
        if (found) {
          this.setState({ piTracDetected: true, piTracProbing: false, piTracUrl: stored });
          return;
        }
      } catch (e) {
        console.warn('[PiTrac] Could not parse stored URL:', e);
      }
    }

    const found = await PiTracService.probe('pitrac.local');
    if (found) {
      const url = PiTracService.buildWsUrl('pitrac.local');
      await PiTracService.setStoredUrl(url);
      this.setState({ piTracDetected: true, piTracProbing: false, piTracUrl: url });
      return;
    }

    this.setState({ piTracProbing: false });
  }

  private handleConnectPiTrac = () => {
    const { piTracUrl } = this.state;
    PiTracService.connect(piTracUrl);
    PiTracService.setStoredUrl(piTracUrl);
  };

  private handleDisconnectPiTrac = () => {
    PiTracService.disconnect();
  };

  private openUrlModal = () => {
    this.setState({ urlModalVisible: true, urlDraft: this.state.piTracUrl });
  };

  private saveUrl = () => {
    const url = this.state.urlDraft.trim();
    if (!url) {
      Alert.alert('URL Required', 'Please enter a valid WebSocket URL, e.g. ws://pitrac.local:8080/ws');
      return;
    }
    PiTracService.setStoredUrl(url);
    this.setState({ piTracUrl: url, urlModalVisible: false, piTracDetected: true });
  };

  // ── Record navigation ──────────────────────────────────────────────────

  navigateToRecord = (calledFrom: 'Record' | 'Analyze') => {
    const user = this.props.route.params?.user ?? 'local_user';
    const { navigate } = this.props.navigation;
    let navigated = false;
    const promise = DB.getShotProfile(user, (shots) => {
      navigated = true;
      const firstShot = shots[0];
      navigate(calledFrom, {
        user,
        id: firstShot.id,
        shotName: firstShot.name,
        targetDistance: firstShot.distance,
        targetRadius: firstShot.targetRadius,
        missRadius: firstShot.missRadius,
        calledFrom,
      });
    });
    void promise.then(() => {
      if (!navigated) {
        Alert.alert(
          'No Shot Profiles Found',
          'Please create at least one shot profile before recording or analyzing data.',
          [
            { text: 'Go to Shot Profile', onPress: () => navigate('ShotProfile', { user }) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    });
  };

  // ── Render helpers ─────────────────────────────────────────────────────

  private renderClubCard = ({ item }: ListRenderItemInfo<ClubCardData>) => {
    const { navigate } = this.props.navigation;
    const user = this.props.route.params?.user ?? 'local_user';
    const { club, hull, inPlayPct } = item;

    const missR = Number(club.missRadius);
    const targR = Number(club.targetRadius);
    const targetRadiusNorm =
      missR > 0 ? targR / missR : undefined;

    const { fill, stroke } = dispersionColor(inPlayPct);

    return (
      <TouchableOpacity
        style={homeStyles.clubCard}
        onPress={() => navigate('ShotDetails', { user, clubId: club.id, clubName: club.name })}
        activeOpacity={0.82}
      >
        <View style={homeStyles.clubCardPolygon}>
          <DispersionPolygon
            hull={hull}
            width={CARD_POLYGON_SIZE}
            height={CARD_POLYGON_SIZE}
            showCircles
            targetRadiusNorm={targetRadiusNorm}
            fillColor={fill}
            strokeColor={stroke}
            showInnerLabels
            missRadiusYds={missR > 0 ? missR : undefined}
            targetRadiusYds={targR > 0 ? targR : undefined}
          />
        </View>
        <Text style={homeStyles.clubCardName} numberOfLines={1}>{club.name}</Text>
        <Text style={homeStyles.clubCardDist}>{club.distance} </Text>
      </TouchableOpacity>
    );
  };

  render() {
    const { navigate } = this.props.navigation;
    const user = this.props.route.params?.user ?? 'local_user';
    const {
      piTracProbing,
      piTracDetected,
      piTracConnected,
      piTracUrl,
      urlModalVisible,
      urlDraft,
      menuVisible,
      clubCards,
      loading,
    } = this.state;

    return (
      <View style={styles.template}>
        {/* Header with hamburger */}
        <View style={homeStyles.header}>
          <View style={homeStyles.headerLeft}>
            <EmojiText style={homeStyles.greeting}>Hello, {user} 👋</EmojiText>
            <Text style={homeStyles.headerSub}>Tap a club to review its dispersion</Text>
          </View>
          <TouchableOpacity
            style={homeStyles.hamburgerBtn}
            onPress={() => this.setState({ menuVisible: true })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={homeStyles.hamburgerIcon}>☰</Text>
          </TouchableOpacity>
        </View>

        {/* Club cards list — 2-column grid */}
        <FlatList
          data={clubCards}
          keyExtractor={(item) => item.club.id}
          renderItem={this.renderClubCard}
          numColumns={2}
          columnWrapperStyle={homeStyles.columnWrapper}
          contentContainerStyle={homeStyles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={homeStyles.emptyState}>
              <EmojiText style={homeStyles.emptyIcon}>🏌️</EmojiText>
              <Text style={homeStyles.emptyText}>
                {loading
                  ? 'Loading clubs…'
                  : 'No clubs yet.\nSet up your Shot Profile to get started.'}
              </Text>
              {!loading && (
                <TouchableOpacity
                  style={homeStyles.emptyBtn}
                  onPress={() => navigate('ShotProfile', { user })}
                >
                  <Text style={homeStyles.emptyBtnText}>Go to Shot Profile</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={
            PITRAC_ENABLED ? (
              <View style={homeStyles.piTracCard}>
                <View style={homeStyles.piTracHeader}>
                  <EmojiText style={homeStyles.piTracIcon}>📡</EmojiText>
                  <View style={homeStyles.piTracTitleRow}>
                    <Text style={homeStyles.piTracTitle}>PiTrac</Text>
                    {piTracConnected && (
                      <Animated.View
                        style={[homeStyles.piTracDot, { opacity: this.piTracPulse }]}
                      />
                    )}
                  </View>
                </View>
                {piTracConnected ? (
                  <View style={homeStyles.piTracActions}>
                    <Text style={homeStyles.piTracStatus}>Connected – shots will be logged automatically</Text>
                    <TouchableOpacity
                      style={homeStyles.piTracBtnSecondary}
                      onPress={this.handleDisconnectPiTrac}
                    >
                      <Text style={homeStyles.piTracBtnTextSecondary}>Disconnect</Text>
                    </TouchableOpacity>
                  </View>
                ) : piTracProbing ? (
                  <Text style={homeStyles.piTracStatus}>Searching for PiTrac on the network…</Text>
                ) : piTracDetected ? (
                  <View style={homeStyles.piTracActions}>
                    <Text style={homeStyles.piTracStatus} numberOfLines={1}>{piTracUrl}</Text>
                    <View style={homeStyles.piTracBtnRow}>
                      <TouchableOpacity style={homeStyles.piTracBtn} onPress={this.handleConnectPiTrac}>
                        <Text style={homeStyles.piTracBtnText}>Connect</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={homeStyles.piTracBtnSecondary} onPress={this.openUrlModal}>
                        <Text style={homeStyles.piTracBtnTextSecondary}>Change URL</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={homeStyles.piTracActions}>
                    <Text style={homeStyles.piTracStatus}>No PiTrac detected</Text>
                    <View style={homeStyles.piTracBtnRow}>
                      <TouchableOpacity
                        style={homeStyles.piTracBtnSecondary}
                        onPress={() => this.probePiTrac()}
                      >
                        <Text style={homeStyles.piTracBtnTextSecondary}>Scan</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={homeStyles.piTracBtnSecondary} onPress={this.openUrlModal}>
                        <Text style={homeStyles.piTracBtnTextSecondary}>Enter URL</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            ) : null
          }
        />

        {/* Logout bar is now inside the hamburger menu */}

        {/* Hamburger menu modal */}
        <Modal
          visible={menuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => this.setState({ menuVisible: false })}
        >
          <TouchableOpacity
            style={homeStyles.menuOverlay}
            activeOpacity={1}
            onPress={() => this.setState({ menuVisible: false })}
          >
            <View style={homeStyles.menuBox}>
              <Text style={homeStyles.menuTitle}>Menu</Text>
              {[
                {
                  icon: '🏌️',
                  label: 'Shot Profile',
                  onPress: () => {
                    this.setState({ menuVisible: false });
                    navigate('ShotProfile', { user });
                  },
                },
                {
                  icon: '📍',
                  label: 'Record Data',
                  onPress: () => {
                    this.setState({ menuVisible: false });
                    this.navigateToRecord('Record');
                  },
                },
                {
                  icon: '📊',
                  label: 'Analyze Data',
                  onPress: () => {
                    this.setState({ menuVisible: false });
                    this.navigateToRecord('Analyze');
                  },
                },
                {
                  icon: '❓',
                  label: 'How To Use',
                  onPress: () => {
                    this.setState({ menuVisible: false });
                    navigate('HowToUse');
                  },
                },
                {
                  icon: '🚪',
                  label: 'Log Out',
                  onPress: () => {
                    this.setState({ menuVisible: false });
                    navigate('Login');
                  },
                },
              ].map((item) => (
                <TouchableOpacity key={item.label} style={homeStyles.menuItem} onPress={item.onPress}>
                  <EmojiText style={homeStyles.menuItemIcon}>{item.icon}</EmojiText>
                  <Text style={homeStyles.menuItemLabel}>{item.label}</Text>
                  <Text style={homeStyles.menuItemChevron}>›</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={homeStyles.menuCloseBtn}
                onPress={() => this.setState({ menuVisible: false })}
              >
                <Text style={homeStyles.menuCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* PiTrac URL-entry modal */}
        {PITRAC_ENABLED && (
          <Modal
            visible={urlModalVisible}
            transparent
            animationType="fade"
            onRequestClose={() => this.setState({ urlModalVisible: false })}
          >
            <View style={homeStyles.modalOverlay}>
              <View style={homeStyles.modalBox}>
                <Text style={homeStyles.modalTitle}>PiTrac WebSocket URL</Text>
                <Text style={homeStyles.modalHint}>
                  e.g. ws://pitrac.local:8080/ws{'\n'}or ws://192.168.1.50:8080/ws
                </Text>
                <TextInput
                  style={homeStyles.modalInput}
                  value={urlDraft}
                  onChangeText={(t) => this.setState({ urlDraft: t })}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="ws://pitrac.local:8080/ws"
                  placeholderTextColor={COLORS.textMuted}
                />
                <View style={homeStyles.modalBtnRow}>
                  <TouchableOpacity
                    style={homeStyles.piTracBtnSecondary}
                    onPress={() => this.setState({ urlModalVisible: false })}
                  >
                    <Text style={homeStyles.piTracBtnTextSecondary}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={homeStyles.piTracBtn} onPress={this.saveUrl}>
                    <Text style={homeStyles.piTracBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>
    );
  }
}

const homeStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textLight,
    marginBottom: 2,
  },
  headerSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  hamburgerBtn: {
    padding: 4,
  },
  hamburgerIcon: {
    fontSize: 24,
    color: COLORS.textLight,
  },
  listContent: {
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 80,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
  },

  // ── Club card (2-column vertical) ───────────────────────────────────────
  clubCard: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 12,
    margin: 6,
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 5,
  },
  clubCardPolygon: {
    width: CARD_POLYGON_SIZE,
    height: CARD_POLYGON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  clubCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 2,
  },
  clubCardDist: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // ── Empty state ─────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  emptyBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyBtnText: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Hamburger menu ──────────────────────────────────────────────────────
  menuOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  menuBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemIcon: {
    fontSize: 22,
    marginRight: 14,
  },
  menuItemLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  menuItemChevron: {
    fontSize: 22,
    color: COLORS.textSecondary,
  },
  menuCloseBtn: {
    marginTop: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuCloseBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },

  // ── PiTrac card ───────────────────────────────────────────────────────
  piTracCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 14,
    marginVertical: 6,
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  piTracHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  piTracIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  piTracTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  piTracTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  piTracDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  piTracStatus: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flexShrink: 1,
    marginBottom: 6,
  },
  piTracActions: {
    gap: 6,
  },
  piTracBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  piTracBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  piTracBtnText: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 12,
  },
  piTracBtnSecondary: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  piTracBtnTextSecondary: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },

  // ── URL modal ─────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  modalHint: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  modalInput: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
});
