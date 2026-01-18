import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import type { Theme } from "../../constants/themes";

interface EmptyChatProps {
  onNewChat?: () => void;
}

export const EmptyChat: React.FC<EmptyChatProps> = ({ onNewChat }) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name="chat-outline"
        size={64}
        color={theme.colors.textTertiary}
      />
      <Text style={styles.title}>No messages yet</Text>
      <Text style={styles.subtitle}>
        Start a conversation or join an event chat
      </Text>
      {onNewChat && (
        <TouchableOpacity style={styles.button} onPress={onNewChat}>
          <Text style={styles.buttonText}>Start a Chat</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    padding: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center" as const,
    marginBottom: 24,
  },
  button: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: theme.colors.textInverse,
  },
});
