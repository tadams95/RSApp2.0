import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import type { Theme } from "../../constants/themes";

interface ChatInputProps {
  onSend: (text: string, mediaUri?: string) => Promise<void>;
  isSending?: boolean;
  placeholder?: string;
  style?: ViewStyle;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  isSending = false,
  placeholder = "Message...",
  style,
}) => {
  const [text, setText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const handlePickImage = async () => {
    if (isSending) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      aspect: [4, 3],
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
  };

  const handleSend = async () => {
    const trimmedText = text.trim();
    if ((!trimmedText && !selectedImage) || isSending) return;

    try {
      await onSend(trimmedText, selectedImage || undefined);
      setText("");
      setSelectedImage(null);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const canSend = (text.trim().length > 0 || selectedImage) && !isSending;

  return (
    <View style={[styles.wrapper, style]}>
      {/* Image Preview */}
      {selectedImage && (
        <View style={styles.previewContainer}>
          <ExpoImage
            source={{ uri: selectedImage }}
            style={styles.previewImage}
            contentFit="cover"
          />
          <TouchableOpacity
            style={styles.removeButton}
            onPress={handleRemoveImage}
            disabled={isSending}
          >
            <Ionicons name="close-circle" size={24} color={theme.colors.danger} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Row */}
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={handlePickImage}
          disabled={isSending}
        >
          <Ionicons
            name="image-outline"
            size={24}
            color={isSending ? theme.colors.textTertiary : theme.colors.textSecondary}
          />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          maxLength={2000}
          editable={!isSending}
        />

        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={theme.colors.textInverse} />
          ) : (
            <MaterialCommunityIcons
              name="send"
              size={18}
              color={theme.colors.textInverse}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: Theme) => ({
  wrapper: {
    backgroundColor: theme.colors.bgElev1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSubtle,
  },
  previewContainer: {
    position: "relative" as const,
    marginHorizontal: 12,
    marginTop: 8,
    alignSelf: "flex-start" as const,
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeButton: {
    position: "absolute" as const,
    top: -8,
    right: -8,
    backgroundColor: theme.colors.bgElev1,
    borderRadius: 12,
  },
  container: {
    flexDirection: "row" as const,
    alignItems: "flex-end" as const,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  attachButton: {
    padding: 8,
    marginRight: 4,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.bgRoot,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 48,
    color: theme.colors.textPrimary,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    position: "absolute" as const,
    right: 18,
    bottom: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.accent,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
