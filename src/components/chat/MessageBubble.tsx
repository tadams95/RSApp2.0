import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import type { Message } from "../../types/chat";
import type { Theme } from "../../constants/themes";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSender?: boolean;
}

/**
 * Format time for message display (e.g., "2:30 PM")
 */
function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showSender = false,
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);

  const hasMedia = !!message.mediaUrl;
  const hasText = !!message.text;

  return (
    <View style={[styles.container, isOwn ? styles.containerOwn : styles.containerOther]}>
      {showSender && !isOwn && (
        <View style={styles.senderRow}>
          {message.senderPhoto && (
            <Image source={{ uri: message.senderPhoto }} style={styles.senderPhoto} />
          )}
          <Text style={styles.senderName}>{message.senderName}</Text>
        </View>
      )}
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther, hasMedia && styles.bubbleWithMedia]}>
        {/* Media Content */}
        {hasMedia && (
          <TouchableOpacity
            onPress={() => setImageViewerVisible(true)}
            activeOpacity={0.9}
          >
            <ExpoImage
              source={{ uri: message.mediaUrl }}
              style={styles.messageImage}
              contentFit="cover"
            />
          </TouchableOpacity>
        )}
        {/* Text Content */}
        {hasText && (
          <Text style={[styles.text, isOwn ? styles.textOwn : styles.textOther, hasMedia && styles.textWithMedia]}>
            {message.text}
          </Text>
        )}
      </View>
      <View style={[styles.timeRow, isOwn ? styles.timeRowOwn : styles.timeRowOther]}>
        <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}>
          {formatMessageTime(message.createdAt)}
        </Text>
        {isOwn && (
          <View style={styles.statusContainer}>
            {message.status === "sending" ? (
              <ActivityIndicator size={10} color={theme.colors.textTertiary} />
            ) : (
              <Ionicons
                name="checkmark"
                size={12}
                color={theme.colors.textTertiary}
              />
            )}
          </View>
        )}
      </View>

      {/* Full-screen Image Viewer */}
      {hasMedia && (
        <Modal
          visible={imageViewerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setImageViewerVisible(false)}
        >
          <Pressable
            style={styles.imageViewerContainer}
            onPress={() => setImageViewerVisible(false)}
          >
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setImageViewerVisible(false)}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <ExpoImage
              source={{ uri: message.mediaUrl }}
              style={styles.fullImage}
              contentFit="contain"
            />
          </Pressable>
        </Modal>
      )}
    </View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    marginVertical: 4,
    maxWidth: "80%" as const,
  },
  containerOwn: {
    alignSelf: "flex-end" as const,
  },
  containerOther: {
    alignSelf: "flex-start" as const,
  },
  senderRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 4,
  },
  senderPhoto: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 4,
  },
  senderName: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: "500" as const,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    overflow: "hidden" as const,
  },
  bubbleOwn: {
    backgroundColor: theme.colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: theme.colors.bgElev1,
    borderBottomLeftRadius: 4,
  },
  bubbleWithMedia: {
    padding: 4,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  textWithMedia: {
    marginTop: 8,
    marginHorizontal: 10,
    marginBottom: 6,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  textOwn: {
    color: theme.colors.textInverse,
  },
  textOther: {
    color: theme.colors.textPrimary,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  closeButton: {
    position: "absolute" as const,
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullImage: {
    width: "100%" as const,
    height: "80%" as const,
  },
  timeRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginTop: 4,
  },
  timeRowOwn: {
    justifyContent: "flex-end" as const,
  },
  timeRowOther: {
    justifyContent: "flex-start" as const,
  },
  time: {
    fontSize: 11,
  },
  timeOwn: {
    color: theme.colors.textTertiary,
  },
  timeOther: {
    color: theme.colors.textTertiary,
  },
  statusContainer: {
    marginLeft: 4,
  },
});
