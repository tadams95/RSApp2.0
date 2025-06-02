import React, { useState } from "react";
import { Dimensions, StyleSheet, View, ViewStyle } from "react-native";
import Carousel from "react-native-reanimated-carousel";

interface AppCarouselProps {
  data: any[];
  renderItem: (info: { item: any; index: number }) => React.ReactElement;
  height: number;
  width?: number;
  autoPlay?: boolean;
  loop?: boolean;
  showsPagination?: boolean;
  paginationStyle?: ViewStyle;
  containerStyle?: ViewStyle;
  currentIndex?: number;
  onSnapToItem?: (index: number) => void;
  scrollAnimationDuration?: number; // This prop won't be passed directly to Carousel
}

const AppCarousel: React.FC<AppCarouselProps> = ({
  data,
  renderItem,
  height,
  width,
  autoPlay = false,
  loop = true,
  showsPagination = true,
  paginationStyle,
  containerStyle,
  currentIndex = 0,
  onSnapToItem,
  scrollAnimationDuration = 1000,
  ...rest
}) => {
  // Internal state to track current index if no external state is provided
  const [internalIndex, setInternalIndex] = useState(currentIndex);

  // Use internal or external index depending on whether onSnapToItem is provided
  const activeIndex = onSnapToItem ? currentIndex : internalIndex;

  // Use provided width or default to window width
  const screenWidth = width || Dimensions.get("window").width;

  // Handle index changes
  const handleSnapToItem = (index: number) => {
    setInternalIndex(index);
    if (onSnapToItem) {
      onSnapToItem(index);
    }
  };

  // Create custom pagination dots
  const renderPagination = () => {
    if (!showsPagination) return null;

    return (
      <View style={[styles.paginationContainer, paginationStyle]}>
        {data.map((_, i) => (
          <View
            key={i}
            style={[
              styles.paginationDot,
              i === activeIndex ? styles.paginationActiveDot : {},
            ]}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Carousel
        width={screenWidth}
        height={height}
        data={data}
        renderItem={renderItem}
        loop={loop}
        autoPlay={autoPlay}
        autoPlayInterval={3000}
        onSnapToItem={handleSnapToItem}
        defaultIndex={activeIndex}
        {...rest}
      />
      {renderPagination()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  paginationContainer: {
    position: "absolute",
    bottom: 10,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  paginationActiveDot: {
    backgroundColor: "#fff",
  },
});

export default AppCarousel;
