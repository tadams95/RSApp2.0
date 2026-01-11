import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePostHog, useScreenTracking } from "../../analytics/PostHogProvider";
import LoadingOverlay from "../../components/LoadingOverlay";
import { useTheme } from "../../contexts/ThemeContext";
import { auth, db } from "../../firebase/firebase";
import { useAuth } from "../../hooks/AuthContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";

/**
 * Profile completion screen for new Google Sign-In users
 * Collects additional required information (phone number)
 */
export default function CompleteProfileScreen() {
  const router = useRouter();
  const { setAuthenticated } = useAuth();
  const currentUser = auth.currentUser;
  const { track } = usePostHog();
  const params = useLocalSearchParams<{
    firstName?: string;
    lastName?: string;
  }>();

  const [firstName, setFirstName] = useState(params.firstName || "");
  const [lastName, setLastName] = useState(params.lastName || "");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Track screen view
  useScreenTracking("Complete Profile Screen", {
    screen_category: "auth",
    source: "google_signin",
  });

  function formatPhoneNumber(input: string) {
    const cleaned = input.replace(/\D/g, "");

    if (cleaned.length <= 3) {
      return cleaned;
    } else if (cleaned.length <= 6) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    } else {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(
        6,
        10
      )}`;
    }
  }

  async function handleComplete() {
    setIsLoading(true);
    setError(null);

    try {
      // Validate required fields
      if (!firstName.trim()) {
        throw new Error("Please enter your first name");
      }
      if (!lastName.trim()) {
        throw new Error("Please enter your last name");
      }

      // Phone number is optional but validate format if provided
      const cleanedPhone = phoneNumber.replace(/\D/g, "");
      if (phoneNumber && cleanedPhone.length !== 10) {
        throw new Error("Please enter a valid 10-digit phone number");
      }

      // Update user profile in Firestore
      if (currentUser?.uid) {
        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phoneNumber: cleanedPhone || null,
          profileCompleted: true,
          updatedAt: serverTimestamp(),
        });

        await track("profile_completed", {
          method: "google_signin",
          has_phone_number: !!cleanedPhone,
        });
      }

      setAuthenticated(true);
      router.replace("/(app)/home");
    } catch (err: any) {
      setError(err.message || "Failed to complete profile");
      await track("profile_completion_failed", {
        error_message: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSkip() {
    setIsLoading(true);

    try {
      // Mark profile as completed even without phone
      if (currentUser?.uid) {
        const userDocRef = doc(db, "users", currentUser.uid);
        await updateDoc(userDocRef, {
          firstName: firstName.trim() || params.firstName || "",
          lastName: lastName.trim() || params.lastName || "",
          profileCompleted: true,
          updatedAt: serverTimestamp(),
        });

        await track("profile_skipped", {
          method: "google_signin",
        });
      }

      setAuthenticated(true);
      router.replace("/(app)/home");
    } catch (err: any) {
      setError(err.message || "Failed to continue");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <LoadingOverlay message="Setting up your profile..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingView}
      >
        <View style={styles.contentContainer}>
          <Text style={styles.title}>COMPLETE YOUR PROFILE</Text>
          <Text style={styles.subtitle}>
            Just a few more details to get started
          </Text>

          <View style={styles.formContainer}>
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>FIRST NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your first name"
                placeholderTextColor={theme.colors.textTertiary}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>LAST NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your last name"
                placeholderTextColor={theme.colors.textTertiary}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>PHONE NUMBER (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="(555) 123-4567"
                placeholderTextColor={theme.colors.textTertiary}
                value={phoneNumber}
                onChangeText={(text) => setPhoneNumber(formatPhoneNumber(text))}
                keyboardType="phone-pad"
                maxLength={14}
              />
              <Text style={styles.helperText}>
                Used for ticket transfer notifications
              </Text>
            </View>

            <Pressable style={styles.button} onPress={handleComplete}>
              <Text style={styles.buttonText}>COMPLETE PROFILE</Text>
            </Pressable>

            <Pressable style={styles.skipButton} onPress={handleSkip}>
              <Text style={styles.skipButtonText}>Skip for now</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get("window");
const MAX_FORM_WIDTH = 400;

const createStyles = (theme: import("../../constants/themes").Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  keyboardAvoidingView: {
    flex: 1,
    justifyContent: "center" as const,
  },
  contentContainer: {
    alignSelf: "center" as const,
    width: width > MAX_FORM_WIDTH ? MAX_FORM_WIDTH : width * 0.9,
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold" as const,
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: "center" as const,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 32,
    textAlign: "center" as const,
  },
  formContainer: {
    width: "100%" as const,
    backgroundColor: theme.colors.bgElev1,
    borderRadius: 12,
    padding: 24,
    ...theme.shadows.card,
  },
  inputContainer: {
    marginBottom: 22,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    marginBottom: 8,
    fontWeight: "500" as const,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: theme.colors.bgElev2,
    borderRadius: 8,
    padding: 16,
    color: theme.colors.textPrimary,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  helperText: {
    color: theme.colors.textTertiary,
    fontSize: 12,
    marginTop: 6,
  },
  errorContainer: {
    backgroundColor: `${theme.colors.danger}1A`,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${theme.colors.danger}4D`,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 14,
    textAlign: "center" as const,
  },
  button: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center" as const,
    marginTop: 8,
  },
  buttonText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: "bold" as const,
    letterSpacing: 1,
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: "center" as const,
    marginTop: 8,
  },
  skipButtonText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
  },
});
