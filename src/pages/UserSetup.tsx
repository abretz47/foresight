import React, { Component } from 'react';
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import Svg, { Path, Line, Polygon, Circle, Rect, G } from 'react-native-svg';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import * as DB from '../data/db';
import * as SessionService from '../lib/sessionService';
import { styles, COLORS } from '../styles/styles';
import { UserSetupNavigationProp, UserSetupRouteProp } from '../types/navigation';

interface Props {
  navigation: UserSetupNavigationProp;
  route: UserSetupRouteProp;
}

interface State {
  age: string;
  handicap: string;
  handWidth: string;
  armLength: string;
  showHandInfoModal: boolean;
  showArmInfoModal: boolean;
  showHandcapInfoModal: boolean;
  showHandDiagramModal: boolean;
  showArmDiagramModal: boolean;
}

// ── Fist / hand-width SVG diagram ─────────────────────────────────────────
// Shows a simple closed fist with a dimension arrow from the ring-finger
// knuckle to the pinky knuckle.
function HandWidthDiagram() {
  return (
    <Svg width="260" height="200" viewBox="0 0 260 200">
      {/* Palm base */}
      <Path
        d="M70,160 Q65,175 90,178 Q130,185 170,178 Q195,175 190,160"
        fill="#E8D5B5"
        stroke="#8B6914"
        strokeWidth="2"
      />
      {/* Index finger */}
      <Path
        d="M95,160 L90,100 Q90,88 98,88 Q106,88 106,100 L108,160"
        fill="#E8D5B5"
        stroke="#8B6914"
        strokeWidth="2"
      />
      {/* Middle finger */}
      <Path
        d="M115,160 L112,92 Q112,80 120,80 Q128,80 128,92 L128,160"
        fill="#E8D5B5"
        stroke="#8B6914"
        strokeWidth="2"
      />
      {/* Ring finger */}
      <Path
        d="M136,160 L133,98 Q133,86 141,86 Q149,86 149,98 L149,160"
        fill="#E8D5B5"
        stroke="#8B6914"
        strokeWidth="2"
      />
      {/* Pinky finger */}
      <Path
        d="M157,160 L154,110 Q154,100 161,100 Q168,100 168,110 L168,160"
        fill="#E8D5B5"
        stroke="#8B6914"
        strokeWidth="2"
      />
      {/* Thumb (folded) */}
      <Path
        d="M70,160 Q65,150 68,138 Q72,125 82,122 Q90,120 92,130 L95,160"
        fill="#E8D5B5"
        stroke="#8B6914"
        strokeWidth="2"
      />

      {/* Ring finger knuckle dot */}
      <Circle cx="141" cy="86" r="4" fill="#D94F3D" />
      {/* Pinky knuckle dot */}
      <Circle cx="161" cy="100" r="4" fill="#D94F3D" />

      {/* Dimension line */}
      <Line x1="141" y1="72" x2="161" y2="72" stroke="#D94F3D" strokeWidth="2" />
      {/* Left arrow */}
      <Polygon points="136,72 144,68 144,76" fill="#D94F3D" />
      {/* Right arrow */}
      <Polygon points="166,72 158,68 158,76" fill="#D94F3D" />

      {/* Labels */}
      <G>
        <Path d="M141,72 L141,86" stroke="#D94F3D" strokeWidth="1.5" strokeDasharray="3,2" />
        <Path d="M161,72 L161,100" stroke="#D94F3D" strokeWidth="1.5" strokeDasharray="3,2" />
      </G>

      {/* Measurement label */}
      <Rect x="126" y="52" width="88" height="18" rx="5" fill="rgba(217,79,61,0.15)" />
    </Svg>
  );
}

// ── Arm-length SVG diagram ──────────────────────────────────────────────────
// Shows a simplified arm from palm-base to inside shoulder.
function ArmLengthDiagram() {
  return (
    <Svg width="300" height="180" viewBox="0 0 300 180">
      {/* Upper arm */}
      <Path
        d="M50,80 Q55,70 80,65 L170,75 Q180,77 180,85 L170,95 Q160,97 80,90 Q55,88 50,80 Z"
        fill="#E8D5B5"
        stroke="#8B6914"
        strokeWidth="2"
      />
      {/* Forearm */}
      <Path
        d="M170,75 Q195,68 220,72 L240,78 Q250,82 245,90 L228,92 Q205,94 180,90 L170,95 Z"
        fill="#E8D5B5"
        stroke="#8B6914"
        strokeWidth="2"
      />
      {/* Palm */}
      <Path
        d="M240,78 Q255,74 262,82 Q265,90 255,96 L245,94 L228,92 Z"
        fill="#E8D5B5"
        stroke="#8B6914"
        strokeWidth="2"
      />

      {/* Inside shoulder dot */}
      <Circle cx="55" cy="80" r="5" fill="#2D6A48" />
      {/* Palm base dot */}
      <Circle cx="248" cy="85" r="5" fill="#2D6A48" />

      {/* Dimension arrow line above the arm */}
      <Line x1="55" y1="55" x2="248" y2="55" stroke="#2D6A48" strokeWidth="2" />
      {/* Left arrow */}
      <Polygon points="50,55 58,51 58,59" fill="#2D6A48" />
      {/* Right arrow */}
      <Polygon points="253,55 245,51 245,59" fill="#2D6A48" />

      {/* Dashed drop lines */}
      <Line x1="55" y1="55" x2="55" y2="80" stroke="#2D6A48" strokeWidth="1.5" strokeDasharray="3,2" />
      <Line x1="248" y1="55" x2="248" y2="85" stroke="#2D6A48" strokeWidth="1.5" strokeDasharray="3,2" />

      {/* Label background */}
      <Rect x="100" y="42" width="100" height="18" rx="5" fill="rgba(45,106,72,0.15)" />
    </Svg>
  );
}

