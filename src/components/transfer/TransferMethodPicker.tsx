import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { usePostHog } from "../../analytics/PostHogProvider";
import { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";

// ============================================
// Types
// ============================================

export type TransferMethod = "qr" | "username" | "email";

export interface TransferMethodPickerProps {
  /** Callback when QR scan is selected */
  onSelectQR: () => void;
  /** Callback when @Username is selected */
  onSelectUsername: () => void;
  /** Callback when Email is selected */
  onSelectEmail: () => void;
  /** Event ID for analytics tracking */
  eventId?: string;
  /** Ticket ID for analytics tracking */
  ticketId?: string;
  /** Disabled state for the picker */
  disabled?: boolean;
}

interface MethodButtonProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  sublabel: string;
  onPress: () => void;
  disabled?: boolean;
  theme: Theme;
  styles: ReturnType<typeof createStyles>;
}

// ============================================
// MethodButton Component
// ============================================

function MethodButton({
  icon,
  label,
  sublabel,
  onPress,
  disabled,
  theme,
  styles,
}: MethodButtonProps) {
  const handlePress = () => {
    // Light haptic feedback
    if (Platform.OS === "ios") {
      Vibration.vibrate(10);
    } else {
      Vibration.vibrate(50);
    }
    onPress();
  };

  return (
    <TouchableOpacity
      style={[styles.methodButton, disabled && styles.methodButtonDisabled]}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={sublabel}
      accessibilityState={{ disabled }}
    >
      <View style={styles.iconWrapper}>
        <MaterialCommunityIcons
          name={icon}
          size={28}
          color={disabled ? theme.colors.textTertiary : theme.colors.accent}
        />
      </View>
      <View style={styles.labelContainer}>
        <Text style={[styles.methodLabel, disabled && styles.textDisabled]}>
          {label}
        </Text>
        <Text style={[styles.methodSublabel, disabled && styles.textDisabled]}>
          {sublabel}
        </Text>
      </View>
      <MaterialCommunityIcons
        name="chevron-right"
        size={24}
        color={
          disabled ? theme.colors.textTertiary : theme.colors.textSecondary
        }
      />
    </TouchableOpacity>
  );
}

// ============================================
// TransferMethodPicker Component
// ============================================

export default function TransferMethodPicker({
  onSelectQR,
  onSelectUsername,
  onSelectEmail,
  eventId,
  ticketId,
  disabled = false,
}: TransferMethodPickerProps) {
  const posthog = usePostHog();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const handleMethodSelect = (method: TransferMethod, callback: () => void) => {
    // Track analytics
    posthog?.capture("transfer_method_selected", {
      method,
      event_id: eventId || null,
      ticket_id: ticketId || null,
      screen_context: "transfer_method_picker",
    });

    callback();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How would you like to transfer?</Text>
      <Text style={styles.subtitle}>
        Choose a method to send your ticket to someone
      </Text>

      <View style={styles.methodsContainer}>
        <MethodButton
          icon="qrcode-scan"
          label="Scan QR Code"
          sublabel="Scan recipient's profile QR"
          onPress={() => handleMethodSelect("qr", onSelectQR)}
          disabled={disabled}
          theme={theme}
          styles={styles}
        />

        <MethodButton
          icon="at"
          label="@Username"
          sublabel="Search by username"
          onPress={() => handleMethodSelect("username", onSelectUsername)}
          disabled={disabled}
          theme={theme}
          styles={styles}
        />

        <MethodButton
          icon="email-outline"
          label="Email Address"
          sublabel="Send to any email"
          onPress={() => handleMethodSelect("email", onSelectEmail)}
          disabled={disabled}
          theme={theme}
          styles={styles}
        />
      </View>

      <Text style={styles.footerNote}>
        The recipient will receive a notification to claim their ticket
      </Text>
    </View>
  );
}

// ============================================
// Styles
// ============================================

const createStyles = (theme: Theme) => ({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: theme.colors.textPrimary,
    textAlign: "center" as const,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    textAlign: "center" as const,
    marginBottom: 24,
  },
  methodsContainer: {
    gap: 12,
  },
  methodButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: theme.colors.bgElev1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  methodButtonDisabled: {
    opacity: 0.5,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accentMuted,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: 16,
  },
  labelContainer: {
    flex: 1,
  },
  methodLabel: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  methodSublabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
  textDisabled: {
    color: theme.colors.textTertiary,
  },
  footerNote: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    textAlign: "center" as const,
    marginTop: 16,
    paddingHorizontal: 16,
  },
});
