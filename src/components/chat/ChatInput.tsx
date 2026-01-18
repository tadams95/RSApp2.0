import { MaterialCommunityIcons } from "@expo/vector-icons";
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
  onSend: (text: string) => Promise<void>;
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
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const handleSend = async () => {
    const trimmedText = text.trim();
    if (!trimmedText || isSending) return;

    try {
      await onSend(trimmedText);
      setText("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const canSend = text.trim().length > 0 && !isSending;

  return (
    <View style={[styles.container, style]}>
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
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <MaterialCommunityIcons
            name="send"
            size={18}
            color="#FFFFFF"
          />
        )}
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    flexDirection: "row" as const,
    alignItems: "flex-end" as const,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.bgElev1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderSubtle,
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
