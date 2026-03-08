import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  Dimensions,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useScreenTracking } from "../analytics/PostHogProvider";
import type { Theme } from "../constants/themes";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../hooks/AuthContext";
import { useThemedStyles } from "../hooks/useThemedStyles";

export default function Index() {
  const { authenticated, isLoading } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Track screen view for analytics
  useScreenTracking("Landing Screen", {
    userType: authenticated ? "authenticated" : "guest",
    isLoading: isLoading,
    willRedirect: authenticated,
  });

  // Redirect authenticated users to home page automatically
  useEffect(() => {
    if (!isLoading && authenticated) {
      router.replace("/(app)/home");
    }
  }, [authenticated, isLoading, router]);

  // If still loading or authenticated, render minimal content that will be replaced
  if (isLoading || authenticated) {
    return <View style={styles.loadingContainer} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Image
        source={require("../assets/BlurHero_2.png")}
        style={styles.backgroundImage}
        contentFit="cover"
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.4)", "rgba(0,0,0,0.85)", "#000"]}
        style={styles.gradient}
      >
        <View style={styles.logoContainer}>
          <Image
            source={require("../assets/RSLogo2025.png")}
            style={styles.logo}
            contentFit="contain"
          />
          <Text style={styles.title}>RAGE STATE</Text>
          <Text style={styles.subtitle}>Live in your world, Rage in ours.</Text>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={() => router.push("/(auth)/")}
          >
            <Text style={styles.buttonText}>GET STARTED</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={() => router.push("/(guest)/shop")}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              BROWSE AS GUEST
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2025 RAGESTATE</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const { width } = Dimensions.get("window");

const createStyles = (theme: Theme) =>
  ({
    loadingContainer: {
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
    },
    backgroundImage: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      width: "100%" as const,
      height: "100%" as const,
    },
    gradient: {
      flex: 1,
      justifyContent: "space-between" as const,
      paddingTop: 100,
      paddingBottom: 40,
    },
    logoContainer: {
      alignItems: "center" as const,
      padding: theme.spacing.xl,
    },
    logo: {
      width: 120,
      height: 120,
      marginBottom: theme.spacing.lg,
    },
    title: {
      fontSize: theme.typography.sizes.display,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.textPrimary,
      letterSpacing: 3,
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      fontSize: 18,
      color: theme.colors.textSecondary,
      textAlign: "center" as const,
      fontStyle: "italic" as const,
    },
    buttonContainer: {
      alignItems: "center" as const,
      padding: theme.spacing.xl,
      width: "100%" as const,
    },
    button: {
      width: width * 0.8,
      maxWidth: 400,
      height: 56,
      borderRadius: 28,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginVertical: 10,
    },
    primaryButton: {
      backgroundColor: theme.colors.accent,
    },
    secondaryButton: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: theme.colors.textTertiary,
    },
    buttonText: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: theme.typography.weights.bold,
      letterSpacing: 1,
    },
    secondaryButtonText: {
      color: theme.colors.textSecondary,
    },
    footer: {
      alignItems: "center" as const,
      marginTop: theme.spacing.xl,
    },
    footerText: {
      color: theme.colors.textTertiary,
      fontSize: 14,
    },
  } as const);
