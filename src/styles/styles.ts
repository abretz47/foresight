import { StyleSheet, Platform } from 'react-native';

// Design tokens
export const COLORS = {
  primary: '#1A3C2A',       // deep forest green
  primaryLight: '#2D6A48',  // medium green
  accent: '#C9A84C',        // gold
  accentLight: '#F0D080',   // light gold
  danger: '#D94F3D',        // modern red
  dangerLight: '#F28779',   // light red
  success: '#2D7A4F',       // success green
  background: '#0F2E1E',    // very dark green
  surface: '#FFFFFF',       // white cards
  surfaceAlt: '#F5F7F5',    // light green-white
  textPrimary: '#1A1A1A',   // near black
  textSecondary: '#5A6B60', // muted green-grey
  textLight: '#FFFFFF',     // white
  textMuted: '#9EAD9E',     // light muted
  border: '#D8E4DC',        // subtle border
  shadow: 'rgba(0,0,0,0.18)',
  overlay: 'rgba(15,46,30,0.85)',
};

const shadow = Platform.select({
  ios: {
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  android: { elevation: 6 },
  default: { elevation: 6 },
});

export const styles = StyleSheet.create({
  // ── Backgrounds ──────────────────────────────────────────────
  template: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ── Layout ───────────────────────────────────────────────────
  container: {
    flex: 1,
  },
  homeContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  touchableContainer: {
    flex: 1,
    justifyContent: 'center',
  },

  // ── Rows / Columns ───────────────────────────────────────────
  buttonRow: {
    flexDirection: 'row',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginHorizontal: 8,
  },
  column: {
    flexDirection: 'column',
    justifyContent: 'center',
    padding: 12,
  },
  componentRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },

  // ── Cards ─────────────────────────────────────────────────────
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 16,
    marginVertical: 8,
    ...shadow,
  },

  // ── Buttons ───────────────────────────────────────────────────
  buttonContainer: {
    flex: 1,
    margin: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    ...shadow,
  },
  buttonPrimary: {
    flex: 1,
    margin: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    ...shadow,
  },
  buttonDanger: {
    backgroundColor: COLORS.danger,
    margin: 8,
    flex: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    ...shadow,
  },
  buttonSuccess: {
    flex: 1,
    margin: 8,
    backgroundColor: COLORS.success,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    ...shadow,
  },
  buttonAccent: {
    flex: 1,
    margin: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    ...shadow,
  },
  buttonLabel: {
    fontWeight: '700',
    fontSize: 16,
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
  buttonLabelLight: {
    fontWeight: '700',
    fontSize: 16,
    color: COLORS.textLight,
    letterSpacing: 0.3,
  },

  // ── Logout Bar ────────────────────────────────────────────────
  logoutButtonContainer: {
    position: 'relative',
    backgroundColor: COLORS.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
  },
  logoutButtonRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },

  // ── Typography ────────────────────────────────────────────────
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  labelLight: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  smallLabel: {
    fontWeight: '600',
    color: COLORS.textPrimary,
    fontSize: 13,
  },
  startBtn: {
    color: COLORS.textPrimary,
  },

  // ── Inputs ────────────────────────────────────────────────────
  textInput: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
    borderWidth: 1.5,
    height: 50,
    fontSize: 16,
    fontWeight: '600',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: COLORS.textPrimary,
  },

  // ── Modal ─────────────────────────────────────────────────────
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBottom: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalButton: {
    backgroundColor: COLORS.primaryLight,
    padding: 12,
    margin: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    ...shadow,
  },

  // ── Target / Circle ───────────────────────────────────────────
  target: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
    backgroundColor: '#E53935',
  },
  roundButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 200,
  },
  circleLabelTop: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  circleLabelBottom: {
    position: 'absolute',
    bottom: 4,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  circleLabelInnerTop: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: '600',
  },
  circleLabelInnerBottom: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    textAlign: 'center',
    fontSize: 11,
    color: COLORS.textLight,
    fontWeight: '600',
  },

  // ── Slider / Toggle Row ───────────────────────────────────────
  sliderRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
  },
  sliderLabel: {
    fontWeight: '700',
    marginHorizontal: 12,
    fontSize: 14,
    color: COLORS.textLight,
    letterSpacing: 0.5,
  },

  // ── Stats Row ─────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.primary,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontWeight: '700',
    fontSize: 10,
    textAlign: 'center',
    color: COLORS.accentLight,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 14,
    textAlign: 'center',
    color: COLORS.textLight,
    fontWeight: '600',
  },
});
