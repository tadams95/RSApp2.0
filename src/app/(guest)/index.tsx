import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import React from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useScreenTracking } from "../../analytics/PostHogProvider";
import { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { navigateToAuth } from "../../utils/navigation";

/**
 * Guest account page that provides authentication options
 * It allows users to sign in or sign up for a full account
 */
const GuestAccountPage: React.FC = () => {
  // Track screen view
  useScreenTracking("Guest Account Screen", {
    user_type: "guest",
  });

  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

  const handleNavigateToAuth = () => {
    navigateToAuth();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.accountContainer}>
        <MaterialCommunityIcons
          name="account-circle"
          size={80}
          color={theme.colors.textPrimary}
        />
        <Text style={styles.welcomeText}>Guest Access</Text>

        <Text style={styles.infoText}>
          You're currently browsing as a guest. Create an account to:
        </Text>

        <View style={styles.benefitsList}>
          <View style={styles.benefitItem}>
            <MaterialCommunityIcons
              name="shopping"
              size={24}
              color={theme.colors.textPrimary}
            />
            <Text style={styles.benefitText}>Make purchases in the shop</Text>
          </View>

          <View style={styles.benefitItem}>
            <MaterialCommunityIcons
              name="calendar-check"
              size={24}
              color={theme.colors.textPrimary}
            />
            <Text style={styles.benefitText}>Register for events</Text>
          </View>

          <View style={styles.benefitItem}>
            <MaterialCommunityIcons
              name="heart"
              size={24}
              color={theme.colors.textPrimary}
            />
            <Text style={styles.benefitText}>Save favorite items</Text>
          </View>

          <View style={styles.benefitItem}>
            <MaterialCommunityIcons
              name="history"
              size={24}
              color={theme.colors.textPrimary}
            />
            <Text style={styles.benefitText}>Track order history</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.authButton}
          onPress={handleNavigateToAuth}
          accessibilityRole="button"
          accessibilityLabel="Login or create an account"
        >
          <Text style={styles.authButtonText}>LOGIN / SIGN UP</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const fontFamily =
  Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  }) || "system";

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
    padding: theme.spacing.xl,
  },
  accountContainer: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 40,
  },
  welcomeText: {
    fontSize: theme.typography.sizes.display,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.textPrimary,
    fontFamily,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    textAlign: "center" as const,
  },
  infoText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.body,
    textAlign: "center" as const,
    marginBottom: 30,
    fontFamily,
    paddingHorizontal: theme.spacing.xl,
  },
  benefitsList: {
    width: "100%" as const,
    marginTop: theme.spacing.xl,
  },
  benefitItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginVertical: 10,
    backgroundColor: theme.colors.bgElev2,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.button,
  },
  benefitText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontFamily,
    marginLeft: theme.spacing.lg,
  },
  footer: {
    marginTop: "auto" as const,
    paddingVertical: theme.spacing.xl,
    width: "100%" as const,
  },
  authButton: {
    backgroundColor: theme.colors.bgElev2,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    width: "100%" as const,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.button,
    alignItems: "center" as const,
  },
  authButtonText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    fontFamily,
  },
});

export default GuestAccountPage;
