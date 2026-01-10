/**
 * Network Status Banner Component
 *
 * Displays a banner when the device is offline or has poor network connectivity.
 * Shows sync status indicators for cart operations and other background processes.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Animated,
  Dimensions,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { useNetworkStatus } from "../../utils/networkStatus";

const { width } = Dimensions.get("window");

interface NetworkStatusBannerProps {
  visible?: boolean;
  onRetry?: () => void;
  syncStatus?: "idle" | "syncing" | "success" | "error";
  showConnectionQuality?: boolean;
}

export const NetworkStatusBanner: React.FC<NetworkStatusBannerProps> = ({
  visible = true,
  onRetry,
  syncStatus = "idle",
  showConnectionQuality = true,
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const {
    isOnline,
    connectionQuality,
    isConnectionGood,
    isConnectionExpensive,
    getNetworkSummary,
  } = useNetworkStatus();

  const [fadeAnim] = React.useState(new Animated.Value(0));
  const [bannerHeight] = React.useState(new Animated.Value(0));

  const shouldShow =
    visible && (!isOnline || (!isConnectionGood() && showConnectionQuality));

  React.useEffect(() => {
    if (shouldShow) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(bannerHeight, {
          toValue: 60,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(bannerHeight, {
          toValue: 0,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [shouldShow, fadeAnim, bannerHeight]);

  const getBannerContent = () => {
    if (!isOnline) {
      return {
        icon: "cloud-offline-outline" as const,
        message: "You're offline. Some features may be limited.",
        color: theme.colors.textSecondary,
        backgroundColor: theme.colors.bgElev2,
      };
    }

    if (connectionQuality.level === "poor") {
      return {
        icon: "cellular-outline" as const,
        message: "Slow connection detected. Loading may be slower.",
        color: theme.colors.warning,
        backgroundColor: "rgba(255, 149, 0, 0.1)",
      };
    }

    if (isConnectionExpensive()) {
      return {
        icon: "warning-outline" as const,
        message: "Using cellular data. Data charges may apply.",
        color: theme.colors.warning,
        backgroundColor: "rgba(255, 149, 0, 0.1)",
      };
    }

    return null;
  };

  const getSyncIndicator = () => {
    switch (syncStatus) {
      case "syncing":
        return {
          icon: "sync-outline" as const,
          color: "#007AFF",
          message: "Syncing...",
        };
      case "success":
        return {
          icon: "checkmark-circle-outline" as const,
          color: theme.colors.success,
          message: "Synced",
        };
      case "error":
        return {
          icon: "alert-circle-outline" as const,
          color: theme.colors.danger,
          message: "Sync failed",
        };
      default:
        return null;
    }
  };

  const bannerContent = getBannerContent();
  const syncIndicator = getSyncIndicator();

  if (!shouldShow && syncStatus === "idle") {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: bannerHeight,
          opacity: fadeAnim,
          backgroundColor:
            bannerContent?.backgroundColor || theme.colors.bgElev1,
        },
      ]}
    >
      <View style={styles.content}>
        <View style={styles.leftContent}>
          {bannerContent && (
            <Ionicons
              name={bannerContent.icon}
              size={20}
              color={bannerContent.color}
              style={styles.icon}
            />
          )}
          <Text
            style={[styles.message, { color: bannerContent?.color || "white" }]}
          >
            {bannerContent?.message || ""}
          </Text>
        </View>

        <View style={styles.rightContent}>
          {syncIndicator && (
            <View style={styles.syncContainer}>
              <Ionicons
                name={syncIndicator.icon}
                size={16}
                color={syncIndicator.color}
                style={styles.syncIcon}
              />
              <Text style={[styles.syncText, { color: syncIndicator.color }]}>
                {syncIndicator.message}
              </Text>
            </View>
          )}

          {onRetry && !isOnline && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={onRetry}
              accessibilityLabel="Retry connection"
              accessibilityRole="button"
            >
              <Ionicons
                name="refresh-outline"
                size={16}
                color={theme.colors.textPrimary}
              />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: Theme) =>
  ({
    container: {
      width: width,
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderSubtle,
    },
    content: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    leftContent: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
    },
    rightContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    icon: {
      marginRight: 8,
    },
    message: {
      fontSize: 14,
      fontWeight: "500",
      flex: 1,
    },
    syncContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    syncIcon: {
      // Animation could be added here for syncing state
    },
    syncText: {
      fontSize: 12,
      fontWeight: "500",
    },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      gap: 4,
    },
    retryText: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontWeight: "600",
    },
  } as const);

/**
 * Hook for managing network status banner visibility and sync status
 */
export const useNetworkStatusBanner = () => {
  const [syncStatus, setSyncStatus] = React.useState<
    "idle" | "syncing" | "success" | "error"
  >("idle");
  const [visible, setVisible] = React.useState(true);

  const showSyncStatus = React.useCallback(
    (status: "syncing" | "success" | "error") => {
      setSyncStatus(status);

      // Auto-hide success/error status after delay
      if (status === "success" || status === "error") {
        setTimeout(() => {
          setSyncStatus("idle");
        }, 3000);
      }
    },
    []
  );

  const hideBanner = React.useCallback(() => {
    setVisible(false);
  }, []);

  const showBanner = React.useCallback(() => {
    setVisible(true);
  }, []);

  return {
    syncStatus,
    visible,
    showSyncStatus,
    hideBanner,
    showBanner,
  };
};

export default NetworkStatusBanner;
