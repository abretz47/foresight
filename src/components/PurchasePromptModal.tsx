/**
 * PurchasePromptModal  (native)
 * Shown to native users who have a cloud session but lack any
 * `training:*` entitlement. Displays an informational message and a
 * link that opens the web Purchase Page in the device browser.
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { COLORS } from '../styles/styles';
import EmojiText from './EmojiText';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? '';

export default function PurchasePromptModal({ visible, onClose }: Props) {
  const purchaseUrl = WEB_APP_URL ? WEB_APP_URL + '/purchase' : '';

  const handleOpenBrowser = () => {
    if (purchaseUrl) {
      void Linking.openURL(purchaseUrl);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose}>
        <View style={s.box}>
          <EmojiText style={s.icon}>🏆</EmojiText>
          <Text style={s.title}>Purchase Training Module</Text>
          <Text style={s.body}>
            Individual training modules are purchased on the Foresight website. Your entitlements
            will sync automatically when you return to the app.
          </Text>
          {purchaseUrl ? (
            <TouchableOpacity style={s.primaryBtn} onPress={handleOpenBrowser}>
              <Text style={s.primaryBtnLabel}>View Purchase Options</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={s.secondaryBtn} onPress={onClose}>
            <Text style={s.secondaryBtnLabel}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
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
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  icon: { fontSize: 44, marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 12, textAlign: 'center' },
  body: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 21, textAlign: 'center', marginBottom: 24 },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 28,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnLabel: { fontWeight: '700', color: COLORS.textPrimary, fontSize: 15 },
  secondaryBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    width: '100%',
  },
  secondaryBtnLabel: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },
});
