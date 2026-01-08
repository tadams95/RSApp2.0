/**
 * PlatformBadge Component
 * Displays a small badge/icon indicating the music platform
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  getMusicPlatformConfig,
  MusicPlatform,
} from "../../utils/musicPlatforms";

// ============================================
// Types
// ============================================

interface PlatformBadgeProps {
  /** The music platform to display */
  platform: MusicPlatform;
  /** Size variant */
  size?: "small" | "medium" | "large";
  /** Whether to show the platform name text */
  showLabel?: boolean;
  /** Custom style overrides */
  style?: object;
}

// ============================================
// Size Configurations
// ============================================

const SIZE_CONFIG = {
  small: {
    iconSize: 12,
    badgeSize: 20,
    fontSize: 9,
    borderRadius: 4,
  },
  medium: {
    iconSize: 14,
    badgeSize: 24,
    fontSize: 10,
    borderRadius: 5,
  },
  large: {
    iconSize: 18,
    badgeSize: 32,
    fontSize: 12,
    borderRadius: 6,
  },
};

// ============================================
// Component
// ============================================

export default function PlatformBadge({
  platform,
  size = "small",
  showLabel = false,
  style,
}: PlatformBadgeProps) {
  const config = getMusicPlatformConfig(platform);
  const sizeConfig = SIZE_CONFIG[size];

  // Don't render badge for unknown platform
  if (platform === "unknown") {
    return null;
  }

  return (
    <View
      style={[styles.container, showLabel && styles.containerWithLabel, style]}
      accessible={true}
      accessibilityLabel={`${config.name} music`}
      accessibilityRole="text"
    >
      <View
        style={[
          styles.badge,
          {
            backgroundColor: config.color,
            width: sizeConfig.badgeSize,
            height: sizeConfig.badgeSize,
            borderRadius: sizeConfig.borderRadius,
          },
        ]}
      >
        <MaterialCommunityIcons
          name={config.icon as any}
          size={sizeConfig.iconSize}
          color="#fff"
        />
      </View>

      {showLabel && (
        <Text
          style={[
            styles.label,
            { fontSize: sizeConfig.fontSize, color: config.color },
          ]}
          numberOfLines={1}
        >
          {config.name}
        </Text>
      )}
    </View>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
  },
  containerWithLabel: {
    gap: 4,
  },
  badge: {
    justifyContent: "center",
    alignItems: "center",
    // Shadow for slight elevation
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  label: {
    fontWeight: "600",
  },
});
