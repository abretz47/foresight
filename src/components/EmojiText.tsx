/**
 * EmojiText – a drop-in replacement for <Text> when displaying emoji characters.
 *
 * On iOS 18 through iOS 26 (macOS Sequoia / macOS 26 and later) React Native's
 * text layout engine applies NSKernAttributeName when letterSpacing is present
 * (even via inherited styles), which prevents the system from selecting the
 * Apple Color Emoji glyph and causes emoji to render as blank boxes or text.
 *
 * Fix: place `styles.emoji` LAST in the style array so its `letterSpacing: 0`
 * always takes final precedence over any letterSpacing in the caller's style prop.
 * `allowFontScaling={false}` prevents Dynamic Type from distorting emoji sizes.
 */
import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

interface EmojiTextProps extends TextProps {
  children: React.ReactNode;
}

export default function EmojiText({ children, style, ...props }: EmojiTextProps) {
  return (
    <Text style={[style, styles.emoji]} allowFontScaling={false} {...props}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  emoji: {
    letterSpacing: 0,
  },
});
