/**
 * MigrateModal
 *
 * Multi-step wizard for migrating local account data into the active cloud
 * account.  Steps:
 *   select → scope → mode → merge (optional) → confirm → done
 */
import React, { Component } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as DB from '../data/db';
import { COLORS } from '../styles/styles';

type MigrateStep = 'select' | 'scope' | 'mode' | 'merge' | 'confirm' | 'done';

interface Props {
  visible: boolean;
  localUsers: string[];
  onClose: () => void;
}

interface State {
  migrateStep: MigrateStep;
  selectedLocalUser: string | null;
  includeProfiles: boolean;
  migrateMode: 'add' | 'overwrite';
  isMigrating: boolean;
  isDetectingSimilar: boolean;
  migrateResult: DB.MigrationResult | null;
  migrateError: string | null;
  similarClubs: DB.SimilarClubPair[];
  mergeDecisions: DB.ClubMergeDecision[];
}

const INITIAL_STATE: State = {
  migrateStep: 'select',
  selectedLocalUser: null,
  includeProfiles: true,
  migrateMode: 'add',
  isMigrating: false,
  isDetectingSimilar: false,
  migrateResult: null,
  migrateError: null,
  similarClubs: [],
  mergeDecisions: [],
};

export default class MigrateModal extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { ...INITIAL_STATE };
  }

  componentDidUpdate(prevProps: Props) {
    // Reset wizard whenever the modal is opened.
    if (this.props.visible && !prevProps.visible) {
      this.setState({ ...INITIAL_STATE });
    }
  }

  private close = () => {
    this.props.onClose();
  };

  private runMigration = async () => {
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
      this.setState({ isMigrating: false, migrateResult: result, migrateStep: 'done' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      this.setState({ isMigrating: false, migrateError: msg, migrateStep: 'done' });
    }
  };

  /**
   * Called when the user taps "Next" on the mode step.  When scope is
   * "Shots & Profiles" with mode "add", first check for similar club names.
   * If any are found show the merge step; otherwise skip to confirm.
   */
  private proceedFromMode = async () => {
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

  private updateMergeDecision = (localProfileId: string, keepWhich: DB.MergeChoice) => {
    const updated = this.state.mergeDecisions.map((d) =>
      d.localProfileId === localProfileId ? { ...d, keepWhich } : d
    );
    this.setState({ mergeDecisions: updated });
  };

  private renderContent() {
    const {
      migrateStep,
      selectedLocalUser,
      includeProfiles,
      migrateMode,
      isMigrating,
      isDetectingSimilar,
      migrateResult,
      migrateError,
      similarClubs,
      mergeDecisions,
    } = this.state;
    const { localUsers } = this.props;

    if (isMigrating || isDetectingSimilar) {
      return (
        <View style={migrateStyles.modalBody}>
          <ActivityIndicator size="large" color={COLORS.primaryLight} />
          <Text style={migrateStyles.loadingText}>
            {isMigrating ? 'Migrating data…' : 'Checking for club conflicts…'}
          </Text>
        </View>
      );
    }

    // ── Select local user ─────────────────────────────────────────────────────
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
                label="Select a local account…"
                value=""
                color={COLORS.textSecondary}
              />
              {localUsers.map((u) => (
                <Picker.Item key={u} label={u} value={u} color={COLORS.textPrimary} />
              ))}
            </Picker>
          </View>

          <View style={migrateStyles.btnRow}>
            <TouchableOpacity style={migrateStyles.cancelBtn} onPress={this.close}>
              <Text style={migrateStyles.cancelBtnLabel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[migrateStyles.nextBtn, !selectedLocalUser && migrateStyles.nextBtnDisabled]}
              onPress={() => selectedLocalUser && this.setState({ migrateStep: 'scope' })}
              disabled={!selectedLocalUser}
            >
              <Text style={migrateStyles.nextBtnLabel}>Next →</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // ── Scope ─────────────────────────────────────────────────────────────────
    if (migrateStep === 'scope') {
      return (
        <View style={migrateStyles.modalBody}>
          <Text style={migrateStyles.modalTitle}>Import Scope</Text>
          <Text style={migrateStyles.modalSubtitle}>What would you like to import?</Text>

          <TouchableOpacity
            style={[migrateStyles.optionBtn, includeProfiles && migrateStyles.optionBtnSelected]}
            onPress={() => this.setState({ includeProfiles: true })}
          >
            <Text style={migrateStyles.optionIcon}>🏌️</Text>
            <View style={migrateStyles.optionTextWrap}>
              <Text style={[migrateStyles.optionTitle, includeProfiles && migrateStyles.optionTitleSelected]}>
                Shots &amp; Profiles
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
            <TouchableOpacity
              style={migrateStyles.cancelBtn}
              onPress={() => this.setState({ migrateStep: 'select' })}
            >
              <Text style={migrateStyles.cancelBtnLabel}>← Back</Text>
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

    // ── Mode ─────────────────────────────────────────────────────────────────
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
              onPress={this.proceedFromMode}
            >
              <Text style={migrateStyles.nextBtnLabel}>Next →</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // ── Merge conflicts ──────────────────────────────────────────────────────
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
                  desc: `${pair.cloudProfile.distance}y · miss ${pair.cloudProfile.missRadius}`,
                },
                {
                  value: 'local',
                  label: `Keep local "${pair.localProfile.name}"`,
                  desc: `${pair.localProfile.distance}y · miss ${pair.localProfile.missRadius}`,
                },
                {
                  value: 'both',
                  label: 'Keep both (create separate)',
                  desc: 'No merging — a new cloud club will be created',
                },
              ];
              return (
                <View key={pair.localProfile.id} style={migrateStyles.conflictCard}>
                  <Text style={migrateStyles.conflictTitle}>
                    ⚠️ "{pair.localProfile.name}" ≈ "{pair.cloudProfile.name}"
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

    // ── Confirm ────────────────────────────────────────────────────────────────
    if (migrateStep === 'confirm') {
      const scopeLabel = includeProfiles ? 'Shots & Profiles' : 'Shots only';
      const modeLabel = migrateMode === 'add' ? 'Add records' : 'Overwrite';
      const overwriteWarning =
        migrateMode === 'overwrite'
          ? includeProfiles
            ? '⚠️ This will delete ALL existing cloud profiles and shot data first.'
            : '⚠️ This will clear shot data for matched cloud profiles first.'
          : '';
      return (
        <View style={migrateStyles.modalBody}>
          <Text style={migrateStyles.modalTitle}>Confirm Migration</Text>
          <Text style={migrateStyles.summaryText}>
            Local account:{' '}
            <Text style={migrateStyles.summaryValue}>{selectedLocalUser}</Text>
          </Text>
          <Text style={migrateStyles.summaryText}>
            Import scope:{' '}
            <Text style={migrateStyles.summaryValue}>{scopeLabel}</Text>
          </Text>
          <Text style={migrateStyles.summaryText}>
            Mode: <Text style={migrateStyles.summaryValue}>{modeLabel}</Text>
          </Text>
          {overwriteWarning !== '' && (
            <Text style={migrateStyles.warningText}>{overwriteWarning}</Text>
          )}
          <View style={migrateStyles.btnRow}>
            <TouchableOpacity
              style={migrateStyles.cancelBtn}
              onPress={() =>
                this.setState({
                  migrateStep: similarClubs.length > 0 ? 'merge' : 'mode',
                })
              }
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

    // ── Done ──────────────────────────────────────────────────────────────────
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
                  <Text style={migrateStyles.summaryValue}>
                    {migrateResult.profilesImported}
                  </Text>
                </Text>
                <Text style={migrateStyles.summaryText}>
                  Shots imported:{' '}
                  <Text style={migrateStyles.summaryValue}>{migrateResult.shotsImported}</Text>
                </Text>
              </>
            )}
          </>
        )}
        <TouchableOpacity style={migrateStyles.confirmBtn} onPress={this.close}>
          <Text style={migrateStyles.nextBtnLabel}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  render() {
    return (
      <Modal
        visible={this.props.visible}
        transparent
        animationType="slide"
        onRequestClose={this.close}
      >
        <View style={migrateStyles.overlay}>
          <View style={migrateStyles.sheet}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {this.renderContent()}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
}

const migrateStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 32,
    maxHeight: '90%',
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
  confirmBtn: {
    flex: 2,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  nextBtnLabel: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 15,
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
