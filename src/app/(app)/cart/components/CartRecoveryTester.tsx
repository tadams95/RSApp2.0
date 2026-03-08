import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import type { Theme } from "../../../../constants/themes";
import { useThemedStyles } from "../../../../hooks/useThemedStyles";
import { runCartRecoveryTests } from "../../../../utils/cart/testCartRecovery";

/**
 * Development test component to trigger cart recovery test scenarios
 * Only use during development and testing - remove before production
 */
const CartRecoveryTester: React.FC = () => {
  const styles = useThemedStyles(createStyles);

  // Only show this component in development mode
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.testButton}
        onPress={() => runCartRecoveryTests()}
      >
        <Text style={styles.buttonText}>Test Cart Recovery</Text>
      </TouchableOpacity>
      <Text style={styles.devNote}>DEV ONLY: Recovery Testing Tool</Text>
    </View>
  );
};

const createStyles = (theme: Theme) =>
  ({
    container: {
      padding: 10,
      backgroundColor: theme.colors.borderStrong,
      borderRadius: theme.radius.button,
      margin: 10,
      alignItems: "center" as const,
      borderWidth: 1,
      borderColor: theme.colors.danger,
      borderStyle: "dashed" as const,
    },
    testButton: {
      backgroundColor: theme.colors.danger,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: 15,
      borderRadius: 6,
      marginBottom: 5,
    },
    buttonText: {
      color: theme.colors.textPrimary,
      fontWeight: theme.typography.weights.semibold,
    },
    devNote: {
      color: theme.colors.textSecondary,
      fontSize: 10,
      fontStyle: "italic" as const,
    },
  } as const);

export default CartRecoveryTester;
