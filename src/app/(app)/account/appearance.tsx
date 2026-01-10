/**
 * Appearance Settings Screen
 * Allows users to choose between Light, Dark, or System theme mode
 */

import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import React from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { ThemeMode } from "../../../constants/themes";
import { useTheme } from "../../../contexts/ThemeContext";

interface ThemeOptionProps {
  label: string;
  description: string;
  value: ThemeMode;
  currentValue: ThemeMode;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: (value: ThemeMode) => void;
}

function ThemeOption({
  label,
  description,
  value,
  currentValue,
  icon,
  onPress,
}: ThemeOptionProps) {
  const { theme } = useTheme();
  const isSelected = value === currentValue;

  return (
    <TouchableOpacity
      style={[
        styles.optionContainer,
        {
          backgroundColor: isSelected
            ? theme.colors.accentMuted
            : theme.colors.bgElev1,
          borderColor: isSelected
            ? theme.colors.accent
            : theme.colors.borderSubtle,
        },
      ]}
      onPress={() => onPress(value)}
      activeOpacity={0.7}
    >
      <View style={styles.optionContent}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: isSelected
                ? theme.colors.accent
                : theme.colors.bgElev2,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={24}
            color={isSelected ? "#fff" : theme.colors.textSecondary}
          />
        </View>
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.optionLabel,
              {
                color: theme.colors.textPrimary,
                fontWeight: isSelected ? "600" : "500",
              },
            ]}
          >
            {label}
          </Text>
          <Text
            style={[
              styles.optionDescription,
              { color: theme.colors.textSecondary },
            ]}
          >
            {description}
          </Text>
        </View>
      </View>
      <View
        style={[
          styles.radioOuter,
          {
            borderColor: isSelected
              ? theme.colors.accent
              : theme.colors.borderStrong,
          },
        ]}
      >
        {isSelected && (
          <View
            style={[
              styles.radioInner,
              { backgroundColor: theme.colors.accent },
            ]}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function AppearanceSettings() {
  const { theme, mode, setMode, isDark } = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.bgRoot }]}
    >
      <Stack.Screen
        options={{
          title: "Appearance",
          headerStyle: { backgroundColor: theme.colors.bgElev1 },
          headerTintColor: theme.colors.textPrimary,
          headerShadowVisible: false,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Theme Options */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            THEME
          </Text>

          <View style={styles.optionsContainer}>
            <ThemeOption
              label="Light"
              description="Always use light theme"
              value="light"
              currentValue={mode}
              icon="sunny"
              onPress={setMode}
            />

            <ThemeOption
              label="Dark"
              description="Always use dark theme"
              value="dark"
              currentValue={mode}
              icon="moon"
              onPress={setMode}
            />

            <ThemeOption
              label="System"
              description="Match your device settings"
              value="system"
              currentValue={mode}
              icon="phone-portrait-outline"
              onPress={setMode}
            />
          </View>
        </View>

        {/* Current Theme Info */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            CURRENT THEME
          </Text>

          <View
            style={[
              styles.infoCard,
              {
                backgroundColor: theme.colors.bgElev1,
                borderColor: theme.colors.borderSubtle,
              },
            ]}
          >
            <View style={styles.infoRow}>
              <Text
                style={[
                  styles.infoLabel,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Active Theme
              </Text>
              <Text
                style={[styles.infoValue, { color: theme.colors.textPrimary }]}
              >
                {isDark ? "Dark" : "Light"}
              </Text>
            </View>

            {mode === "system" && (
              <View style={styles.infoRow}>
                <Text
                  style={[
                    styles.infoLabel,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  System Setting
                </Text>
                <Text
                  style={[
                    styles.infoValue,
                    { color: theme.colors.textPrimary },
                  ]}
                >
                  {isDark ? "Dark Mode" : "Light Mode"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Preview Section */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}
          >
            PREVIEW
          </Text>

          <View
            style={[
              styles.previewCard,
              {
                backgroundColor: theme.colors.bgElev1,
                borderColor: theme.colors.borderSubtle,
                ...theme.shadows.card,
              },
            ]}
          >
            <View style={styles.previewHeader}>
              <View
                style={[
                  styles.previewAvatar,
                  { backgroundColor: theme.colors.accent },
                ]}
              >
                <Text style={styles.previewAvatarText}>RS</Text>
              </View>
              <View style={styles.previewHeaderText}>
                <Text
                  style={[
                    styles.previewTitle,
                    { color: theme.colors.textPrimary },
                  ]}
                >
                  RAGE STATE
                </Text>
                <Text
                  style={[
                    styles.previewSubtitle,
                    { color: theme.colors.textTertiary },
                  ]}
                >
                  Just now
                </Text>
              </View>
            </View>
            <Text
              style={[
                styles.previewBody,
                { color: theme.colors.textSecondary },
              ]}
            >
              This is how your content will look with the{" "}
              {isDark ? "dark" : "light"} theme applied.
            </Text>
            <View style={styles.previewActions}>
              <View
                style={[
                  styles.previewButton,
                  { backgroundColor: theme.colors.accent },
                ]}
              >
                <Text style={styles.previewButtonText}>Action</Text>
              </View>
              <View
                style={[
                  styles.previewButtonOutline,
                  { borderColor: theme.colors.borderStrong },
                ]}
              >
                <Text
                  style={[
                    styles.previewButtonOutlineText,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Secondary
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  optionsContainer: {
    gap: 12,
  },
  optionContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  infoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  previewCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  previewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  previewAvatarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  previewHeaderText: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  previewSubtitle: {
    fontSize: 12,
  },
  previewBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  previewActions: {
    flexDirection: "row",
    gap: 12,
  },
  previewButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  previewButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  previewButtonOutline: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
  },
  previewButtonOutlineText: {
    fontSize: 13,
    fontWeight: "500",
  },
});
