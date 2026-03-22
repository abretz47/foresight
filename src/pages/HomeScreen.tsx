import React, { Component } from 'react';
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TextInput,
  Animated,
  Modal,
  FlatList,
  ListRenderItemInfo,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import RNModal from 'react-native-modal';
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
import { signOut } from '../lib/supabase';

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

type MigrateStep = 'select' | 'scope' | 'mode' | 'merge' | 'confirm' | 'done';

interface State {
  // ── PiTrac state ──────────────────────────────────────────────
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
  // ── UI state ──────────────────────────────────────────────────
  menuVisible: boolean;
  clubCards: ClubCardData[];
  loading: boolean;
  // ── Migration state ───────────────────────────────────────────
  showMigrateModal: boolean;
  localUsers: string[];
  isCloudUser: boolean;
  migrateStep: MigrateStep;
  selectedLocalUser: string | null;
  includeProfiles: boolean;
  migrateMode: 'add' | 'overwrite';
  isMigrating: boolean;
  migrateResult: DB.MigrationResult | null;
  migrateError: string | null;
  /** Similar-name club pairs detected between local and cloud. */
  similarClubs: DB.SimilarClubPair[];
  /** User's merge choice for each similar pair. */
  mergeDecisions: DB.ClubMergeDecision[];
  /** True while the async similar-club detection is running. */
  isDetectingSimilar: boolean;
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
      // PiTrac
      piTracProbing: false,
      piTracDetected: false,
      piTracConnected: PiTracService.isConnected(),
      piTracUrl: PiTracService.getUrl() ?? PiTracService.buildWsUrl('pitrac.local'),
      urlModalVisible: false,
      urlDraft: '',
      // UI
      menuVisible: false,
      clubCards: [],
      loading: true,
      // Migration
      showMigrateModal: false,
      localUsers: [],
      isCloudUser: false,
      migrateStep: 'select',
      selectedLocalUser: null,
      includeProfiles: true,
      migrateMode: 'add',
      isMigrating: false,
      migrateResult: null,
      migrateError: null,
      similarClubs: [],
      mergeDecisions: [],
      isDetectingSimilar: false,
    };
  }

  componentDidMount() {
    const user = this.props.route.params?.user ?? 'local_user';
    DB.initializeDefaultProfiles(user);
    this.checkMigrationAvailability();

    this.focusListener = this.props.navigation.addListener('focus', () => {
      this.loadClubCards();
    });

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

  // ── Migration helpers ──────────────────────────────────────────────────────

  checkMigrationAvailability = async () => {
    const cloudUser = DB.isCloudMode();
    const localUsers = await DB.getUsers();
    this.setState({ isCloudUser: cloudUser, localUsers });
  };

  openMigrateModal = () => {
    this.setState({
      showMigrateModal: true,
      migrateStep: 'select',
      selectedLocalUser: null,
      includeProfiles: true,
      migrateMode: 'add',
      isMigrating: false,
      migrateResult: null,
      migrateError: null,
      similarClubs: [],
      mergeDecisions: [],
      isDetectingSimilar: false,
    });
  };

  closeMigrateModal = () => {
    this.setState({ showMigrateModal: false });
  };

  runMigration = async () => {
    const { selectedLocalUser, includeProfiles, migrateMode, mergeDecisions } = this.state;
    if (!selectedLocalUser) return;
    this.setState({ isMigrating: true, migrateError: null });
    try {
      const result = await DB.migrateLocalToCloud(selectedLocalUser, {
        includeProfiles,
        mode: migrateMode,
        mergeDecisions: mergeDecisions.length > 0 ? mergeDecisions : undefined,
      });
      try {
        await DB.deleteLocalUserData(selectedLocalUser);
      } catch (cleanupErr) {
        console.warn('[Foresight] Failed to clean up local data after migration:', cleanupErr);
      }
      const localUsers = await DB.getUsers();
      this.setState({ isMigrating: false, migrateResult: result, migrateStep: 'done', localUsers });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      this.setState({ isMigrating: false, migrateError: msg, migrateStep: 'done' });
    }
  };

  /**
   * Called when the user taps "Next" on the mode step.  When scope is
   * "Shots & Profiles" with mode "Add", we first check for similar club names
   * between the local and cloud accounts.  If any are found we show the merge
   * step; otherwise we skip straight to confirm.
   */
  proceedFromMode = async () => {
    const { selectedLocalUser, includeProfiles, migrateMode } = this.state;
    if (includeProfiles && migrateMode === 'add' && selectedLocalUser) {
      this.setState({ isDetectingSimilar: true });
      try {
        const similar = await DB.detectSimilarClubs(selectedLocalUser);
        const decisions: DB.ClubMergeDecision[] = similar.map((pair) => ({
          localProfileId: pair.localProfile.id,
          cloudProfileId: pair.cloudProfile.id,
          keepWhich: 'cloud' as DB.MergeChoice,
        }));
        if (similar.length > 0) {
          this.setState({
            isDetectingSimilar: false,
            similarClubs: similar,
            mergeDecisions: decisions,
            migrateStep: 'merge',
          });
        } else {
          this.setState({ isDetectingSimilar: false, migrateStep: 'confirm' });
        }
      } catch (e) {
        console.warn('[Foresight] detectSimilarClubs failed:', e);
        this.setState({ isDetectingSimilar: false, migrateStep: 'confirm' });
      }
    } else {
      this.setState({ migrateStep: 'confirm' });
    }
  };

  updateMergeDecision = (localProfileId: string, keepWhich: DB.MergeChoice) => {
    const updated = this.state.mergeDecisions.map((d) =>
      d.localProfileId === localProfileId ? { ...d, keepWhich } : d
    );
    this.setState({ mergeDecisions: updated });
  };

  renderMigrateModalContent() {
    const {
      migrateStep,
      localUsers,
      selectedLocalUser,
      includeProfiles,
      migrateMode,
      isMigrating,
      migrateResult,
      migrateError,
      similarClubs,
      mergeDecisions,
      isDetectingSimilar,
    } = this.state;

    if (isMigrating || isDetectingSimilar) {
      return (
        <View style={migrateStyles.modalBody}>
          <ActivityIndicator size="large" color={COLORS.primaryLight} />
          <Text style={migrateStyles.loadingText}>
            {isMigrating ? 'Migrating data\u2026' : 'Checking for club conflicts\u2026'}
          </Text>
        </View>
      );
    }

    if (migrateStep === 'select') {
      return (
        <View style={migrateStyles.modalBody}>
          <Text style={migrateStyles.modalTitle}>Migrate to Cloud</Text>
          <Text style={migrateStyles.modalSubtitle}>
            Select the local account to import:
          </Text>

          <View style={migrateStyles.pickerWrapper}>
            <Picker
              selectedValue={selectedLocalUser ?? ''}
              onValueChange={(val) =>
                this.setState({ selectedLocalUser: val !== '' ? val : null })
              }
              style={migrateStyles.picker}
              dropdownIconColor={COLORS.textSecondary}
              mode={Platform.OS === 'android' ? 'dropdown' : undefined}
            >
              <Picker.Item
                label="Select a local account\u2026"
                value=""
                color={COLORS.textSecondary}
              />
              {localUsers.map((u) => (
                <Picker.Item key={u} label={u} value={u} color={COLORS.textPrimary} />
              ))}
            </Picker>
          </View>

          <View style={migrateStyles.btnRow}>
            <TouchableOpacity style={migrateStyles.cancelBtn} onPress={this.closeMigrateModal}>
              <Text style={migrateStyles.cancelBtnLabel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[migrateStyles.nextBtn, !selectedLocalUser && migrateStyles.nextBtnDisabled]}
              onPress={() => selectedLocalUser && this.setState({ migrateStep: 'scope' })}
              disabled={!selectedLocalUser}
            >
              <Text style={migrateStyles.nextBtnLabel}>Next \u2192</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (migrateStep === 'scope') {
      return (
        <View style={migrateStyles.modalBody}>
          <Text style={migrateStyles.modalTitle}>Import Scope</Text>
          <Text style={migrateStyles.modalSubtitle}>What would you like to import?</Text>

          <TouchableOpacity
            style={[migrateStyles.optionBtn, includeProfiles && migrateStyles.optionBtnSelected]}
            onPress={() => this.setState({ includeProfiles: true })}
          >
            <Text style={migrateStyles.optionIcon}>{'\uD83C\uDFCC\uFE0F'}</Text>
            <View style={migrateStyles.optionTextWrap}>
              <Text style={[migrateStyles.optionTitle, includeProfiles && migrateStyles.optionTitleSelected]}>
                Shots &amp; Profiles
              </Text>
              <Text style={migrateStyles.optionDesc}>
                Import shot profiles and all recorded shot data
              </Text>
            </View>
            {includeProfiles && <Text style={migrateStyles.checkmark}>{'\u2713'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[migrateStyles.optionBtn, !includeProfiles && migrateStyles.optionBtnSelected]}
            onPress={() => this.setState({ includeProfiles: false })}
          >
            <Text style={migrateStyles.optionIcon}>{'\uD83D\uDCCD'}</Text>
            <View style={migrateStyles.optionTextWrap}>
              <Text style={[migrateStyles.optionTitle, !includeProfiles && migrateStyles.optionTitleSelected]}>
                Shots only
              </Text>
              <Text style={migrateStyles.optionDesc}>
                Match local profiles by name and import shot data only
              </Text>
            </View>
            {!includeProfiles && <Text style={migrateStyles.checkmark}>{'\u2713'}</Text>}
          </TouchableOpacity>

          <View style={migrateStyles.btnRow}>
            <TouchableOpacity
              style={migrateStyles.cancelBtn}
              onPress={() => this.setState({ migrateStep: 'select' })}
            >
              <Text style={migrateStyles.cancelBtnLabel}>{'\u2190'} Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={migrateStyles.nextBtn}
              onPress={() => this.setState({ migrateStep: 'mode' })}
            >
              <Text style={migrateStyles.nextBtnLabel}>Next {'\u2192'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (migrateStep === 'mode') {
      return (
        <View style={migrateStyles.modalBody}>
          <Text style={migrateStyles.modalTitle}>Import Mode</Text>
          <Text style={migrateStyles.modalSubtitle}>How should records be handled?</Text>

          <TouchableOpacity
            style={[migrateStyles.optionBtn, migrateMode === 'add' && migrateStyles.optionBtnSelected]}
            onPress={() => this.setState({ migrateMode: 'add' })}
          >
            <Text style={migrateStyles.optionIcon}>{'\u2795'}</Text>
            <View style={migrateStyles.optionTextWrap}>
              <Text style={[migrateStyles.optionTitle, migrateMode === 'add' && migrateStyles.optionTitleSelected]}>
                Add records
              </Text>
              <Text style={migrateStyles.optionDesc}>
                Append local data to your existing cloud data
              </Text>
            </View>
            {migrateMode === 'add' && <Text style={migrateStyles.checkmark}>{'\u2713'}</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[migrateStyles.optionBtn, migrateMode === 'overwrite' && migrateStyles.optionBtnSelected]}
            onPress={() => this.setState({ migrateMode: 'overwrite' })}
          >
            <Text style={migrateStyles.optionIcon}>{'\uD83D\uDD04'}</Text>
            <View style={migrateStyles.optionTextWrap}>
              <Text style={[migrateStyles.optionTitle, migrateMode === 'overwrite' && migrateStyles.optionTitleSelected]}>
                Overwrite
              </Text>
              <Text style={migrateStyles.optionDesc}>
                Replace existing cloud data with local data
              </Text>
            </View>
            {migrateMode === 'overwrite' && <Text style={migrateStyles.checkmark}>{'\u2713'}</Text>}
          </TouchableOpacity>

          <View style={migrateStyles.btnRow}>
            <TouchableOpacity
              style={migrateStyles.cancelBtn}
              onPress={() => this.setState({ migrateStep: 'scope' })}
            >
              <Text style={migrateStyles.cancelBtnLabel}>{'\u2190'} Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={migrateStyles.nextBtn}
              onPress={this.proceedFromMode}
            >
              <Text style={migrateStyles.nextBtnLabel}>Next {'\u2192'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (migrateStep === 'merge') {
      return (
        <View style={migrateStyles.modalBody}>
          <Text style={migrateStyles.modalTitle}>Club Conflicts Found</Text>
          <Text style={migrateStyles.modalSubtitle}>
            Similar clubs were found in both accounts. Choose which to keep for each.
          </Text>

          <ScrollView style={migrateStyles.mergeScrollArea}>
            {similarClubs.map((pair) => {
              const decision = mergeDecisions.find(
                (d) => d.localProfileId === pair.localProfile.id
              );
              const kept = decision?.keepWhich ?? 'cloud';
              const OPTIONS: Array<{ value: DB.MergeChoice; label: string; desc: string }> = [
                {
                  value: 'cloud',
                  label: `Keep cloud "${pair.cloudProfile.name}"`,
                  desc: `${pair.cloudProfile.distance}y \u00b7 miss ${pair.cloudProfile.missRadius}`,
                },
                {
                  value: 'local',
                  label: `Keep local "${pair.localProfile.name}"`,
                  desc: `${pair.localProfile.distance}y \u00b7 miss ${pair.localProfile.missRadius}`,
                },
                {
                  value: 'both',
                  label: 'Keep both (create separate)',
                  desc: 'No merging \u2014 a new cloud club will be created',
                },
              ];
              return (
                <View key={pair.localProfile.id} style={migrateStyles.conflictCard}>
                  <Text style={migrateStyles.conflictTitle}>
                    {'\u26A0\uFE0F'} "{pair.localProfile.name}" {'\u2248'} "{pair.cloudProfile.name}"
                  </Text>
                  {OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        migrateStyles.mergeOption,
                        kept === opt.value && migrateStyles.mergeOptionSelected,
                      ]}
                      onPress={() => this.updateMergeDecision(pair.localProfile.id, opt.value)}
                    >
                      <View style={migrateStyles.mergeRadio}>
                        {kept === opt.value && <View style={migrateStyles.mergeRadioFill} />}
                      </View>
                      <View style={migrateStyles.optionTextWrap}>
                        <Text
                          style={[
                            migrateStyles.mergeOptionLabel,
                            kept === opt.value && migrateStyles.mergeOptionLabelSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                        <Text style={migrateStyles.optionDesc}>{opt.desc}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })}
          </ScrollView>

          <View style={migrateStyles.btnRow}>
            <TouchableOpacity
              style={migrateStyles.cancelBtn}
              onPress={() => this.setState({ migrateStep: 'mode' })}
            >
              <Text style={migrateStyles.cancelBtnLabel}>{'\u2190'} Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={migrateStyles.nextBtn}
              onPress={() => this.setState({ migrateStep: 'confirm' })}
            >
              <Text style={migrateStyles.nextBtnLabel}>Next {'\u2192'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (migrateStep === 'confirm') {
      const scopeLabel = includeProfiles ? 'Shots & Profiles' : 'Shots only';
      const modeLabel = migrateMode === 'add' ? 'Add records' : 'Overwrite';
      const overwriteWarning =
        migrateMode === 'overwrite'
          ? includeProfiles
            ? '\n\u26A0\uFE0F This will delete ALL existing cloud profiles and shot data first.'
            : '\n\u26A0\uFE0F This will clear shot data for matched cloud profiles first.'
          : '';
      return (
        <View style={migrateStyles.modalBody}>
          <Text style={migrateStyles.modalTitle}>Confirm Migration</Text>
          <Text style={migrateStyles.summaryText}>
            Local account: <Text style={migrateStyles.summaryValue}>{selectedLocalUser}</Text>
          </Text>
          <Text style={migrateStyles.summaryText}>
            Import scope: <Text style={migrateStyles.summaryValue}>{scopeLabel}</Text>
          </Text>
          <Text style={migrateStyles.summaryText}>
            Mode: <Text style={migrateStyles.summaryValue}>{modeLabel}</Text>
          </Text>
          {overwriteWarning !== '' && (
            <Text style={migrateStyles.warningText}>{overwriteWarning.trim()}</Text>
          )}
          <View style={migrateStyles.btnRow}>
            <TouchableOpacity
              style={migrateStyles.cancelBtn}
              onPress={() =>
                this.setState({ migrateStep: similarClubs.length > 0 ? 'merge' : 'mode' })
              }
            >
              <Text style={migrateStyles.cancelBtnLabel}>{'\u2190'} Back</Text>
            </TouchableOpacity>
            <TouchableOpacity style={migrateStyles.confirmBtn} onPress={this.runMigration}>
              <Text style={migrateStyles.nextBtnLabel}>Import</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // done step
    return (
      <View style={migrateStyles.modalBody}>
        {migrateError ? (
          <>
            <Text style={migrateStyles.doneIcon}>{'\u274C'}</Text>
            <Text style={migrateStyles.modalTitle}>Migration Failed</Text>
            <Text style={migrateStyles.errorText}>{migrateError}</Text>
          </>
        ) : (
          <>
            <Text style={migrateStyles.doneIcon}>{'\u2705'}</Text>
            <Text style={migrateStyles.modalTitle}>Migration Complete</Text>
            {migrateResult && (
              <>
                <Text style={migrateStyles.summaryText}>
                  Profiles imported:{' '}
                  <Text style={migrateStyles.summaryValue}>{migrateResult.profilesImported}</Text>
                </Text>
                <Text style={migrateStyles.summaryText}>
                  Shots imported:{' '}
                  <Text style={migrateStyles.summaryValue}>{migrateResult.shotsImported}</Text>
                </Text>
              </>
            )}
          </>
        )}
        <TouchableOpacity style={migrateStyles.confirmBtn} onPress={this.closeMigrateModal}>
          <Text style={migrateStyles.nextBtnLabel}>Done</Text>
        </TouchableOpacity>
      </View>
    );
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
      isCloudUser,
      localUsers,
      showMigrateModal,
    } = this.state;

    const showMigration = isCloudUser && localUsers.length > 0;

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
                ...(showMigration ? [{
                  icon: '☁️',
                  label: 'Migrate to Cloud',
                  onPress: () => { this.setState({ menuVisible: false }); this.openMigrateModal(); },
                }] : []),
                {
                  icon: '🚪',
                  label: 'Log Out',
                  onPress: async () => { this.setState({ menuVisible: false }); await signOut(); navigate('Login'); },
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

        {/* Migration bottom sheet */}
        <RNModal
          isVisible={showMigrateModal}
          onBackdropPress={this.closeMigrateModal}
          onBackButtonPress={this.closeMigrateModal}
          style={styles.modalBottom}
          avoidKeyboard
        >
          <View style={migrateStyles.sheet}>
            {this.renderMigrateModalContent()}
          </View>
        </RNModal>
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

const migrateStyles = StyleSheet.create({
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  modalBody: {
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 20,
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionBtnSelected: {
    borderColor: COLORS.primaryLight,
    backgroundColor: '#EAF4EE',
  },
  optionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  optionTitleSelected: {
    color: COLORS.primaryLight,
  },
  optionDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  checkmark: {
    fontSize: 18,
    color: COLORS.primaryLight,
    fontWeight: '700',
    marginLeft: 8,
  },
  btnRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    marginRight: 8,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnLabel: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 15,
  },
  nextBtn: {
    flex: 2,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnDisabled: {
    opacity: 0.4,
  },
  pickerWrapper: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },
  picker: {
    color: COLORS.textPrimary,
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nextBtnLabel: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 15,
  },
  summaryText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  summaryValue: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  warningText: {
    fontSize: 13,
    color: COLORS.danger,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  doneIcon: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.danger,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  mergeScrollArea: {
    maxHeight: 320,
    marginBottom: 4,
  },
  conflictCard: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  conflictTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  mergeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  mergeOptionSelected: {
    borderColor: COLORS.primaryLight,
    backgroundColor: '#EAF4EE',
  },
  mergeRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  mergeRadioFill: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: COLORS.primaryLight,
  },
  mergeOptionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 1,
  },
  mergeOptionLabelSelected: {
    color: COLORS.primaryLight,
  },
});

