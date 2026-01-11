import { Image } from "expo-image";
import { Link } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Theme } from "../../constants/themes";
import { useThemedStyles } from "../../hooks/useThemedStyles";

export default function EntryScreen() {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <View style={styles.backgroundDecoration} />

      <View style={styles.contentContainer}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/RSLogo2025.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </View>

        <View style={styles.buttonsContainer}>
          <Link href="/(auth)/login" asChild>
            <Pressable style={styles.button}>
              <Text style={styles.buttonText}>LOG IN</Text>
            </Pressable>
          </Link>

          <Link href="/(auth)/signup" asChild>
            <Pressable style={styles.button}>
              <Text style={styles.buttonText}>CREATE ACCOUNT</Text>
            </Pressable>
          </Link>

          <Link href="/(guest)/shop" asChild>
            <Pressable style={styles.guestButton}>
              <Text style={styles.guestButtonText}>CONTINUE AS GUEST</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
    position: "relative" as const,
  },
  backgroundDecoration: {
    position: "absolute" as const,
    top: 0,
    right: 0,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: theme.colors.bgElev1,
    opacity: 0.5,
    transform: [{ translateX: 100 }, { translateY: -50 }],
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing.xxl,
    paddingTop: 80,
    paddingBottom: 40,
    justifyContent: "center" as const,
  },
  logoContainer: {
    alignItems: "center" as const,
    marginBottom: 60,
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: theme.spacing.lg,
  } as const,
  tagline: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textPrimary,
    letterSpacing: 2,
    opacity: 0.8,
  },
  buttonsContainer: {
    width: "100%" as const,
    paddingHorizontal: theme.spacing.md,
  },
  button: {
    marginBottom: theme.spacing.lg,
    paddingVertical: 18,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.accent,
    alignItems: "center" as const,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  buttonText: {
    color: "#fff", // Always white on accent button for contrast
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.bold,
    letterSpacing: 1.5,
  },
  guestButton: {
    backgroundColor: "transparent",
    paddingVertical: 18,
    borderRadius: theme.radius.button,
    alignItems: "center" as const,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    marginTop: theme.spacing.sm,
  },
  guestButtonText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold,
    letterSpacing: 1.5,
  },
});
