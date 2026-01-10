import React from "react";
import { Text, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";

interface PasswordStrengthMeterProps {
  password: string;
  testID?: string;
}

/**
 * A visual component that shows password strength during signup
 * Uses color coding and descriptive text to help users create strong passwords
 */
const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({
  password,
  testID,
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Skip rendering if password is empty
  if (!password) return null;

  // Password strength criteria
  const criteria = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[@$!%*?&#]/.test(password),
  };

  // Calculate password strength as a percentage (0-100)
  const strengthScore = Object.values(criteria).filter(Boolean).length;
  const strengthPercent = (strengthScore / 5) * 100;

  // Determine strength level and color
  let strengthLevel: string;
  let strengthColor: string;

  if (strengthPercent <= 20) {
    strengthLevel = "Very Weak";
    strengthColor = "#FF3B30"; // Red
  } else if (strengthPercent <= 40) {
    strengthLevel = "Weak";
    strengthColor = "#FF9500"; // Orange
  } else if (strengthPercent <= 60) {
    strengthLevel = "Moderate";
    strengthColor = "#FFCC00"; // Yellow
  } else if (strengthPercent <= 80) {
    strengthLevel = "Strong";
    strengthColor = "#34C759"; // Green
  } else {
    strengthLevel = "Very Strong";
    strengthColor = "#00C8D7"; // Teal
  }

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.strengthBarContainer}>
        <View
          style={[
            styles.strengthBar,
            { width: `${strengthPercent}%`, backgroundColor: strengthColor },
          ]}
        />
      </View>

      <Text style={[styles.strengthText, { color: strengthColor }]}>
        {strengthLevel}
      </Text>

      {/* Password requirements checklist */}
      <View style={styles.requirementsList}>
        <RequirementItem met={criteria.length} text="At least 8 characters" />
        <RequirementItem
          met={criteria.uppercase}
          text="At least 1 uppercase letter"
        />
        <RequirementItem
          met={criteria.lowercase}
          text="At least 1 lowercase letter"
        />
        <RequirementItem met={criteria.number} text="At least 1 number" />
        <RequirementItem
          met={criteria.special}
          text="At least 1 special character"
        />
      </View>
    </View>
  );
};

interface RequirementItemProps {
  met: boolean;
  text: string;
}

const RequirementItem: React.FC<RequirementItemProps> = ({ met, text }) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.requirementItem}>
      <Text
        style={[
          styles.checkmark,
          { color: met ? "#34C759" : theme.colors.textSecondary },
        ]}
      >
        {met ? "✓" : "○"}
      </Text>
      <Text
        style={[
          styles.requirementText,
          {
            color: met ? theme.colors.textPrimary : theme.colors.textSecondary,
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
};

const createStyles = (theme: import("../../constants/themes").Theme) => ({
  container: {
    marginVertical: 8,
    width: "100%" as const,
  },
  strengthBarContainer: {
    width: "100%" as const,
    height: 6,
    backgroundColor: theme.colors.borderSubtle,
    borderRadius: 3,
    overflow: "hidden" as const,
    marginBottom: 4,
  },
  strengthBar: {
    height: "100%" as const,
    borderRadius: 3,
  },
  strengthText: {
    fontSize: 12,
    marginBottom: 8,
    textAlign: "right" as const,
    fontWeight: "bold" as const,
  },
  requirementsList: {
    marginTop: 4,
  },
  requirementItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginVertical: 2,
  },
  checkmark: {
    fontSize: 12,
    marginRight: 6,
    width: 14,
    textAlign: "center" as const,
  },
  requirementText: {
    fontSize: 12,
  },
});

export default PasswordStrengthMeter;
