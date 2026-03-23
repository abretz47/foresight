/**
 * HamburgerMenu
 *
 * A reusable ☰ button + slide-over modal menu that can be mounted as the
 * `headerRight` on any screen in the navigation stack.  It accepts optional
 * `user` and `navigation` props so menu actions work from any screen.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  StyleSheet,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as DB from '../data/db';
import { COLORS } from '../styles/styles';
import EmojiText from './EmojiText';
import type { RootStackParamList } from '../types/navigation';

interface Props {
  navigation: StackNavigationProp<RootStackParamList>;
  user?: string;
}

export default function HamburgerMenu({ navigation, user }: Props) {
  const [menuVisible, setMenuVisible] = useState(false);
  const { navigate } = navigation;

  const navigateToRecord = (calledFrom: 'Record' | 'Analyze') => {
    if (!user) return;
    setMenuVisible(false);
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
            { text: 'Go to Shot Profile', onPress: () => navigate('ShotProfile', { user: user! }) },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    });
  };

  const menuItems = [
    user && {
      icon: '🏌️',
      label: 'Shot Profile',
      onPress: () => { setMenuVisible(false); navigate('ShotProfile', { user }); },
    },
    user && {
      icon: '📍',
      label: 'Record Data',
      onPress: () => navigateToRecord('Record'),
    },
    user && {
      icon: '📊',
      label: 'Analyze Data',
      onPress: () => navigateToRecord('Analyze'),
    },
    {
      icon: '❓',
      label: 'How To Use',
      onPress: () => { setMenuVisible(false); navigate('HowToUse'); },
    },
    {
      icon: '🚪',
      label: 'Log Out',
      onPress: () => { setMenuVisible(false); navigate('Login'); },
    },
  ].filter(Boolean) as { icon: string; label: string; onPress: () => void }[];

  return (
    <>
      <TouchableOpacity
        style={menuStyles.headerBtn}
        onPress={() => setMenuVisible(true)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={menuStyles.headerBtnText}>☰</Text>
      </TouchableOpacity>

      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          style={menuStyles.overlay}
          activeOpacity={1}
          onPress={() => setMenuVisible(false)}
        >
          <View style={menuStyles.box}>
            <Text style={menuStyles.title}>Menu</Text>
            {menuItems.map((item) => (
              <TouchableOpacity key={item.label} style={menuStyles.item} onPress={item.onPress}>
                <EmojiText style={menuStyles.itemIcon}>{item.icon}</EmojiText>
                <Text style={menuStyles.itemLabel}>{item.label}</Text>
                <Text style={menuStyles.itemChevron}>›</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={menuStyles.closeBtn}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={menuStyles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const menuStyles = StyleSheet.create({
  headerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerBtnText: {
    color: COLORS.textLight,
    fontSize: 22,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  box: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemIcon: {
    fontSize: 22,
    marginRight: 14,
  },
  itemLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  itemChevron: {
    fontSize: 22,
    color: COLORS.textSecondary,
  },
  closeBtn: {
    marginTop: 16,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  closeBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
});
