import { useEffect, useState, useRef, useCallback } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  Platform,
  Dimensions,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Animated,
  TouchableWithoutFeedback,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { db } from "../../firebase/firebase";
import { collection, getDocs } from "firebase/firestore";
import { format } from "date-fns";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Create animated FlatList component
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

export default function GuestEvent({ navigation }) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedImages, setLoadedImages] = useState({});
  const flatListRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [isScrollEnabled, setIsScrollEnabled] = useState(true);

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const eventCollectionRef = collection(db, "events");
        const eventSnapshot = await getDocs(eventCollectionRef);

        const currentDate = new Date();

        // Filter out past events
        const eventData = eventSnapshot.docs
          .map((doc) => doc.data())
          .filter((event) => {
            const eventDateTime = event.dateTime.toDate();
            return eventDateTime >= currentDate;
          })
          .sort((a, b) => {
            // Sort events by date
            return a.dateTime.toDate() - b.dateTime.toDate();
          });

        setEvents(eventData);
      } catch (error) {
        console.error("Error fetching event data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventData();
  }, []);

  const handleEventPress = (event) => {
    const formattedDateTime = format(
      event.dateTime.toDate(),
      "MMM dd, yyyy hh:mm a"
    );
    navigation.navigate("GuestEventView", {
      eventData: { ...event, dateTime: formattedDateTime },
    });
  };

  const handleImageLoad = (eventId) => {
    setLoadedImages((prev) => ({ ...prev, [eventId]: true }));
  };

  const handlePressIn = useCallback(() => {
    setIsScrollEnabled(false);
  }, []);
  
  const handlePressOut = useCallback(() => {
    // Short delay to ensure the press is registered before re-enabling scroll
    setTimeout(() => setIsScrollEnabled(true), 200);
  }, []);

  const renderEventItem = ({ item, index }) => {
    const eventId = item.name + index;
    const isImageLoaded = loadedImages[eventId];
    const formattedDate = format(item.dateTime.toDate(), "MMM dd, yyyy");
    
    return (
      <View style={styles.eventSlide}>
        <Image
          source={{ uri: item.imgURL }}
          style={styles.eventImage}
          onLoad={() => handleImageLoad(eventId)}
        />
        
        {!isImageLoaded && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="white" />
          </View>
        )}
        
        {/* Gradient overlay at the bottom for better text visibility */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.9)']}
          style={styles.gradient}
        />
        
        <View style={styles.eventContent}>
          <Text style={styles.eventName}>{item.name}</Text>
          
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={18} color="white" />
              <Text style={styles.detailText}>{formattedDate}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Ionicons name="cash-outline" size={18} color="white" />
              <Text style={styles.detailText}>${item.price}</Text>
            </View>
          </View>
          
          <TouchableWithoutFeedback
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
          >
            <TouchableOpacity
              style={styles.viewButton}
              onPress={() => handleEventPress(item)}
              activeOpacity={0.7}
            >
              <Text style={styles.viewButtonText}>VIEW EVENT</Text>
            </TouchableOpacity>
          </TouchableWithoutFeedback>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="white" />
        <Text style={styles.loaderText}>Loading events...</Text>
      </View>
    );
  }

  if (events.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="calendar-outline" size={70} color="#555" />
        <Text style={styles.emptyTitle}>No Events Available</Text>
        <Text style={styles.emptySubtitle}>Check back soon for upcoming events</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Page title */}
      {/* <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>Events</Text>
      </View> */}
      
      <AnimatedFlatList
        ref={flatListRef}
        data={events}
        renderItem={renderEventItem}
        keyExtractor={(item, index) => `${item.name}-${index}`}
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        pagingEnabled
        scrollEnabled={isScrollEnabled} // Control scroll with our state
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
      />
      
      {/* Scroll indicator dots */}
      {events.length > 1 && (
        <View style={styles.paginationWrapper}>
          {events.map((_, index) => {
            const inputRange = [
              (index - 1) * SCREEN_HEIGHT,
              index * SCREEN_HEIGHT,
              (index + 1) * SCREEN_HEIGHT,
            ];
            
            const dotScale = scrollY.interpolate({
              inputRange,
              outputRange: [0.8, 1.4, 0.8],
              extrapolate: 'clamp',
            });
            
            const opacity = scrollY.interpolate({
              inputRange,
              outputRange: [0.4, 1, 0.4],
              extrapolate: 'clamp',
            });
            
            return (
              <Animated.View
                key={`dot-${index}`}
                style={[
                  styles.paginationDot,
                  {
                    transform: [{ scale: dotScale }],
                    opacity,
                  },
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
  },
  loaderText: {
    color: 'white',
    marginTop: 12,
    fontFamily,
    fontSize: 16,
  },
  eventSlide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: 'relative',
  },
  eventImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%', // Increased to cover more of the screen
  },
  eventContent: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 165 : 95, // Significantly increased for all devices
    left: 0,
    right: 0,
    padding: 20,
  },
  eventName: {
    fontFamily,
    fontWeight: '700',
    fontSize: 24, // Further reduced for better fit
    color: 'white',
    marginBottom: 10, // Further reduced spacing
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  detailsContainer: {
    marginBottom: 14, // Further reduced spacing
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6, // Further reduced spacing
  },
  detailText: {
    fontFamily,
    fontSize: 16,
    color: 'white',
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  viewButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1.5,
    borderColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  viewButtonText: {
    fontFamily,
    fontWeight: '600',
    color: 'white',
    fontSize: 14,
  },
  headerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    zIndex: 10,
    width: '100%',
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontFamily,
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontFamily,
    fontSize: 22,
    fontWeight: '600',
    color: 'white',
    marginTop: 16,
  },
  emptySubtitle: {
    fontFamily,
    fontSize: 16,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  paginationWrapper: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{ translateY: -50 }],
    alignItems: 'center',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginVertical: 3,
  },
});
