import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { memo, useCallback } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { ImageWithFallback } from "../ui";

// Utility for haptic feedback (uses native iOS/Android haptics without extra dependency)
const triggerHaptic = () => {
  // On iOS, selection feedback is handled natively by TouchableOpacity
  // On Android, we can use the native Vibration API for light feedback
  if (Platform.OS === "android") {
    try {
      const { Vibration } = require("react-native");
      Vibration.vibrate(10); // Very short vibration
    } catch {
      // Ignore if vibration fails
    }
  }
};

/**
 * User data for mention autocomplete
 */
export interface MentionUser {
  uid: string;
  username: string;
  displayName: string;
  profilePicture?: string;
  verified?: boolean;
}

interface MentionUserRowProps {
  user: MentionUser;
  onPress: () => void;
}

/**
 * MentionUserRow - Renders a single user suggestion in the autocomplete dropdown
 *
 * Displays avatar, username, verified badge, and display name
 */
export const MentionUserRow: React.FC<MentionUserRowProps> = memo(
  ({ user, onPress }) => {
    const { theme } = useTheme();
    const styles = useThemedStyles(createStyles);

    const handlePress = useCallback(() => {
      triggerHaptic();
      onPress();
    }, [onPress]);

    const getInitials = (name: string): string => {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    };

    return (
      <TouchableOpacity
        style={styles.container}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Select @${user.username}`}
        accessibilityHint={`Tag ${user.displayName} in your post`}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {user.profilePicture ? (
            <ImageWithFallback
              source={{ uri: user.profilePicture }}
              fallbackSource={require("../../assets/user.png")}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {getInitials(user.displayName || user.username)}
              </Text>
            </View>
          )}
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <View style={styles.usernameRow}>
            <Text style={styles.username} numberOfLines={1}>
              @{user.username}
            </Text>
            {user.verified && (
              <MaterialCommunityIcons
                name="check-decagram"
                size={14}
                color={theme.colors.accent}
                style={styles.verifiedBadge}
              />
            )}
          </View>
          <Text style={styles.displayName} numberOfLines={1}>
            {user.displayName}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }
);

MentionUserRow.displayName = "MentionUserRow";

const createStyles = (theme: import("../../constants/themes").Theme) => ({
  container: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderSubtle,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.bgElev2,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: theme.colors.textSecondary,
  },
  userInfo: {
    flex: 1,
  },
  usernameRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  username: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
  },
  verifiedBadge: {
    marginLeft: 4,
  },
  displayName: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
});

export default MentionUserRow;
