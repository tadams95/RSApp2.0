import React from "react";
import { StyleSheet, Text, View } from "react-native";

/**
 * ComponentName - Brief description of what this component does
 *
 * @param {object} props - Component props
 * @param {string} props.title - Description of the title prop
 * @returns {React.ReactElement} A React component
 */
const ComponentName = ({ title, ...props }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
});

export default ComponentName;
