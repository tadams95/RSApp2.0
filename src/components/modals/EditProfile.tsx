import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { doc, getFirestore, setDoc } from "firebase/firestore";
import { useSelector } from "react-redux";
import { usePostHog } from "../../analytics/PostHogProvider";
import { GlobalStyles } from "../../constants/styles";
import { useMusicTrack } from "../../hooks/useMusicTrack";
import useProfileUpdateErrorHandler from "../../hooks/useProfileUpdateErrorHandler";
import { NotificationManager } from "../../services/notificationManager";
import { selectLocalId } from "../../store/redux/userSlice";
import { updateUserData } from "../../utils/auth";
import {
  getMusicPlatformConfig,
  getMusicValidationError,
  isValidMusicUrl,
} from "../../utils/musicPlatforms";
import { isValidSocialUrl, SocialPlatform } from "../../utils/socialLinks";
import ProfileUpdateErrorNotice from "../ProfileUpdateErrorNotice";
import { XLogo } from "../icons";
import {
  formatPhoneNumberInput,
  validateEmail,
  validateName,
  validatePhoneNumber,
} from "./EditProfileValidation";

// Define interfaces for component props
interface EditProfileProps {
  onProfileUpdated: () => void;
  onCancel: () => void;
  initialData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    profileSongUrl?: string | null;
    socialLinks?: {
      twitter?: string;
      instagram?: string;
      tiktok?: string;
      soundcloud?: string;
      spotify?: string;
      youtube?: string;
    };
  };
}

// Define interface for user data updates
interface UserDataUpdate {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
}

// Interface for form validation errors
interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  profileSongUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  soundcloudUrl?: string;
  spotifyUrl?: string;
  youtubeUrl?: string;
}

