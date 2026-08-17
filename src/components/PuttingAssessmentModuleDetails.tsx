import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { COLORS } from '../styles/styles';
import EmojiText from './EmojiText';
import type { TrainingModuleDetailsProps } from '../lib/trainingModuleRegistry';

export default function PuttingAssessmentModuleDetails({ module, owned, onStart }: TrainingModuleDetailsProps) {
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>
      {module.thumbnail_url ? (
        <Image source={{ uri: module.thumbnail_url }} style={s.thumbnail} resizeMode="cover" />
      ) : (
        <View style={s.thumbnailFallback}>
          <EmojiText style={s.thumbnailEmoji}>🏌️</EmojiText>
        </View>
      )}
      <Text style={s.title}>{module.title}</Text>
      <Text style={s.description}>{module.description}</Text>
      {owned ? (
        <TouchableOpacity style={s.startBtn} onPress={onStart} activeOpacity={0.85}>
          <Text style={s.startBtnLabel}>Start Drill</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.lockedBox}>
          <EmojiText style={s.lockedIcon}>🔒</EmojiText>
          <Text style={s.lockedText}>Purchase this module to start the drill.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 48 },
  thumbnail: { width: '100%', height: 220, borderRadius: 16, marginBottom: 20 },
  thumbnailFallback: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  thumbnailEmoji: { fontSize: 68 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.textLight, marginBottom: 12 },
  description: { fontSize: 16, color: COLORS.textMuted, lineHeight: 24, marginBottom: 32 },
  startBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnLabel: { fontWeight: '800', fontSize: 17, color: COLORS.textPrimary },
  lockedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  lockedIcon: { fontSize: 24 },
  lockedText: { flex: 1, color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
});
