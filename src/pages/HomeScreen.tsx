import React, { Component } from 'react';
import { View, Text, Alert, TouchableOpacity, StyleSheet } from 'react-native';
import { styles, COLORS } from '../styles/styles';
import { HomeNavigationProp, HomeRouteProp } from '../types/navigation';
import * as DB from '../data/db';

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

export default class HomeScreen extends Component<Props> {
  componentDidMount() {
    const user = this.props.route.params?.user ?? 'local_user';
    DB.initializeDefaultProfiles(user);
  }

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
        </View>

        {/* Logout bar */}
        <View style={styles.logoutButtonRow}>
          <TouchableOpacity style={styles.logoutButtonContainer} onPress={() => navigate('Login')}>
            <Text style={styles.buttonLabelLight}>Log Out</Text>
          </TouchableOpacity>
        </View>
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
