import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import type { AppIconProps } from './AppIcon.types';

export function AppIcon({ family, name, size, color }: AppIconProps) {
  if (family === 'feather') {
    return <Feather name={name as keyof typeof Feather.glyphMap} size={size} color={color} />;
  }
  if (family === 'material') {
    return <MaterialCommunityIcons name={name as keyof typeof MaterialCommunityIcons.glyphMap} size={size} color={color} />;
  }
  return <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={size} color={color} />;
}