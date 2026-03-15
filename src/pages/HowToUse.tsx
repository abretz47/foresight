import React, { Component } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS } from '../styles/styles';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';

type HowToUseNavigationProp = StackNavigationProp<RootStackParamList, 'HowToUse'>;

interface Props {
  navigation: HowToUseNavigationProp;
}

interface Step {
  number: number;
  icon: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    number: 1,
    icon: '👤',
    title: 'Create Your Profile',
    body:
      'On the Login screen, type your name and tap Continue. Your name is used to keep your personal shot data separate from other users on the same device.',
  },
  {
    number: 2,
    icon: '🏌️',
    title: 'Set Up Shot Profiles',
    body:
      'Go to Shot Profile from the Home screen. Each shot profile represents a club or shot type. Enter:\n\n• Shot Name — the club or shot (e.g. "7-iron")\n• Target Distance — your expected carry distance in yards\n• Target Radius — the acceptable landing zone radius in yards\n• Miss Radius — the outer boundary for off-target shots in yards\n\nTap Save Shot to store it. You can edit or delete existing profiles at any time.',
  },
  {
    number: 3,
    icon: '📍',
    title: 'Record Your Shots',
    body:
      'Tap Record Data from the Home screen. You will see two concentric circles:\n\n• 🔴 Red inner circle — your target zone\n• ⚪ White outer circle — your miss boundary\n\nAfter each shot at the range, tap where the ball landed on the screen. A confirmation dialog will show the calculated distance and left/right accuracy. Tap Save ✓ to log it, or Cancel to discard.\n\nUse the picker in the bottom-right corner to switch between your shot profiles without leaving the screen.',
  },
  {
    number: 4,
    icon: '📊',
    title: 'Analyze Your Data',
    body:
      'Tap Analyze Data from the Home screen (or toggle the Record/Analyze switch). Your logged shots appear as black dots on the circle diagram.\n\nThe stats bar at the top shows:\n• Left % and average lateral miss distance\n• On-target % and average distance\n• Right % and average lateral miss distance\n\nUse this information to understand your shot dispersion patterns and improve your consistency.',
  },
  {
    number: 5,
    icon: '💡',
    title: 'Tips',
    body:
      '• Start by recording 10–20 shots per club to get meaningful stats.\n• If you change your swing or club setup, delete old shot data when saving an updated profile so your analysis stays accurate.\n• The concentric circle diagram scales automatically — the outer circle always represents your Miss Radius.\n• Shots outside the white circle are counted as "off target" and excluded from distance averages.',
  },
];

export default class HowToUse extends Component<Props> {
  render() {
    return (
      <View style={howStyles.root}>
        <ScrollView
          style={howStyles.scroll}
          contentContainerStyle={howStyles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={howStyles.header}>
            <Text style={howStyles.headerEmoji}>📖</Text>
            <Text style={howStyles.headerTitle}>How To Use Foresight</Text>
            <Text style={howStyles.headerSubtitle}>
              Follow these steps to start tracking and improving your golf game
            </Text>
          </View>

          {/* Steps */}
          {STEPS.map((step) => (
            <View key={step.number} style={howStyles.stepCard}>
              <View style={howStyles.stepHeader}>
                <View style={howStyles.stepBadge}>
                  <Text style={howStyles.stepBadgeText}>{step.number}</Text>
                </View>
                <Text style={howStyles.stepIcon}>{step.icon}</Text>
                <Text style={howStyles.stepTitle}>{step.title}</Text>
              </View>
              <Text style={howStyles.stepBody}>{step.body}</Text>
            </View>
          ))}

          {/* CTA */}
          <TouchableOpacity
            style={howStyles.ctaButton}
            onPress={() => this.props.navigation.goBack()}
          >
            <Text style={howStyles.ctaLabel}>Got it — let's play! 🏌️</Text>
          </TouchableOpacity>

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    );
  }
}

const howStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  // Step cards
  stepCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 5,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  stepBadgeText: {
    color: COLORS.textLight,
    fontWeight: '800',
    fontSize: 13,
  },
  stepIcon: {
    fontSize: 22,
    marginRight: 8,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    flex: 1,
  },
  stepBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },

  // CTA
  ctaButton: {
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: 'rgba(0,0,0,0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 5,
  },
  ctaLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: 0.3,
  },
});
