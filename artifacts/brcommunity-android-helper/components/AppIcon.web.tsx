import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { AppIconProps } from './AppIcon.types';

const glyphs: Record<string, string> = {
  'account-multiple-outline': '♙',
  'alert-circle': '!',
  'arrow-up-right': '↗',
  browsers: '▣',
  'browsers-outline': '▣',
  clock: '◷',
  close: '×',
  'close-circle': '×',
  'logo-instagram': '◎',
  'logo-youtube': '▶',
  'log-out': '↪',
  minus: '−',
  options: '⚙',
  'options-outline': '⚙',
  plus: '+',
  play: '▶',
  'play-circle-outline': '◉',
  refresh: '↻',
  'refresh-cw': '↻',
  stop: '■',
  x: '×',
  heart: '♡',
  'open-outline': '↗',
  home: '⌂',
  instagram: '◎',
  youtube: '▶',
  'google-chrome': '◉',
};

export function AppIcon({ name, size, color }: AppIconProps) {
  return <Text accessibilityElementsHidden style={[styles.icon, { color, fontSize: size, lineHeight: size + 3 }]}>{glyphs[name] || '•'}</Text>;
}

const styles = StyleSheet.create({
  icon: { textAlign: 'center', includeFontPadding: false },
});