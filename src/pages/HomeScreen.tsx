import React, { Component } from 'react';
import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Modal from 'react-native-modal';
import { styles, COLORS } from '../styles/styles';
import { HomeNavigationProp, HomeRouteProp } from '../types/navigation';
import * as DB from '../data/db';
import { signOut } from '../lib/supabase';

interface Props {
  navigation: HomeNavigationProp;
  route: HomeRouteProp;
}

interface FeatureCard {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  accent?: boolean;
}

type MigrateStep = 'scope' | 'mode' | 'confirm' | 'done';

interface State {
  showMigrateModal: boolean;
  hasLocalData: boolean;
  isCloudUser: boolean;
  migrateStep: MigrateStep;
  includeProfiles: boolean;
  migrateMode: 'add' | 'overwrite';
  isMigrating: boolean;
  migrateResult: DB.MigrationResult | null;
  migrateError: string | null;
}

export default class HomeScreen extends Component<Props, State> {
  state: State = {
    showMigrateModal: false,
    hasLocalData: false,
    isCloudUser: false,
    migrateStep: 'scope',
    includeProfiles: true,
    migrateMode: 'add',
    isMigrating: false,
    migrateResult: null,
    migrateError: null,
  };

  componentDidMount() {
    const user = this.props.route.params?.user ?? 'local_user';
    DB.initializeDefaultProfiles(user);
    this.checkMigrationAvailability();
  }

