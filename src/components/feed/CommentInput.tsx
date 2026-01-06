import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GlobalStyles } from "../../constants/styles";

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
        placeholderTextColor={GlobalStyles.colors.grey5}
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
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <MaterialCommunityIcons
            name="send"
            size={20}
            color={canSubmit ? "#fff" : GlobalStyles.colors.grey6}
          />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GlobalStyles.colors.grey8,
    backgroundColor: "#000",
  },
  input: {
    flex: 1,
    backgroundColor: GlobalStyles.colors.grey9,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingRight: 40,
    color: "#fff",
    fontSize: 14,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    position: "absolute",
    right: 24,
    bottom: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GlobalStyles.colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: GlobalStyles.colors.grey8,
  },
});