export default class UserSetup extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      age: '',
      handicap: '',
      handWidth: '',
      armLength: '',
      showHandInfoModal: false,
      showArmInfoModal: false,
      showHandcapInfoModal: false,
      showHandDiagramModal: false,
      showArmDiagramModal: false,
    };
  }

  async componentDidMount() {
    const user = this.props.route.params?.user ?? '';
    const profile = await DB.getUserProfile(user);
    if (profile) {
      this.setState({
        age: profile.age ?? '',
        handicap: profile.handicap ?? '',
        handWidth: profile.handWidth ?? '',
        armLength: profile.armLength ?? '',
      });
    }
  }

  handleSave = async () => {
    const user = this.props.route.params?.user ?? '';
    const { age, handicap, handWidth, armLength } = this.state;

    const profile: DB.UserProfile = {
      age: age.trim() || undefined,
      handicap: handicap.trim() || undefined,
      handWidth: handWidth.trim() || undefined,
      armLength: armLength.trim() || undefined,
    };

    await DB.saveUserProfile(user, profile);

    // Initialize default shot profiles using handicap/age if no clubs exist yet.
    const handicapNum = handicap.trim() ? parseFloat(handicap.trim()) : null;
    const ageNum = age.trim() ? parseInt(age.trim(), 10) : null;
    await DB.initializeDefaultProfiles(user, handicapNum, ageNum);

    await SessionService.continueOrStartSession(user);
    this.props.navigation.navigate('Home', { user });
  };

  handleSkip = async () => {
    const user = this.props.route.params?.user ?? '';
    // Save an empty profile so we don't show this screen again.
    await DB.saveUserProfile(user, {});
    await DB.initializeDefaultProfiles(user);
    await SessionService.continueOrStartSession(user);
    this.props.navigation.navigate('Home', { user });
  };

  render() {
    const {
      age,
      handicap,
      handWidth,
      armLength,
      showHandcapInfoModal,
      showHandInfoModal,
      showArmInfoModal,
      showHandDiagramModal,
      showArmDiagramModal,
    } = this.state;

    return (
      <KeyboardAwareScrollView
        style={[styles.container, { backgroundColor: COLORS.background }]}
        resetScrollToCoords={{ x: 0, y: 0 }}
        contentContainerStyle={{ paddingBottom: 48, paddingTop: 8 }}
        scrollEnabled={true}
      >
        {/* Header */}
        <View style={usStyles.header}>
          <Text style={usStyles.headerTitle}>Player Profile</Text>
          <Text style={usStyles.headerSubtitle}>
            Help us personalize your experience. All fields are optional.
          </Text>
        </View>

        {/* ── Section 1: Golf info ──────────────────────────────────────── */}
        <View style={[styles.card, usStyles.sectionCard]}>
          <View style={usStyles.sectionTitleRow}>
            <Text style={usStyles.sectionTitle}>Golf Information</Text>
            <TouchableOpacity
              style={usStyles.infoBtn}
              onPress={() => this.setState({ showHandcapInfoModal: true })}
            >
              <Text style={usStyles.infoBtnText}>ℹ</Text>
            </TouchableOpacity>
          </View>

          <View style={usStyles.fieldRow}>
            <View style={usStyles.fieldCol}>
              <Text style={styles.label}>Age</Text>
              <TextInput
                style={styles.textInput}
                value={age}
                onChangeText={(t) => this.setState({ age: t })}
                placeholder="e.g. 35"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </View>
            <View style={usStyles.fieldCol}>
              <Text style={styles.label}>Handicap / Index</Text>
              <TextInput
                style={styles.textInput}
                value={handicap}
                onChangeText={(t) => this.setState({ handicap: t })}
                placeholder="e.g. 14"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
              />
            </View>
          </View>
          <Text style={usStyles.hintText}>
            Used to pre-select your starting shot distances. Not required — a standard set will be chosen if left blank.
          </Text>
        </View>

        {/* ── Section 2: Hand width ─────────────────────────────────────── */}
        <View style={[styles.card, usStyles.sectionCard]}>
          <View style={usStyles.sectionTitleRow}>
            <Text style={usStyles.sectionTitle}>Hand Width</Text>
            <TouchableOpacity
              style={usStyles.infoBtn}
              onPress={() => this.setState({ showHandInfoModal: true })}
            >
              <Text style={usStyles.infoBtnText}>ℹ</Text>
            </TouchableOpacity>
          </View>

          <Text style={usStyles.instructionText}>
            Make a fist and measure the distance from your{' '}
            <Text style={usStyles.bold}>ring finger knuckle</Text> to your{' '}
            <Text style={usStyles.bold}>pinky knuckle</Text>.
          </Text>

          <TouchableOpacity
            style={usStyles.diagramBtn}
            onPress={() => this.setState({ showHandDiagramModal: true })}
          >
            <Text style={usStyles.diagramBtnText}>📐  View Diagram</Text>
          </TouchableOpacity>

          <View style={usStyles.measureRow}>
            <TextInput
              style={[styles.textInput, usStyles.measureInput]}
              value={handWidth}
              onChangeText={(t) => this.setState({ handWidth: t })}
              placeholder="e.g. 7.5"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
            />
            <Text style={usStyles.unitLabel}>cm</Text>
          </View>
        </View>

        {/* ── Section 3: Arm length ─────────────────────────────────────── */}
        <View style={[styles.card, usStyles.sectionCard]}>
          <View style={usStyles.sectionTitleRow}>
            <Text style={usStyles.sectionTitle}>Arm Length</Text>
            <TouchableOpacity
              style={usStyles.infoBtn}
              onPress={() => this.setState({ showArmInfoModal: true })}
            >
              <Text style={usStyles.infoBtnText}>ℹ</Text>
            </TouchableOpacity>
          </View>

          <Text style={usStyles.instructionText}>
            Measure (or approximate) your arm length from your{' '}
            <Text style={usStyles.bold}>palm base</Text> to your{' '}
            <Text style={usStyles.bold}>inside shoulder</Text>.
          </Text>

          <TouchableOpacity
            style={usStyles.diagramBtn}
            onPress={() => this.setState({ showArmDiagramModal: true })}
          >
            <Text style={usStyles.diagramBtnText}>📐  View Diagram</Text>
          </TouchableOpacity>

          <View style={usStyles.measureRow}>
            <TextInput
              style={[styles.textInput, usStyles.measureInput]}
              value={armLength}
              onChangeText={(t) => this.setState({ armLength: t })}
              placeholder="e.g. 60"
              placeholderTextColor={COLORS.textMuted}
              keyboardType="numeric"
            />
            <Text style={usStyles.unitLabel}>cm</Text>
          </View>
        </View>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <View style={[styles.buttonRow, { marginHorizontal: 8 }]}>
          <TouchableOpacity style={styles.buttonContainer} onPress={this.handleSkip}>
            <Text style={styles.buttonLabel}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.buttonPrimary} onPress={this.handleSave}>
            <Text style={styles.buttonLabelLight}>Save & Continue</Text>
          </TouchableOpacity>
        </View>

        {/* ══════════════════ Modals ══════════════════════════════════════ */}

        {/* Handicap info */}
        <Modal
          visible={showHandcapInfoModal}
          transparent
          animationType="fade"
          onRequestClose={() => this.setState({ showHandcapInfoModal: false })}
        >
          <TouchableOpacity
            style={usStyles.modalOverlay}
            activeOpacity={1}
            onPress={() => this.setState({ showHandcapInfoModal: false })}
          >
            <View style={usStyles.modalBox}>
              <Text style={usStyles.modalTitle}>Why we ask</Text>
              <Text style={usStyles.modalBody}>
                Your age and handicap / index are used only to choose a sensible
                starting set of target distances for each club. The values are
                stored locally on your device and are never shared.{'\n\n'}
                You can leave these fields blank — a standard set of distances
                will be selected automatically.
              </Text>
              <TouchableOpacity
                style={usStyles.modalCloseBtn}
                onPress={() => this.setState({ showHandcapInfoModal: false })}
              >
                <Text style={usStyles.modalCloseBtnText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Hand width info */}
        <Modal
          visible={showHandInfoModal}
          transparent
          animationType="fade"
          onRequestClose={() => this.setState({ showHandInfoModal: false })}
        >
          <TouchableOpacity
            style={usStyles.modalOverlay}
            activeOpacity={1}
            onPress={() => this.setState({ showHandInfoModal: false })}
          >
            <View style={usStyles.modalBox}>
              <Text style={usStyles.modalTitle}>How is hand width used?</Text>
              <Text style={usStyles.modalBody}>
                Hand width is used as a real-world reference scale when
                estimating left/right distances from a distance photo. By
                knowing how wide your hand is, the app can convert on-screen
                measurements to actual metres or yards.
              </Text>
              <TouchableOpacity
                style={usStyles.modalCloseBtn}
                onPress={() => this.setState({ showHandInfoModal: false })}
              >
                <Text style={usStyles.modalCloseBtnText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Arm length info */}
        <Modal
          visible={showArmInfoModal}
          transparent
          animationType="fade"
          onRequestClose={() => this.setState({ showArmInfoModal: false })}
        >
          <TouchableOpacity
            style={usStyles.modalOverlay}
            activeOpacity={1}
            onPress={() => this.setState({ showArmInfoModal: false })}
          >
            <View style={usStyles.modalBox}>
              <Text style={usStyles.modalTitle}>How is arm length used?</Text>
              <Text style={usStyles.modalBody}>
                Arm length provides a reference when estimating left/right
                distances from far away. When you hold your arm out in a
                photo, the app uses your arm length to translate the
                on-screen pixel measurement into real-world distances.
              </Text>
              <TouchableOpacity
                style={usStyles.modalCloseBtn}
                onPress={() => this.setState({ showArmInfoModal: false })}
              >
                <Text style={usStyles.modalCloseBtnText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Hand width diagram */}
        <Modal
          visible={showHandDiagramModal}
          transparent
          animationType="slide"
          onRequestClose={() => this.setState({ showHandDiagramModal: false })}
        >
          <TouchableOpacity
            style={usStyles.modalOverlay}
            activeOpacity={1}
            onPress={() => this.setState({ showHandDiagramModal: false })}
          >
            <View style={[usStyles.modalBox, usStyles.diagramModalBox]}>
              <Text style={usStyles.modalTitle}>Hand Width Measurement</Text>
              <Text style={usStyles.modalBody}>
                Close your hand into a fist. Measure the distance between the
                knuckle of your <Text style={usStyles.bold}>ring finger</Text>{' '}
                (🔴 red dot) and the knuckle of your{' '}
                <Text style={usStyles.bold}>pinky finger</Text> (🔴 red dot).
              </Text>
              <View style={usStyles.svgContainer}>
                <HandWidthDiagram />
                <Text style={usStyles.svgCaption}>
                  ◀──── Hand width ────▶
                </Text>
              </View>
              <TouchableOpacity
                style={usStyles.modalCloseBtn}
                onPress={() => this.setState({ showHandDiagramModal: false })}
              >
                <Text style={usStyles.modalCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Arm length diagram */}
        <Modal
          visible={showArmDiagramModal}
          transparent
          animationType="slide"
          onRequestClose={() => this.setState({ showArmDiagramModal: false })}
        >
          <TouchableOpacity
            style={usStyles.modalOverlay}
            activeOpacity={1}
            onPress={() => this.setState({ showArmDiagramModal: false })}
          >
            <View style={[usStyles.modalBox, usStyles.diagramModalBox]}>
              <Text style={usStyles.modalTitle}>Arm Length Measurement</Text>
              <Text style={usStyles.modalBody}>
                Measure from the base of your palm (where your wrist meets your
                hand — 🟢 green dot) to your inside shoulder joint (🟢 green
                dot), keeping your arm relaxed at your side.
              </Text>
              <View style={usStyles.svgContainer}>
                <ArmLengthDiagram />
                <Text style={usStyles.svgCaption}>
                  ◀────────── Arm length ──────────▶
                </Text>
              </View>
              <TouchableOpacity
                style={usStyles.modalCloseBtn}
                onPress={() => this.setState({ showArmDiagramModal: false })}
              >
                <Text style={usStyles.modalCloseBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </KeyboardAwareScrollView>
    );
  }
}

const usStyles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textLight,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.accentLight,
    lineHeight: 20,
  },
  sectionCard: {
    marginTop: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  infoBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoBtnText: {
    color: COLORS.textLight,
    fontSize: 14,
    fontWeight: '700',
  },
  fieldRow: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  fieldCol: {
    flex: 1,
    paddingHorizontal: 6,
    marginBottom: 8,
  },
  hintText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 17,
  },
  instructionText: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: 12,
  },
  bold: {
    fontWeight: '700',
  },
  diagramBtn: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  diagramBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryLight,
  },
  measureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  measureInput: {
    flex: 1,
    marginRight: 10,
  },
  unitLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
    width: 30,
  },
  // ── Modals ──────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  diagramModalBox: {
    maxWidth: 480,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  modalBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 16,
  },
  modalCloseBtn: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: COLORS.textLight,
    fontWeight: '700',
    fontSize: 15,
  },
  svgContainer: {
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    padding: 12,
  },
  svgCaption: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
});
