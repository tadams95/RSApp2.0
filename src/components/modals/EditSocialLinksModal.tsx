import { MaterialCommunityIcons } from "@expo/vector-icons";
import { doc, getFirestore, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { selectLocalId } from "../../store/redux/userSlice";
import {
  getValidationError,
  isValidSocialUrl,
  SocialPlatform,
} from "../../utils/socialLinks";
import { XLogo } from "../icons";

interface SocialLinks {
  twitter?: string;
  instagram?: string;
  tiktok?: string;
  soundcloud?: string;
  spotify?: string;
  youtube?: string;
}

interface EditSocialLinksModalProps {
  visible: boolean;
  initialSocialLinks?: SocialLinks;
  onClose: () => void;
  onSaved: () => void;
}

interface PlatformField {
  key: SocialPlatform;
  placeholder: string;
  iconBg?: string;
  iconName?: string;
  iconColor?: string;
  renderIcon?: (theme: Theme) => React.ReactNode;
}

const PLATFORM_FIELDS: PlatformField[] = [
  {
    key: "twitter",
    placeholder: "https://x.com/username",
    renderIcon: () => <XLogo size={20} color="#000" />,
  },
  {
    key: "instagram",
    placeholder: "https://instagram.com/username",
    iconBg: "#E4405F",
    iconName: "instagram",
    iconColor: "#fff",
  },
  {
    key: "tiktok",
    placeholder: "https://tiktok.com/@username",
    iconName: "music-note",
    iconColor: "#000",
  },
  {
    key: "soundcloud",
    placeholder: "https://soundcloud.com/username",
    iconBg: "#FF5500",
    iconName: "soundcloud",
    iconColor: "#fff",
  },
  {
    key: "spotify",
    placeholder: "https://open.spotify.com/artist/...",
    iconBg: "#1DB954",
    iconName: "spotify",
    iconColor: "#fff",
  },
  {
    key: "youtube",
    placeholder: "https://youtube.com/@username",
    iconBg: "#FF0000",
    iconName: "youtube",
    iconColor: "#fff",
  },
];

export default function EditSocialLinksModal({
  initialSocialLinks,
  onClose,
  onSaved,
}: EditSocialLinksModalProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const userId = useSelector(selectLocalId);
  const posthog = usePostHog();

  const [urls, setUrls] = useState<Record<SocialPlatform, string>>({
    twitter: initialSocialLinks?.twitter || "",
    instagram: initialSocialLinks?.instagram || "",
    tiktok: initialSocialLinks?.tiktok || "",
    soundcloud: initialSocialLinks?.soundcloud || "",
    spotify: initialSocialLinks?.spotify || "",
    youtube: initialSocialLinks?.youtube || "",
  });

  const [errors, setErrors] = useState<Record<SocialPlatform, string>>({
    twitter: "",
    instagram: "",
    tiktok: "",
    soundcloud: "",
    spotify: "",
    youtube: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUrlChange = (platform: SocialPlatform, text: string) => {
    setUrls((prev) => ({ ...prev, [platform]: text }));
    const error = getValidationError(text, platform);
    setErrors((prev) => ({ ...prev, [platform]: error || "" }));
  };

  const validateAll = (): boolean => {
    let valid = true;
    const newErrors = { ...errors };

    for (const field of PLATFORM_FIELDS) {
      const url = urls[field.key].trim();
      if (url) {
        if (!isValidSocialUrl(url, field.key)) {
          newErrors[field.key] = getValidationError(url, field.key) || "Invalid URL";
          valid = false;
        } else {
          newErrors[field.key] = "";
        }
      } else {
        newErrors[field.key] = "";
      }
    }

    setErrors(newErrors);
    return valid;
  };

  const handleSave = async () => {
    if (!userId) return;
    if (!validateAll()) return;

    setIsSubmitting(true);

    try {
      const db = getFirestore();
      const profileRef = doc(db, "profiles", userId);

      const socialLinks: Record<string, string | null> = {
        twitter: urls.twitter.trim() || null,
        instagram: urls.instagram.trim() || null,
        tiktok: urls.tiktok.trim() || null,
        soundcloud: urls.soundcloud.trim() || null,
        spotify: urls.spotify.trim() || null,
        youtube: urls.youtube.trim() || null,
      };

      await setDoc(
        profileRef,
        { socialLinks, updatedAt: new Date() },
        { merge: true },
      );

      // Track analytics per platform
      const platforms: SocialPlatform[] = [
        "twitter",
        "instagram",
        "tiktok",
        "soundcloud",
        "spotify",
        "youtube",
      ];
      platforms.forEach((platform) => {
        const initial = initialSocialLinks?.[platform] || "";
        const current = urls[platform].trim();

        if (current && !initial) {
          posthog?.capture("social_link_added", { platform });
        } else if (!current && initial) {
          posthog?.capture("social_link_removed", { platform });
        } else if (current !== initial) {
          posthog?.capture("social_link_updated", { platform });
        }
      });

      onSaved();
    } catch (error) {
      console.error("Failed to save social links:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderPlatformInput = (field: PlatformField) => {
    const renderIconContent = () => {
      if (field.renderIcon) {
        return field.renderIcon(theme);
      }
      return (
        <MaterialCommunityIcons
          name={field.iconName as any}
          size={20}
          color={field.iconColor || "#000"}
        />
      );
    };

    return (
      <View key={field.key}>
        <View style={styles.inputRow}>
          <View
            style={[
              styles.iconContainer,
              field.iconBg ? { backgroundColor: field.iconBg } : null,
            ]}
          >
            {renderIconContent()}
          </View>
          <TextInput
            style={[
              styles.input,
              errors[field.key] ? styles.inputError : null,
            ]}
            placeholder={field.placeholder}
            placeholderTextColor={theme.colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            value={urls[field.key]}
            onChangeText={(text) => handleUrlChange(field.key, text)}
            accessibilityLabel={`${field.key} URL input`}
          />
        </View>
        {errors[field.key] ? (
          <Text style={styles.errorText}>{errors[field.key]}</Text>
        ) : null}
      </View>
    );
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
        <Text style={styles.headerTitle}>Social Links</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {PLATFORM_FIELDS.map(renderPlatformInput)}
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
    gap: 12,
  },
  inputRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.colors.bgElev1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
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
  errorText: {
    color: theme.colors.danger,
    fontSize: theme.typography.sizes.meta,
    marginTop: 2,
    marginLeft: 46,
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
