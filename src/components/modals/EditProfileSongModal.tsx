import { MaterialCommunityIcons } from "@expo/vector-icons";
import { doc, getFirestore, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSelector } from "react-redux";
import { usePostHog } from "../../analytics/PostHogProvider";
import type { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useMusicTrack } from "../../hooks/useMusicTrack";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { selectLocalId } from "../../store/redux/userSlice";
import {
  detectMusicPlatform,
  getMusicPlatformConfig,
  getMusicValidationError,
} from "../../utils/musicPlatforms";

interface EditProfileSongModalProps {
  visible: boolean;
  initialSongUrl: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditProfileSongModal({
  initialSongUrl,
  onClose,
  onSaved,
}: EditProfileSongModalProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const userId = useSelector(selectLocalId);
  const posthog = usePostHog();

  const [profileSongUrl, setProfileSongUrl] = useState(initialSongUrl || "");
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live preview via useMusicTrack
  const {
    trackInfo: songPreview,
    isLoading: songLoading,
    error: songError,
    platform: detectedPlatform,
  } = useMusicTrack(profileSongUrl.trim() || null);

  const handleUrlChange = (text: string) => {
    setProfileSongUrl(text);
    const validationError = getMusicValidationError(text);
    setFormError(validationError || "");
  };

  const clearUrl = () => {
    setProfileSongUrl("");
    setFormError("");
  };

  const handleSave = async () => {
    if (!userId) return;

    const trimmedUrl = profileSongUrl.trim();

    // Validate if URL is present
    if (trimmedUrl) {
      const validationError = getMusicValidationError(trimmedUrl);
      if (validationError) {
        setFormError(validationError);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const db = getFirestore();
      const profileRef = doc(db, "profiles", userId);
      const profileUpdate: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      const newSongUrl = trimmedUrl || null;
      profileUpdate.profileSongUrl = newSongUrl;

      if (newSongUrl && songPreview && detectedPlatform !== "unknown") {
        profileUpdate.profileMusic = {
          platform: detectedPlatform,
          url: newSongUrl,
          title: songPreview.title || null,
          artist: songPreview.artist || null,
          artworkUrl: songPreview.artworkUrl || null,
          cachedAt: new Date().toISOString(),
        };

        posthog?.capture("profile_music_set", {
          platform: detectedPlatform,
          previous_platform: initialSongUrl
            ? getMusicPlatformConfig(detectMusicPlatform(initialSongUrl)).name
            : null,
          track_title: songPreview.title || null,
          track_artist: songPreview.artist || null,
        });
      } else if (!newSongUrl) {
        profileUpdate.profileMusic = null;

        if (initialSongUrl) {
          posthog?.capture("profile_music_removed", {
            platform: getMusicPlatformConfig(
              detectMusicPlatform(initialSongUrl),
            ).name,
          });
        }
      }

      await setDoc(profileRef, profileUpdate, { merge: true });
      onSaved();
    } catch (error) {
      console.error("Failed to save profile song:", error);
      setFormError("Failed to save. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          accessibilityLabel="Close"
        >
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={theme.colors.textPrimary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile Song</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hint */}
        <View style={styles.hintRow}>
          <MaterialCommunityIcons
            name="music-note"
            size={20}
            color={theme.colors.accent}
          />
          <Text style={styles.hintTitle}>Profile Song</Text>
        </View>
        <Text style={styles.hintText}>
          Add a track from SoundCloud, Spotify, or YouTube
        </Text>

        {/* URL Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, formError ? styles.inputError : null]}
            placeholder="Paste any music link..."
            placeholderTextColor={theme.colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            value={profileSongUrl}
            onChangeText={handleUrlChange}
            accessibilityLabel="Profile Song URL input"
          />
          {profileSongUrl.trim() !== "" && (
            <Pressable
              onPress={clearUrl}
              style={styles.clearButton}
              accessibilityRole="button"
              accessibilityLabel="Clear profile song"
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={24}
                color={theme.colors.textTertiary}
              />
            </Pressable>
          )}
        </View>

        {/* Validation Error */}
        {formError ? <Text style={styles.errorText}>{formError}</Text> : null}

        {/* Song Preview */}
        {songLoading && (
          <View style={styles.previewContainer}>
            <ActivityIndicator size="small" color={theme.colors.accent} />
            <Text style={styles.previewText}>Loading preview...</Text>
          </View>
        )}
        {songPreview && !songLoading && (
          <View style={styles.previewContainer}>
            <MaterialCommunityIcons
              name={getMusicPlatformConfig(detectedPlatform).icon as any}
              size={20}
              color={getMusicPlatformConfig(detectedPlatform).color}
            />
            <Text style={styles.previewText} numberOfLines={1}>
              {songPreview.title}
              {songPreview.artist ? ` — ${songPreview.artist}` : ""}
            </Text>
          </View>
        )}
        {songError && !songLoading && profileSongUrl.trim() !== "" && (
          <View style={styles.previewContainer}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={20}
              color={theme.colors.danger}
            />
            <Text style={styles.previewErrorText}>
              Unable to load track preview
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Button Row */}
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>CANCEL</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.saveButton,
            isSubmitting && styles.saveButtonDisabled,
          ]}
          onPress={handleSave}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>SAVE</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderSubtle,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: theme.typography.weights.semibold as "600",
    color: theme.colors.textPrimary,
  },
  headerSpacer: {
    width: 32,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: theme.spacing.md,
  },
  hintRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.sm,
    marginBottom: 4,
  },
  hintTitle: {
    fontSize: theme.typography.sizes.body,
    fontWeight: theme.typography.weights.semibold as "600",
    color: theme.colors.textPrimary,
  },
  hintText: {
    fontSize: theme.typography.sizes.meta,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  inputContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.bgElev1,
    borderRadius: theme.radius.input,
    padding: 12,
    fontSize: theme.typography.sizes.body,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  clearButton: {
    position: "absolute" as const,
    right: 10,
    padding: 4,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.sizes.meta,
    marginTop: 4,
  },
  previewContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing.sm,
    marginTop: 12,
    padding: 12,
    backgroundColor: theme.colors.bgElev1,
    borderRadius: theme.radius.input,
  },
  previewText: {
    flex: 1,
    fontSize: theme.typography.sizes.meta,
    color: theme.colors.textSecondary,
  },
  previewErrorText: {
    flex: 1,
    fontSize: theme.typography.sizes.meta,
    color: theme.colors.danger,
  },
  buttonRow: {
    flexDirection: "row" as const,
    gap: 12,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  cancelButton: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 14,
    borderRadius: theme.radius.button,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.semibold as "600",
    color: theme.colors.textPrimary,
  },
  saveButton: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 14,
    borderRadius: theme.radius.button,
    backgroundColor: theme.colors.accent,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: theme.typography.weights.bold as "700",
    color: "#fff",
  },
});