const EditProfile: React.FC<EditProfileProps> = ({
  onProfileUpdated,
  onCancel,
  initialData,
}) => {
  // State variables with proper types
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [profileSongUrl, setProfileSongUrl] = useState<string>("");
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formState, setFormState] = useState<UserDataUpdate>({});

  // Social links state
  const [twitterUrl, setTwitterUrl] = useState<string>("");
  const [instagramUrl, setInstagramUrl] = useState<string>("");
  const [tiktokUrl, setTiktokUrl] = useState<string>("");
  const [soundcloudUrl, setSoundcloudUrl] = useState<string>("");
  const [spotifyUrl, setSpotifyUrl] = useState<string>("");
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [socialLinksExpanded, setSocialLinksExpanded] =
    useState<boolean>(false);

  // PostHog analytics
  const posthog = usePostHog();

  // Music track preview for profile song (supports SoundCloud, Spotify, YouTube)
  const {
    trackInfo: songPreview,
    isLoading: songLoading,
    error: songError,
    platform: detectedPlatform,
  } = useMusicTrack(profileSongUrl.trim() || null);

  // Get profile update error handler
  const {
    error: updateError,
    fieldErrors: updateFieldErrors,
    validationErrors, // Added new validationErrors from the hook
    recoveryAction,
    handleUpdateError,
    clearErrors,
  } = useProfileUpdateErrorHandler();

  // Get router for navigation
  const router = useRouter();

  // Get user ID from Redux store
  const userId = useSelector(selectLocalId);

  /**
   * Initialize form fields with existing user data
   */
  useEffect(() => {
    if (initialData) {
      setFirstName(initialData.firstName || "");
      setLastName(initialData.lastName || "");
      setEmail(initialData.email || "");
      setPhoneNumber(initialData.phoneNumber || "");
      setProfileSongUrl(initialData.profileSongUrl || "");
      // Initialize social links
      setTwitterUrl(initialData.socialLinks?.twitter || "");
      setInstagramUrl(initialData.socialLinks?.instagram || "");
      setTiktokUrl(initialData.socialLinks?.tiktok || "");
      setSoundcloudUrl(initialData.socialLinks?.soundcloud || "");
      setSpotifyUrl(initialData.socialLinks?.spotify || "");
      setYoutubeUrl(initialData.socialLinks?.youtube || "");
      // Auto-expand if any social links exist
      if (
        initialData.socialLinks?.twitter ||
        initialData.socialLinks?.instagram ||
        initialData.socialLinks?.tiktok ||
        initialData.socialLinks?.soundcloud ||
        initialData.socialLinks?.spotify ||
        initialData.socialLinks?.youtube
      ) {
        setSocialLinksExpanded(true);
      }
    }
  }, [initialData]);

  /**
   * Apply update field errors to form errors
   */
  useEffect(() => {
    setFormErrors((prev) => ({ ...prev, ...updateFieldErrors }));
  }, [updateFieldErrors]);

  /**
   * Save form state for recovery on failed update
   */
  useEffect(() => {
    setFormState({
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email: email || undefined,
      phoneNumber: phoneNumber || undefined,
    });
  }, [firstName, lastName, email, phoneNumber]);

  /**
   * Validates form fields when they change
   */
  const validateField = (field: keyof FormErrors, value: string) => {
    let error = "";

    switch (field) {
      case "firstName":
      case "lastName":
        const nameValidation = validateName(value);
        if (!nameValidation.isValid && value.trim() !== "") {
          error = nameValidation.errorMessage;
        }
        break;
      case "email":
        const emailValidation = validateEmail(value);
        if (!emailValidation.isValid) {
          error = emailValidation.errorMessage;
        }
        break;
      case "phoneNumber":
        const phoneValidation = validatePhoneNumber(value);
        if (!phoneValidation.isValid) {
          error = phoneValidation.errorMessage;
        }
        break;
      case "profileSongUrl":
        // Only validate if URL is provided - now supports SoundCloud, Spotify, YouTube
        if (value.trim()) {
          const validationError = getMusicValidationError(value.trim());
          if (validationError) {
            error = validationError;
          }
        }
        break;
      case "twitterUrl":
        if (value.trim() && !isValidSocialUrl(value.trim(), "twitter")) {
          error =
            "Please enter a valid X/Twitter URL (e.g., https://x.com/username)";
        }
        break;
      case "instagramUrl":
        if (value.trim() && !isValidSocialUrl(value.trim(), "instagram")) {
          error =
            "Please enter a valid Instagram URL (e.g., https://instagram.com/username)";
        }
        break;
      case "tiktokUrl":
        if (value.trim() && !isValidSocialUrl(value.trim(), "tiktok")) {
          error =
            "Please enter a valid TikTok URL (e.g., https://tiktok.com/@username)";
        }
        break;
      case "soundcloudUrl":
        if (value.trim() && !isValidSocialUrl(value.trim(), "soundcloud")) {
          error =
            "Please enter a valid SoundCloud URL (e.g., https://soundcloud.com/username)";
        }
        break;
      case "spotifyUrl":
        if (value.trim() && !isValidSocialUrl(value.trim(), "spotify")) {
          error =
            "Please enter a valid Spotify URL (e.g., https://open.spotify.com/artist/...)";
        }
        break;
      case "youtubeUrl":
        if (value.trim() && !isValidSocialUrl(value.trim(), "youtube")) {
          error =
            "Please enter a valid YouTube URL (e.g., https://youtube.com/@username)";
        }
        break;
    }

    setFormErrors((prev) => ({ ...prev, [field]: error }));
  };

  /**
   * Handle profile song URL change
   */
  const handleProfileSongChange = (text: string) => {
    setProfileSongUrl(text);
    // Debounce validation slightly by clearing error immediately
    if (!text.trim()) {
      setFormErrors((prev) => ({ ...prev, profileSongUrl: "" }));
    } else {
      validateField("profileSongUrl", text);
    }
  };

  /**
   * Clear the profile song URL
   */
  const clearProfileSong = () => {
    setProfileSongUrl("");
    setFormErrors((prev) => ({ ...prev, profileSongUrl: "" }));
  };

  /**
   * Handle input change for phone number with formatting
   */
  const handlePhoneChange = (text: string) => {
    const formattedNumber = formatPhoneNumberInput(text);
    setPhoneNumber(formattedNumber);
    validateField("phoneNumber", formattedNumber);
  };

  /**
   * Handles canceling the edit process
   */
  const cancelEditHandler = (): void => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhoneNumber("");
    setProfileSongUrl("");
    setTwitterUrl("");
    setInstagramUrl("");
    setTiktokUrl("");
    setSoundcloudUrl("");
    setSpotifyUrl("");
    setYoutubeUrl("");
    setSocialLinksExpanded(false);
    setFormErrors({});
    clearErrors();
    onCancel();
  };

  /**
   * Resets all form fields
   */
  const resetFields = (): void => {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhoneNumber("");
    setProfileSongUrl("");
    setTwitterUrl("");
    setInstagramUrl("");
    setTiktokUrl("");
    setSoundcloudUrl("");
    setSpotifyUrl("");
    setYoutubeUrl("");
    setSocialLinksExpanded(false);
    setFormErrors({});
    clearErrors();
  };

  /**
   * Validates the entire form
   */
  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    let isValid = true;

    // Only validate fields that have values
    if (firstName) {
      const firstNameValidation = validateName(firstName);
      if (!firstNameValidation.isValid) {
        errors.firstName = firstNameValidation.errorMessage;
        isValid = false;
      }
    }

    if (lastName) {
      const lastNameValidation = validateName(lastName);
      if (!lastNameValidation.isValid) {
        errors.lastName = lastNameValidation.errorMessage;
        isValid = false;
      }
    }

    if (email) {
      const emailValidation = validateEmail(email);
      if (!emailValidation.isValid) {
        errors.email = emailValidation.errorMessage;
        isValid = false;
      }
    }

    if (phoneNumber) {
      const phoneValidation = validatePhoneNumber(phoneNumber);
      if (!phoneValidation.isValid) {
        errors.phoneNumber = phoneValidation.errorMessage;
        isValid = false;
      }
    }

    // Validate profile song URL if provided (supports SoundCloud, Spotify, YouTube)
    if (profileSongUrl.trim() && !isValidMusicUrl(profileSongUrl.trim())) {
      errors.profileSongUrl =
        "Please enter a valid music URL (SoundCloud, Spotify, or YouTube)";
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  /**
   * Retry update after error
   */
  const retryUpdate = () => {
    clearErrors();
    confirmEditHandler();
  };

  /**
   * Handles confirming and saving profile changes
   */
  const confirmEditHandler = async (): Promise<void> => {
    // Make sure we have a user ID before attempting to update
    if (!userId) {
      handleUpdateError({
        code: "not-found",
        message: "User ID not available. Please log in again.",
      });
      return;
    }

    // Validate form before submission
    if (!validateForm()) {
      return;
    }

    // Set submitting state to true to show loading state if needed
    setIsSubmitting(true);

    // Create an object with only the fields that have changed
    const updatedUserData: UserDataUpdate = {};

    // Check each field against initial data to see what changed
    if (firstName !== (initialData?.firstName || "")) {
      updatedUserData.firstName = firstName || undefined;
    }
    if (lastName !== (initialData?.lastName || "")) {
      updatedUserData.lastName = lastName || undefined;
    }
    if (email !== (initialData?.email || "")) {
      updatedUserData.email = email || undefined;
    }
    if (phoneNumber !== (initialData?.phoneNumber || "")) {
      updatedUserData.phoneNumber = phoneNumber || undefined;
    }

    // Check if profile song URL changed
    const initialSongUrl = initialData?.profileSongUrl || "";
    const newSongUrl = profileSongUrl.trim();
    const profileSongChanged = newSongUrl !== initialSongUrl;

    // Check if social links changed
    const initialTwitter = initialData?.socialLinks?.twitter || "";
    const initialInstagram = initialData?.socialLinks?.instagram || "";
    const initialTiktok = initialData?.socialLinks?.tiktok || "";
    const initialSoundcloud = initialData?.socialLinks?.soundcloud || "";
    const initialSpotify = initialData?.socialLinks?.spotify || "";
    const initialYoutube = initialData?.socialLinks?.youtube || "";
    const newTwitter = twitterUrl.trim();
    const newInstagram = instagramUrl.trim();
    const newTiktok = tiktokUrl.trim();
    const newSoundcloud = soundcloudUrl.trim();
    const newSpotify = spotifyUrl.trim();
    const newYoutube = youtubeUrl.trim();
    const socialLinksChanged =
      newTwitter !== initialTwitter ||
      newInstagram !== initialInstagram ||
      newTiktok !== initialTiktok ||
      newSoundcloud !== initialSoundcloud ||
      newSpotify !== initialSpotify ||
      newYoutube !== initialYoutube;

    // Only update if there are changes to make
    if (
      Object.keys(updatedUserData).length === 0 &&
      !profileSongChanged &&
      !socialLinksChanged
    ) {
      console.warn("No changes to update");
      setIsSubmitting(false);
      onCancel();
      return;
    }

    try {
      // Update user data in both Firestore and RTDB using existing utility
      if (Object.keys(updatedUserData).length > 0) {
        const result = await updateUserData(userId, updatedUserData);

        if (!result.success) {
          throw new Error(result.message || "Failed to update profile");
        }
      }

      // Update profile data in /profiles collection (song URL + social links)
      if (profileSongChanged || socialLinksChanged) {
        const db = getFirestore();
        const profileRef = doc(db, "profiles", userId);

        // Build the update object
        const profileUpdate: Record<string, unknown> = {
          updatedAt: new Date(),
        };

        if (profileSongChanged) {
          profileUpdate.profileSongUrl = newSongUrl || null;
        }

        if (socialLinksChanged) {
          profileUpdate.socialLinks = {
            twitter: newTwitter || null,
            instagram: newInstagram || null,
            tiktok: newTiktok || null,
            soundcloud: newSoundcloud || null,
            spotify: newSpotify || null,
            youtube: newYoutube || null,
          };

          // Track social link changes with PostHog
          const platforms: SocialPlatform[] = [
            "twitter",
            "instagram",
            "tiktok",
            "soundcloud",
            "spotify",
            "youtube",
          ];
          platforms.forEach((platform) => {
            const initial = initialData?.socialLinks?.[platform] || "";
            const current =
              platform === "twitter"
                ? newTwitter
                : platform === "instagram"
                ? newInstagram
                : platform === "tiktok"
                ? newTiktok
                : platform === "soundcloud"
                ? newSoundcloud
                : platform === "spotify"
                ? newSpotify
                : newYoutube;

            if (current && !initial) {
              // Link added
              posthog?.capture("social_link_added", { platform });
            } else if (!current && initial) {
              // Link removed
              posthog?.capture("social_link_removed", { platform });
            } else if (current !== initial) {
              // Link updated
              posthog?.capture("social_link_updated", { platform });
            }
          });
        }

        await setDoc(profileRef, profileUpdate, { merge: true });
        console.log("Profile data updated successfully");
      }

      // Send profile update confirmation notification
      try {
        const changedFields = [
          ...Object.keys(updatedUserData),
          ...(profileSongChanged ? ["profileSongUrl"] : []),
          ...(socialLinksChanged ? ["socialLinks"] : []),
        ];
        const updateType = changedFields.some(
          (field) => field === "email" || field === "phoneNumber"
        )
          ? "contact_info"
          : "basic_info";

        await NotificationManager.sendProfileUpdateConfirmation(
          {
            userId: userId,
            actionType: "profile_update",
            timestamp: new Date(),
            isSuccessful: true,
            changedFields,
          },
          updateType
        );
        console.log("Profile update notification sent");
      } catch (notificationError) {
        console.error(
          "Failed to send profile update notification:",
          notificationError
        );
        // Don't block the profile update flow if notification fails
      }

      resetFields();
      onProfileUpdated();
    } catch (error) {
      handleUpdateError(error, onProfileUpdated);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      accessibilityLabel="Edit profile form"
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.headline} accessibilityRole="header">
          Edit your profile details below
        </Text>

        {/* Enhanced to pass validation errors to the component */}
        {updateError && (
          <View style={styles.errorNoticeContainer}>
            <ProfileUpdateErrorNotice
              message={updateError}
              onRetry={retryUpdate}
              secondaryAction={recoveryAction || undefined}
              validationErrors={validationErrors}
            />
          </View>
        )}

        <View style={styles.editProfileContainer}>
          <Text style={styles.subtitle}>First Name</Text>
          <TextInput
            style={[styles.input, formErrors.firstName && styles.inputError]}
            placeholder="First Name Change"
            placeholderTextColor="#666"
            value={firstName}
            onChangeText={(text) => {
              setFirstName(text);
              validateField("firstName", text);
            }}
            autoCapitalize="words"
            accessibilityLabel="First Name input"
            accessibilityHint="Enter your first name"
          />
          {formErrors.firstName ? (
            <Text style={styles.errorText}>{formErrors.firstName}</Text>
          ) : null}

          <Text style={styles.subtitle}>Last Name</Text>
          <TextInput
            style={[styles.input, formErrors.lastName && styles.inputError]}
            placeholder="Last Name Change"
            placeholderTextColor="#666"
            value={lastName}
            onChangeText={(text) => {
              setLastName(text);
              validateField("lastName", text);
            }}
            accessibilityLabel="Last Name input"
            accessibilityHint="Enter your last name"
          />
          {formErrors.lastName ? (
            <Text style={styles.errorText}>{formErrors.lastName}</Text>
          ) : null}

          <Text style={styles.subtitle}>Email</Text>
          <TextInput
            style={[styles.input, formErrors.email && styles.inputError]}
            placeholder="Email"
            placeholderTextColor="#666"
            autoCapitalize="none"
            secureTextEntry={false}
            onChangeText={(text) => {
              setEmail(text);
              validateField("email", text);
            }}
            value={email}
            inputMode="email"
            accessibilityLabel="Email input"
            accessibilityHint="Enter your email address"
          />
          {formErrors.email ? (
            <Text style={styles.errorText}>{formErrors.email}</Text>
          ) : null}

          <Text style={styles.subtitle}>Phone Number</Text>
          <TextInput
            style={[styles.input, formErrors.phoneNumber && styles.inputError]}
            placeholder="(555) 555-5555"
            placeholderTextColor="#666"
            autoCapitalize="none"
            secureTextEntry={false}
            onChangeText={handlePhoneChange}
            value={phoneNumber}
            inputMode="tel"
            accessibilityLabel="Phone Number input"
            accessibilityHint="Enter your phone number"
          />
          {formErrors.phoneNumber ? (
            <Text style={styles.errorText}>{formErrors.phoneNumber}</Text>
          ) : null}

          {/* Profile Song Section */}
          <View style={styles.profileSongSection}>
            <View style={styles.profileSongHeader}>
              <MaterialCommunityIcons
                name="music-note"
                size={20}
                color={GlobalStyles.colors.accent}
              />
              <Text style={styles.subtitle}>Profile Song</Text>
            </View>
            <Text style={styles.profileSongHint}>
              Add a track from SoundCloud, Spotify, or YouTube
            </Text>
            <View style={styles.profileSongInputContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.profileSongInput,
                  formErrors.profileSongUrl && styles.inputError,
                ]}
                placeholder="Paste any music link..."
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
                value={profileSongUrl}
                onChangeText={handleProfileSongChange}
                accessibilityLabel="Profile Song URL input"
                accessibilityHint="Enter a SoundCloud, Spotify, or YouTube URL for your profile song"
              />
              {profileSongUrl.trim() !== "" && (
                <Pressable
                  onPress={clearProfileSong}
                  style={styles.clearSongButton}
                  accessibilityRole="button"
                  accessibilityLabel="Clear profile song"
                >
                  <MaterialCommunityIcons
                    name="close-circle"
                    size={24}
                    color="#888"
                  />
                </Pressable>
              )}
            </View>
            {formErrors.profileSongUrl ? (
              <Text style={styles.errorText}>{formErrors.profileSongUrl}</Text>
            ) : null}

            {/* Song Preview */}
            {songLoading && (
              <View style={styles.songPreviewContainer}>
                <ActivityIndicator
                  size="small"
                  color={GlobalStyles.colors.accent}
                />
                <Text style={styles.songPreviewText}>Loading preview...</Text>
              </View>
            )}
            {songPreview && !songLoading && (
              <View style={styles.songPreviewContainer}>
                <MaterialCommunityIcons
                  name={getMusicPlatformConfig(detectedPlatform).icon as any}
                  size={20}
                  color={getMusicPlatformConfig(detectedPlatform).color}
                />
                <Text style={styles.songPreviewText} numberOfLines={1}>
                  {songPreview.title}
                </Text>
              </View>
            )}
            {songError && !songLoading && profileSongUrl.trim() !== "" && (
              <View style={styles.songPreviewContainer}>
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={20}
                  color="#FF6B6B"
                />
                <Text style={styles.songErrorText}>
                  Unable to load track preview
                </Text>
              </View>
            )}
          </View>

          {/* Social Links Section - Collapsible */}
          <View style={styles.socialLinksSection}>
            <Pressable
              onPress={() => setSocialLinksExpanded(!socialLinksExpanded)}
              style={styles.socialLinksHeader}
              accessibilityRole="button"
              accessibilityLabel={`Social links section, ${
                socialLinksExpanded ? "expanded" : "collapsed"
              }`}
            >
              <View style={styles.socialLinksHeaderLeft}>
                <MaterialCommunityIcons
                  name="link-variant"
                  size={20}
                  color={GlobalStyles.colors.accent}
                />
                <Text style={styles.subtitle}>Social Links (optional)</Text>
              </View>
              <MaterialCommunityIcons
                name={socialLinksExpanded ? "chevron-up" : "chevron-down"}
                size={24}
                color="#888"
              />
            </Pressable>

            {socialLinksExpanded && (
              <View style={styles.socialLinksContent}>
                {/* X (Twitter) Input */}
                <View style={styles.socialLinkInputRow}>
                  <View style={styles.socialLinkIconContainer}>
                    <XLogo size={20} color="#000" />
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      styles.socialLinkInput,
                      formErrors.twitterUrl && styles.inputError,
                    ]}
                    placeholder="https://x.com/username"
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={twitterUrl}
                    onChangeText={(text) => {
                      setTwitterUrl(text);
                      validateField("twitterUrl", text);
                    }}
                    accessibilityLabel="X Twitter URL input"
                    accessibilityHint="Enter your X or Twitter profile URL"
                  />
                </View>
                {formErrors.twitterUrl ? (
                  <Text style={styles.errorText}>{formErrors.twitterUrl}</Text>
                ) : null}

                {/* Instagram Input */}
                <View style={styles.socialLinkInputRow}>
                  <View
                    style={[
                      styles.socialLinkIconContainer,
                      { backgroundColor: "#E4405F" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="instagram"
                      size={20}
                      color="#fff"
                    />
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      styles.socialLinkInput,
                      formErrors.instagramUrl && styles.inputError,
                    ]}
                    placeholder="https://instagram.com/username"
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={instagramUrl}
                    onChangeText={(text) => {
                      setInstagramUrl(text);
                      validateField("instagramUrl", text);
                    }}
                    accessibilityLabel="Instagram URL input"
                    accessibilityHint="Enter your Instagram profile URL"
                  />
                </View>
                {formErrors.instagramUrl ? (
                  <Text style={styles.errorText}>
                    {formErrors.instagramUrl}
                  </Text>
                ) : null}

                {/* TikTok Input */}
                <View style={styles.socialLinkInputRow}>
                  <View style={styles.socialLinkIconContainer}>
                    <MaterialCommunityIcons
                      name="music-note"
                      size={20}
                      color="#000"
                    />
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      styles.socialLinkInput,
                      formErrors.tiktokUrl && styles.inputError,
                    ]}
                    placeholder="https://tiktok.com/@username"
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={tiktokUrl}
                    onChangeText={(text) => {
                      setTiktokUrl(text);
                      validateField("tiktokUrl", text);
                    }}
                    accessibilityLabel="TikTok URL input"
                    accessibilityHint="Enter your TikTok profile URL"
                  />
                </View>
                {formErrors.tiktokUrl ? (
                  <Text style={styles.errorText}>{formErrors.tiktokUrl}</Text>
                ) : null}

                {/* SoundCloud Input */}
                <View style={styles.socialLinkInputRow}>
                  <View
                    style={[
                      styles.socialLinkIconContainer,
                      { backgroundColor: "#FF5500" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="soundcloud"
                      size={20}
                      color="#fff"
                    />
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      styles.socialLinkInput,
                      formErrors.soundcloudUrl && styles.inputError,
                    ]}
                    placeholder="https://soundcloud.com/username"
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={soundcloudUrl}
                    onChangeText={(text) => {
                      setSoundcloudUrl(text);
                      validateField("soundcloudUrl", text);
                    }}
                    accessibilityLabel="SoundCloud URL input"
                    accessibilityHint="Enter your SoundCloud profile URL"
                  />
                </View>
                {formErrors.soundcloudUrl ? (
                  <Text style={styles.errorText}>
                    {formErrors.soundcloudUrl}
                  </Text>
                ) : null}

                {/* Spotify Input */}
                <View style={styles.socialLinkInputRow}>
                  <View
                    style={[
                      styles.socialLinkIconContainer,
                      { backgroundColor: "#1DB954" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="spotify"
                      size={20}
                      color="#fff"
                    />
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      styles.socialLinkInput,
                      formErrors.spotifyUrl && styles.inputError,
                    ]}
                    placeholder="https://open.spotify.com/artist/..."
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={spotifyUrl}
                    onChangeText={(text) => {
                      setSpotifyUrl(text);
                      validateField("spotifyUrl", text);
                    }}
                    accessibilityLabel="Spotify URL input"
                    accessibilityHint="Enter your Spotify artist or profile URL"
                  />
                </View>
                {formErrors.spotifyUrl ? (
                  <Text style={styles.errorText}>{formErrors.spotifyUrl}</Text>
                ) : null}

                {/* YouTube Input */}
                <View style={styles.socialLinkInputRow}>
                  <View
                    style={[
                      styles.socialLinkIconContainer,
                      { backgroundColor: "#FF0000" },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="youtube"
                      size={20}
                      color="#fff"
                    />
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      styles.socialLinkInput,
                      formErrors.youtubeUrl && styles.inputError,
                    ]}
                    placeholder="https://youtube.com/@username"
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={youtubeUrl}
                    onChangeText={(text) => {
                      setYoutubeUrl(text);
                      validateField("youtubeUrl", text);
                    }}
                    accessibilityLabel="YouTube URL input"
                    accessibilityHint="Enter your YouTube channel URL"
                  />
                </View>
                {formErrors.youtubeUrl ? (
                  <Text style={styles.errorText}>{formErrors.youtubeUrl}</Text>
                ) : null}
              </View>
            )}
          </View>
        </View>

        {/* Tab Container */}
        <View style={styles.tabContainer}>
          <Pressable
            onPress={cancelEditHandler}
            style={styles.tabButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel edit"
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>CANCEL</Text>
          </Pressable>

          <Pressable
            onPress={confirmEditHandler}
            style={[styles.tabButton, isSubmitting && styles.disabledButton]}
            accessibilityRole="button"
            accessibilityLabel="Confirm edit"
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>
              {isSubmitting ? "UPDATING..." : "CONFIRM"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Define font family with proper type
const fontFamily: string =
  Platform.select({
    ios: "Helvetica Neue",
    android: "Roboto",
    default: "system",
  }) || "system"; // Provide fallback for null/undefined

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
  },
  scrollView: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Dimensions.get("window").height * 0.12,
  },
  headline: {
    fontFamily,
    paddingTop: 10,
    textAlign: "center",
    textTransform: "uppercase",
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 20,
  },
  subtitle: {
    fontFamily,
    paddingBottom: 5,
    fontSize: 16,
    color: "white",
    fontWeight: "500",
  },
  input: {
    backgroundColor: "#222",
    padding: 14,
    marginBottom: 16,
    borderRadius: 8,
    fontFamily,
    width: "100%",
    fontSize: 16,
    color: "white",
    borderWidth: 1,
    borderColor: "#555",
  },
  inputError: {
    borderColor: "#FF6B6B", // Red border for error state
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 12,
    marginBottom: 10,
    marginTop: -8,
    fontFamily,
  },
  errorNoticeContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  editProfileContainer: {
    paddingTop: 10,
    width: "100%",
    paddingHorizontal: 20,
  },
  tabContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 20,
    width: "100%",
  },
  tabButton: {
    backgroundColor: "#222",
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#555",
    width: "48%",
  },
  disabledButton: {
    backgroundColor: "#333",
    borderColor: "#444",
    opacity: 0.7,
  },
  buttonText: {
    fontFamily,
    textAlign: "center",
    color: "white",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  // Profile Song styles
  profileSongSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  profileSongHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  profileSongHint: {
    fontFamily,
    fontSize: 12,
    color: "#888",
    marginBottom: 12,
  },
  profileSongInputContainer: {
    position: "relative",
    width: "100%",
  },
  profileSongInput: {
    paddingRight: 44, // Make room for the clear button
  },
  clearSongButton: {
    position: "absolute",
    right: 12,
    top: 12,
    padding: 4,
  },
  songPreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    marginTop: -8,
    marginBottom: 8,
  },
  songPreviewText: {
    fontFamily,
    fontSize: 14,
    color: "#ccc",
    flex: 1,
  },
  songErrorText: {
    fontFamily,
    fontSize: 14,
    color: "#FF6B6B",
    flex: 1,
  },
  // Social Links styles
  socialLinksSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  socialLinksHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    marginBottom: 4,
  },
  socialLinksHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  socialLinksContent: {
    marginTop: 8,
  },
  socialLinkInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  socialLinkIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  socialLinkInput: {
    flex: 1,
    marginBottom: 0,
  },
});

export default EditProfile;
