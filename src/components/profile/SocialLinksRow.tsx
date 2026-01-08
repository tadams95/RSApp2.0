import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  Alert,
  Linking,
  Platform,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { usePostHog } from "../../analytics/PostHogProvider";
import { GlobalStyles } from "../../constants/styles";
import {
  getOpenableUrl,
  getSocialDeepLink,
  hasSocialLinks,
  SOCIAL_PLATFORMS,
  SocialPlatform,
} from "../../utils/socialLinks";
import { InstagramLogo, TikTokLogo, XLogo } from "../icons";

// ============================================
// Types
// ============================================

interface SocialLinksRowProps {
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    tiktok?: string;
    soundcloud?: string;
    spotify?: string;
    youtube?: string;
  };
  userId?: string;
  isOwnProfile?: boolean;
}

interface SocialIconProps {
  platform: SocialPlatform;
  url: string;
  userId?: string;
  isOwnProfile?: boolean;
  onPress: () => void;
}

// ============================================
// SocialIcon Component
// ============================================

function SocialIcon({
  platform,
  url,
  userId,
  isOwnProfile,
  onPress,
}: SocialIconProps) {
  const config = SOCIAL_PLATFORMS[platform];
  const { capture } = usePostHog();

  const handlePress = async () => {
    // Light haptic feedback (vibration fallback for Android)
    if (Platform.OS === "ios") {
      // iOS has built-in haptic support through react-native
      Vibration.vibrate(10);
    } else {
      Vibration.vibrate(50);
    }

    // Track analytics
    capture("social_link_tapped", {
      platform: platform,
      profile_user_id: userId || null,
      is_own_profile: isOwnProfile || false,
    });

    // Try deep link first, then fall back to web URL
    const deepLink = getSocialDeepLink(url, platform);
    const webUrl = getOpenableUrl(url, platform);

    // Attempt to open deep link if available
    if (deepLink) {
      try {
        const canOpen = await Linking.canOpenURL(deepLink);
        if (canOpen) {
          await Linking.openURL(deepLink);
          onPress();
          return;
        }
      } catch (error) {
        // Deep link failed, will try web URL
        console.log(`Deep link not available for ${platform}, using web URL`);
      }
    }

    // Fall back to web URL
    if (webUrl) {
      try {
        const canOpen = await Linking.canOpenURL(webUrl);
        if (canOpen) {
          await Linking.openURL(webUrl);
        } else {
          // Show user-friendly error
          Alert.alert(
            "Unable to Open Link",
            `Could not open ${config.name}. The URL may be invalid or the app is not installed.`,
            [{ text: "OK" }]
          );
        }
      } catch (error) {
        console.error(`Failed to open ${platform} URL:`, error);
        Alert.alert(
          "Unable to Open Link",
          `Something went wrong while trying to open ${config.name}. Please try again later.`,
          [{ text: "OK" }]
        );
      }
    } else {
      // No valid URL to open
      Alert.alert(
        "Invalid Link",
        `This ${config.name} link appears to be invalid.`,
        [{ text: "OK" }]
      );
    }

    onPress();
  };

  return (
    <TouchableOpacity
      style={styles.iconButton}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="link"
      accessibilityLabel={`${config.name} profile link`}
      accessibilityHint={`Double tap to open ${config.name} profile in browser or app`}
      accessibilityState={{ disabled: false }}
    >
      <View
        style={styles.iconContainer}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        {platform === "twitter" ? (
          <XLogo size={18} color={GlobalStyles.colors.grey3} />
        ) : platform === "instagram" ? (
          <InstagramLogo size={18} color={GlobalStyles.colors.grey3} />
        ) : platform === "tiktok" ? (
          <TikTokLogo size={18} color={GlobalStyles.colors.grey3} />
        ) : (
          <MaterialCommunityIcons
            name={config.icon as any}
            size={18}
            color={GlobalStyles.colors.grey3}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ============================================
// SocialLinksRow Component
// ============================================

export default function SocialLinksRow({
  socialLinks,
  userId,
  isOwnProfile,
}: SocialLinksRowProps) {
  // Don't render if no social links exist
  if (!hasSocialLinks(socialLinks)) {
    return null;
  }

  // Define the order of platforms to display
  const platformOrder: SocialPlatform[] = [
    "twitter",
    "instagram",
    "tiktok",
    "soundcloud",
    "spotify",
    "youtube",
  ];

  // Filter to only platforms that have URLs
  const activePlatforms = platformOrder.filter(
    (platform) =>
      socialLinks?.[platform] && socialLinks[platform]!.trim().length > 0
  );

  if (activePlatforms.length === 0) {
    return null;
  }

  return (
    <View
      style={styles.container}
      accessibilityRole="list"
      accessibilityLabel={`Social media links, ${activePlatforms.length} available`}
    >
      {activePlatforms.map((platform) => (
        <SocialIcon
          key={platform}
          platform={platform}
          url={socialLinks![platform]!}
          userId={userId}
          isOwnProfile={isOwnProfile}
          onPress={() => {
            // Additional callback if needed in future
          }}
        />
      ))}
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
    marginTop: 8,
    gap: 8,
  },
  iconButton: {
    padding: 4,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: GlobalStyles.colors.grey8,
    justifyContent: "center",
    alignItems: "center",
  },
});
