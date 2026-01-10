import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";

interface CommentInputProps {
  onSubmit: (content: string) => Promise<void>;
  isSubmitting?: boolean;
  placeholder?: string;
}

export const CommentInput: React.FC<CommentInputProps> = ({
  onSubmit,
  isSubmitting = false,
  placeholder = "Add a comment...",
}) => {
  const [text, setText] = useState("");
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const handleSubmit = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || isSubmitting) return;

    try {
      await onSubmit(trimmedText);
      setText(""); // Clear input on success
    } catch (error) {
      // Error is handled by parent
      console.error("Failed to submit comment:", error);
    }
  };

  const canSubmit = text.trim().length > 0 && !isSubmitting;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        multiline
        maxLength={500}
        editable={!isSubmitting}
      />
      <TouchableOpacity
        style={[styles.sendButton, !canSubmit && styles.sendButtonDisabled]}
        onPress={handleSubmit}
        disabled={!canSubmit}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={theme.colors.textPrimary} />
        ) : (
          <MaterialCommunityIcons
            name="send"
            size={20}
            color={
              canSubmit ? theme.colors.textPrimary : theme.colors.textTertiary
            }
          />
        )}
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: import("../../constants/themes").Theme) => ({
  container: {
    flexDirection: "row" as const,
    alignItems: "flex-end" as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgRoot,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.bgElev1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 48,
    color: theme.colors.textPrimary,
    fontSize: 14,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    position: "absolute" as const,
    right: 22,
    top: 16,
    bottom: 18,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.accent,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.borderSubtle,
  },
});
