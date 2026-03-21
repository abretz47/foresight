/**
 * EmojiText – a drop-in replacement for <Text> when displaying emoji characters.
 *
 * On iOS 18 (macOS Sequoia simulator and later) React Native's text layout engine
 * applies NSKernAttributeName when letterSpacing is present (even via inherited
 * styles), which prevents the system from selecting the Apple Color Emoji glyph.
 * Setting `letterSpacing: 0` explicitly and disabling font scaling ensures the
 * system emoji font is always picked and rendered at the expected size.
 */
import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

interface EmojiTextProps extends TextProps {
  children: React.ReactNode;
}

export default function EmojiText({ children, style, ...props }: EmojiTextProps) {
  return (
    <Text style={[styles.emoji, style]} allowFontScaling={false} {...props}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  emoji: {
    letterSpacing: 0,
  },
});
