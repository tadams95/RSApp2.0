import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { usePostHog } from "../../analytics/PostHogProvider";
import { GlobalStyles } from "../../constants/styles";

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
          color={
            disabled ? GlobalStyles.colors.grey5 : GlobalStyles.colors.primary
          }
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
        color={disabled ? GlobalStyles.colors.grey6 : GlobalStyles.colors.grey4}
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
        />

        <MethodButton
          icon="at"
          label="@Username"
          sublabel="Search by username"
          onPress={() => handleMethodSelect("username", onSelectUsername)}
          disabled={disabled}
        />

        <MethodButton
          icon="email-outline"
          label="Email Address"
          sublabel="Send to any email"
          onPress={() => handleMethodSelect("email", onSelectEmail)}
          disabled={disabled}
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

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: GlobalStyles.spacing.sm,
    paddingVertical: GlobalStyles.spacing.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: GlobalStyles.colors.text,
    textAlign: "center",
    marginBottom: GlobalStyles.spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    color: GlobalStyles.colors.textSecondary,
    textAlign: "center",
    marginBottom: GlobalStyles.spacing.lg,
  },
  methodsContainer: {
    gap: GlobalStyles.spacing.sm,
  },
  methodButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GlobalStyles.colors.surface,
    borderRadius: 12,
    padding: GlobalStyles.spacing.md,
    borderWidth: 1,
    borderColor: GlobalStyles.colors.border,
  },
  methodButtonDisabled: {
    opacity: 0.5,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 60, 0, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: GlobalStyles.spacing.md,
  },
  labelContainer: {
    flex: 1,
  },
  methodLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: GlobalStyles.colors.text,
    marginBottom: 2,
  },
  methodSublabel: {
    fontSize: 13,
    color: GlobalStyles.colors.textSecondary,
  },
  textDisabled: {
    color: GlobalStyles.colors.grey5,
  },
  footerNote: {
    fontSize: 11,
    color: GlobalStyles.colors.grey5,
    textAlign: "center",
    marginTop: GlobalStyles.spacing.md,
    paddingHorizontal: GlobalStyles.spacing.md,
  },
});
