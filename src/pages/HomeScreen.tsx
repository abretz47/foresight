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
} from 'react-native';
import { styles, COLORS } from '../styles/styles';
import { HomeNavigationProp, HomeRouteProp } from '../types/navigation';
import * as DB from '../data/db';
import * as PiTracService from '../lib/piTracService';
import { PITRAC_ENABLED } from '../lib/featureFlags';

interface Props {
  navigation: HomeNavigationProp;
  route: HomeRouteProp;
}

interface State {
  /** true while probing the network for a PiTrac server */
  piTracProbing: boolean;
  /** true if a PiTrac server was found (or we have a stored URL) */
  piTracDetected: boolean;
  /** true when the WebSocket connection is open */
  piTracConnected: boolean;
  /** current WebSocket URL (shown & editable in the modal) */
  piTracUrl: string;
  /** controls visibility of the URL-entry modal */
  urlModalVisible: boolean;
  /** draft URL being typed in the modal */
  urlDraft: string;
}

interface FeatureCard {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  accent?: boolean;
}

export default class HomeScreen extends Component<Props, State> {
  private piTracPulse = new Animated.Value(1);
  private unsubConnection: (() => void) | null = null;
  private pulseAnim: Animated.CompositeAnimation | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      piTracProbing: false,
      piTracDetected: false,
      piTracConnected: PiTracService.isConnected(),
      piTracUrl: PiTracService.getUrl() ?? PiTracService.buildWsUrl('pitrac.local'),
      urlModalVisible: false,
      urlDraft: '',
    };
  }

  componentDidMount() {
    const user = this.props.route.params?.user ?? 'local_user';
    DB.initializeDefaultProfiles(user);

    // Subscribe to connection-state changes
    if (PITRAC_ENABLED) {
      this.unsubConnection = PiTracService.addConnectionListener((connected) => {
        this.setState({ piTracConnected: connected });
        if (connected) {
          this.startPulse();
        } else {
          this.stopPulse();
        }
      });

      // If already connected, start the animation and mark detected
      if (PiTracService.isConnected()) {
        this.setState({ piTracDetected: true });
        this.startPulse();
      }

      // Attempt to auto-detect a PiTrac server in the background
      this.probePiTrac();
    }
  }

  componentWillUnmount() {
    if (this.unsubConnection) this.unsubConnection();
    this.stopPulse();
  }

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
    if (PiTracService.isConnected()) return; // already connected

    this.setState({ piTracProbing: true });

    // 1. Try stored URL first (extract host/port from ws:// URL)
    const stored = await PiTracService.getStoredUrl();
    if (stored) {
      try {
        const parsed = new URL(stored);
        const host = parsed.hostname;
        const port = parseInt(parsed.port || '8080', 10);
        const found = await PiTracService.probe(host, port);
        if (found) {
          this.setState({
            piTracDetected: true,
            piTracProbing: false,
            piTracUrl: stored,
          });
          return;
        }
      } catch (e) {
        console.warn('[PiTrac] Could not parse stored URL:', e);
      }
    }

    // 2. Try pitrac.local (mDNS)
    const found = await PiTracService.probe('pitrac.local');
    if (found) {
      const url = PiTracService.buildWsUrl('pitrac.local');
      await PiTracService.setStoredUrl(url);
      this.setState({
        piTracDetected: true,
        piTracProbing: false,
        piTracUrl: url,
      });
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

  render() {
    const { navigate } = this.props.navigation;
    const user = this.props.route.params?.user ?? 'local_user';
    const { piTracProbing, piTracDetected, piTracConnected, piTracUrl, urlModalVisible, urlDraft } = this.state;

    const cards: FeatureCard[] = [
      {
        icon: '🏌️',
        title: 'Shot Profile',
        description: 'Configure your clubs, distances, and target zones',
        onPress: () => navigate('ShotProfile', { user }),
      },
      {
        icon: '📍',
        title: 'Record Data',
        description: 'Tap where your ball lands to log each shot',
        onPress: () => this.navigateToRecord('Record'),
        accent: true,
      },
      {
        icon: '📊',
        title: 'Analyze Data',
        description: 'Review your shot dispersion and accuracy stats',
        onPress: () => this.navigateToRecord('Analyze'),
      },
      {
        icon: '❓',
        title: 'How To Use',
        description: 'Learn how to get the most out of Foresight',
        onPress: () => navigate('HowToUse'),
      },
    ];

    return (
      <View style={styles.template}>
        {/* Header greeting */}
        <View style={homeStyles.header}>
          <Text style={homeStyles.greeting}>Hello, {user} 👋</Text>
          <Text style={homeStyles.headerSub}>What would you like to do today?</Text>
        </View>

        {/* Feature cards */}
        <View style={homeStyles.cardsContainer}>
          {cards.map((card) => (
            <TouchableOpacity
              key={card.title}
              style={[homeStyles.featureCard, card.accent && homeStyles.featureCardAccent]}
              onPress={card.onPress}
              activeOpacity={0.82}
            >
              <Text style={homeStyles.cardIcon}>{card.icon}</Text>
              <View style={homeStyles.cardText}>
                <Text
                  style={[
                    homeStyles.cardTitle,
                    card.accent && homeStyles.cardTitleAccent,
                  ]}
                >
                  {card.title}
                </Text>
                <Text
                  style={[
                    homeStyles.cardDesc,
                    card.accent && homeStyles.cardDescAccent,
                  ]}
                >
                  {card.description}
                </Text>
              </View>
              <Text style={[homeStyles.cardChevron, card.accent && homeStyles.cardChevronAccent]}>›</Text>
            </TouchableOpacity>
          ))}

          {/* ── PiTrac section ─────────────────────────────────── */}
          {PITRAC_ENABLED && (
          <View style={homeStyles.piTracCard}>
            <View style={homeStyles.piTracHeader}>
              <Text style={homeStyles.piTracIcon}>📡</Text>
              <View style={homeStyles.piTracTitleRow}>
                <Text style={homeStyles.piTracTitle}>PiTrac</Text>
                {piTracConnected && (
                  <Animated.View
                    style={[homeStyles.piTracDot, { opacity: this.piTracPulse }]}
                  />
                )}
              </View>
            </View>

            {/* Status / action area */}
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
                  <TouchableOpacity
                    style={homeStyles.piTracBtn}
                    onPress={this.handleConnectPiTrac}
                  >
                    <Text style={homeStyles.piTracBtnText}>Connect</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={homeStyles.piTracBtnSecondary}
                    onPress={this.openUrlModal}
                  >
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
                  <TouchableOpacity
                    style={homeStyles.piTracBtnSecondary}
                    onPress={this.openUrlModal}
                  >
                    <Text style={homeStyles.piTracBtnTextSecondary}>Enter URL</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
          )}
        </View>

        {/* Logout bar */}
        <View style={styles.logoutButtonRow}>
          <TouchableOpacity style={styles.logoutButtonContainer} onPress={() => navigate('Login')}>
            <Text style={styles.buttonLabelLight}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* URL-entry modal — only rendered when PiTrac feature is enabled */}
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
                <TouchableOpacity
                  style={homeStyles.piTracBtn}
                  onPress={this.saveUrl}
                >
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
    paddingTop: 40,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textLight,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 14,
    color: COLORS.textMuted,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  cardsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 60,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    marginVertical: 6,
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 5,
  },
  featureCardAccent: {
    backgroundColor: COLORS.primaryLight,
  },
  cardIcon: {
    fontSize: 30,
    marginRight: 16,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  cardTitleAccent: {
    color: COLORS.textLight,
  },
  cardDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '400',
  },
  cardDescAccent: {
    color: COLORS.accentLight,
  },
  cardChevron: {
    fontSize: 28,
    color: COLORS.textSecondary,
    fontWeight: '300',
  },
  cardChevronAccent: {
    color: COLORS.textLight,
  },

  // ── PiTrac card ───────────────────────────────────────────────
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

  // ── URL modal ─────────────────────────────────────────────────
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
