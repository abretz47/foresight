import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../styles/styles';

interface Props {
  priceId: string;
}

export default function EmbeddedStripeCheckout({ priceId }: Props) {
  void priceId;
  return (
    <View style={s.fallback}>
      <Text style={s.fallbackText}>Embedded checkout is available on web only.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fallback: {
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.surfaceAlt,
  },
  fallbackText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
});
