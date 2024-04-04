import React, { useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Animated,
  StyleSheet,
  useWindowDimensions,
  Easing,
} from "react-native";
import { GlobalStyles } from "../../constants/styles";

const TickerAnnouncement = ({ announcements }) => {
  const { width: screenWidth } = useWindowDimensions(); // Get the width of the screen
  const announcementWidth = useMemo(() => screenWidth * 1.65, [screenWidth]); // Set the announcement width to 80% of the screen width

  // Set initial position to -announcementWidth
  const translateX = useRef(new Animated.Value(-announcementWidth)).current;

  // Duplicate announcements to create a seamless loop
  const concatenatedAnnouncements = useMemo(
    () => announcements.concat(announcements),
    [announcements]
  );

  useEffect(() => {
    const totalWidth = concatenatedAnnouncements.length * announcementWidth;

    // Check if translateX has a valid value before starting the animation
    if (!isNaN(translateX._value)) {
      const animation = Animated.loop(
        Animated.timing(translateX, {
          toValue: -totalWidth,
          duration: totalWidth * 30, // Adjust the duration based on the total width
          useNativeDriver: true,
          easing: Easing.linear,
        })
      );

      animation.start();

      return () => {
        animation.stop();
      };
    }
  }, [concatenatedAnnouncements, announcementWidth, translateX]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={{ flexDirection: "row", transform: [{ translateX }] }}
      >
        {concatenatedAnnouncements.map((announcement, index) => (
          <Text
            key={index}
            style={[styles.announcementText, { width: announcementWidth }]}
          >
            {announcement}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "black",
    padding: 10,
  },
  announcementText: {
    fontSize: 16,
    marginRight: 20,
    color: GlobalStyles.colors.grey0,
    fontFamily: "ProximaNovaBold",
  },
});

export default TickerAnnouncement;
