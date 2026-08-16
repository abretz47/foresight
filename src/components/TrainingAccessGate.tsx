/**
 * TrainingAccessGate
 *
 * Single entry point for the Training Modules feature.  Called when the user
 * taps "Training Modules" in the hamburger menu.  Handles all platform and
 * entitlement routing:
 *
 *   1. Not cloud mode → alert to sign in / create cloud account
 *   2. Cloud, web → navigate to TrainingHome (Buy buttons handle per-module gating)
 *   3. Cloud, native, no training entitlements → show PurchasePromptModal
 *   4. Cloud, native, has any training entitlement → navigate to TrainingHome
 */
import React, { useState } from 'react';
import { Platform, Alert } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import PurchasePromptModal from './PurchasePromptModal';
import { hasAnyEntitlementOfType, refreshSession } from '../lib/entitlementService';
import * as DB from '../data/db';
import type { RootStackParamList } from '../types/navigation';

interface Props {
  navigation: StackNavigationProp<RootStackParamList>;
  user?: string;
  onClose: () => void;
}

export default function TrainingAccessGate({ navigation, user, onClose }: Props) {
  const [purchaseModalVisible, setPurchaseModalVisible] = useState(false);

  // Called when the modal closes — refresh entitlements in case the user just
  // purchased in their browser (native fallback: refresh on modal dismiss).
  const handleModalClose = () => {
    setPurchaseModalVisible(false);
    void refreshSession();
  };

  // Entry-point logic — called as soon as the component is rendered.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      // 1. Must be cloud mode.
      if (!DB.isCloudMode()) {
        Alert.alert(
          'Cloud Account Required',
          'Training Modules require a Foresight cloud account. Please sign in or create an account to continue.',
          [{ text: 'OK', onPress: onClose }],
        );
        return;
      }

      // 2. Web users go straight to Training Home; per-module Buy buttons handle
      //    individual entitlement gating there.
      if (Platform.OS === 'web') {
        onClose();
        navigation.navigate('TrainingHome', { user: user ?? '' });
        return;
      }

      // 3. Native: require at least one training entitlement to enter Training Home.
      const hasTrainingAccess = await hasAnyEntitlementOfType('training');
      if (cancelled) return;

      if (!hasTrainingAccess) {
        setPurchaseModalVisible(true);
        return;
      }

      // 4. All good — navigate to Training Home.
      onClose();
      navigation.navigate('TrainingHome', { user: user ?? '' });
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PurchasePromptModal
      visible={purchaseModalVisible}
      onClose={handleModalClose}
    />
  );
}