  checkMigrationAvailability = async () => {
    const cloudUser = DB.isCloudMode();
    const localData = await DB.hasLocalData('local_user');
    this.setState({ isCloudUser: cloudUser, hasLocalData: localData });
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

  openMigrateModal = () => {
    this.setState({
      showMigrateModal: true,
      migrateStep: 'scope',
      includeProfiles: true,
      migrateMode: 'add',
      isMigrating: false,
      migrateResult: null,
      migrateError: null,
    });
  };

  closeMigrateModal = () => {
    this.setState({ showMigrateModal: false });
  };

  runMigration = async () => {
    this.setState({ isMigrating: true, migrateError: null });
    try {
      const result = await DB.migrateLocalToCloud('local_user', {
        includeProfiles: this.state.includeProfiles,
        mode: this.state.migrateMode,
      });
      this.setState({ isMigrating: false, migrateResult: result, migrateStep: 'done' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      this.setState({ isMigrating: false, migrateError: msg, migrateStep: 'done' });
    }
  };

  renderMigrateModalContent() {
    const { migrateStep, includeProfiles, migrateMode, isMigrating, migrateResult, migrateError } =
      this.state;

    if (isMigrating) {
      return (
        <View style={migrateStyles.modalBody}>
          <ActivityIndicator size="large" color={COLORS.primaryLight} />
          <Text style={migrateStyles.loadingText}>Migrating data…</Text>
        </View>
      );
    }

    if (migrateStep === 'scope') {
      return (
        <View style={migrateStyles.modalBody}>
          <Text style={migrateStyles.modalTitle}>Migrate to Cloud</Text>
          <Text style={migrateStyles.modalSubtitle}>What would you like to import?</Text>

          <TouchableOpacity
            style={[migrateStyles.optionBtn, includeProfiles && migrateStyles.optionBtnSelected]}
            onPress={() => this.setState({ includeProfiles: true })}
          >
            <Text style={[migrateStyles.optionIcon]}>🏌️</Text>
            <View style={migrateStyles.optionTextWrap}>
              <Text style={[migrateStyles.optionTitle, includeProfiles && migrateStyles.optionTitleSelected]}>
                Shots & Profiles
              </Text>
              <Text style={migrateStyles.optionDesc}>
                Import shot profiles and all recorded shot data
              </Text>
            </View>
            {includeProfiles && <Text style={migrateStyles.checkmark}>✓</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[migrateStyles.optionBtn, !includeProfiles && migrateStyles.optionBtnSelected]}
            onPress={() => this.setState({ includeProfiles: false })}
          >
            <Text style={migrateStyles.optionIcon}>📍</Text>
            <View style={migrateStyles.optionTextWrap}>
              <Text style={[migrateStyles.optionTitle, !includeProfiles && migrateStyles.optionTitleSelected]}>
                Shots only
              </Text>
              <Text style={migrateStyles.optionDesc}>
                Match local profiles by name and import shot data only
              </Text>
            </View>
            {!includeProfiles && <Text style={migrateStyles.checkmark}>✓</Text>}
          </TouchableOpacity>

          <View style={migrateStyles.btnRow}>
            <TouchableOpacity style={migrateStyles.cancelBtn} onPress={this.closeMigrateModal}>
              <Text style={migrateStyles.cancelBtnLabel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={migrateStyles.nextBtn}
              onPress={() => this.setState({ migrateStep: 'mode' })}
            >
              <Text style={migrateStyles.nextBtnLabel}>Next →</Text>
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
            <Text style={migrateStyles.optionIcon}>➕</Text>
            <View style={migrateStyles.optionTextWrap}>
              <Text style={[migrateStyles.optionTitle, migrateMode === 'add' && migrateStyles.optionTitleSelected]}>
                Add records
              </Text>
              <Text style={migrateStyles.optionDesc}>
                Append local data to your existing cloud data
              </Text>
            </View>
            {migrateMode === 'add' && <Text style={migrateStyles.checkmark}>✓</Text>}
          </TouchableOpacity>

          <TouchableOpacity
            style={[migrateStyles.optionBtn, migrateMode === 'overwrite' && migrateStyles.optionBtnSelected]}
            onPress={() => this.setState({ migrateMode: 'overwrite' })}
          >
            <Text style={migrateStyles.optionIcon}>🔄</Text>
            <View style={migrateStyles.optionTextWrap}>
              <Text style={[migrateStyles.optionTitle, migrateMode === 'overwrite' && migrateStyles.optionTitleSelected]}>
                Overwrite
              </Text>
              <Text style={migrateStyles.optionDesc}>
                Replace existing cloud data with local data
              </Text>
            </View>
            {migrateMode === 'overwrite' && <Text style={migrateStyles.checkmark}>✓</Text>}
          </TouchableOpacity>

          <View style={migrateStyles.btnRow}>
            <TouchableOpacity
              style={migrateStyles.cancelBtn}
              onPress={() => this.setState({ migrateStep: 'scope' })}
            >
              <Text style={migrateStyles.cancelBtnLabel}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={migrateStyles.nextBtn}
              onPress={() => this.setState({ migrateStep: 'confirm' })}
            >
              <Text style={migrateStyles.nextBtnLabel}>Next →</Text>
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
            ? '\n⚠️ This will delete ALL existing cloud profiles and shot data first.'
            : '\n⚠️ This will clear shot data for matched cloud profiles first.'
          : '';
      return (
        <View style={migrateStyles.modalBody}>
          <Text style={migrateStyles.modalTitle}>Confirm Migration</Text>
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
              onPress={() => this.setState({ migrateStep: 'mode' })}
            >
              <Text style={migrateStyles.cancelBtnLabel}>← Back</Text>
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
            <Text style={migrateStyles.doneIcon}>❌</Text>
            <Text style={migrateStyles.modalTitle}>Migration Failed</Text>
            <Text style={migrateStyles.errorText}>{migrateError}</Text>
          </>
        ) : (
          <>
            <Text style={migrateStyles.doneIcon}>✅</Text>
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

  render() {
    const { navigate } = this.props.navigation;
    const user = this.props.route.params?.user ?? 'local_user';
    const { isCloudUser, hasLocalData, showMigrateModal } = this.state;
    const showMigration = isCloudUser && hasLocalData;

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

    if (showMigration) {
      cards.push({
        icon: '☁️',
        title: 'Migrate to Cloud',
        description: 'Import your local account data into this cloud account',
        onPress: this.openMigrateModal,
      });
    }

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
        </View>

        {/* Logout bar */}
        <View style={styles.logoutButtonRow}>
          <TouchableOpacity
            style={styles.logoutButtonContainer}
            onPress={async () => {
              await signOut();
              navigate('Login');
            }}
          >
            <Text style={styles.buttonLabelLight}>Log Out</Text>
          </TouchableOpacity>
        </View>

        {/* Migration modal */}
        <Modal
          isVisible={showMigrateModal}
          onBackdropPress={this.closeMigrateModal}
          onBackButtonPress={this.closeMigrateModal}
          style={styles.modalBottom}
          avoidKeyboard
        >
          <View style={migrateStyles.sheet}>
            {this.renderMigrateModalContent()}
          </View>
        </Modal>
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
});
