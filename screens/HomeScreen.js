import { useState, useEffect } from "react";

import {
  StyleSheet,
  Text,
  View,
  Share,
  Pressable,
  Dimensions,
  ScrollView,
  Platform,
  Alert,
  Image,
} from "react-native";

import {
  setUserName,
  selectLocalId,
  selectExpoPushToken,
  selectStripeCustomerId,
  selectUserName,
  setLocalId,
  setUserEmail,
  setStripeCustomerId,
  setExpoPushToken,
} from "../store/redux/userSlice";

import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { getDatabase, ref as databaseRef, get, set } from "firebase/database";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

import TickerAnnouncement from "../ui/TickerAnnouncement";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { loginUser } from "../util/auth";
import { registerForPushNotificationsAsync } from "../notifications/PushNotifications";

const API_URL =
  "https://us-central1-ragestate-app.cloudfunctions.net/stripePayment";

export default function HomeScreen() {
  const [announcements, setAnnouncements] = useState([]);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const userName = useSelector(selectUserName);

  const navigation = useNavigation();
  const dispatch = useDispatch();

  // Feature navigation options
  const featureOptions = [
    {
      name: "Events",
      icon: "calendar",
      description: "Upcoming events & tickets",
      navigateTo: "Events",
    },
    {
      name: "Shop",
      icon: "cart",
      description: "Merch & gear",
      navigateTo: "Shop",
    },
    // {
    //   name: "Community",
    //   icon: "people",
    //   description: "Connect with others",
    //   navigateTo: "Community",
    // },
    {
      name: "Account",
      icon: "person",
      description: "Your account details",
      navigateTo: "Account",
    },
  ];

  const navigateToScreen = (screenName) => {
    navigation.navigate(screenName);
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [stayLoggedInValue, savedEmail, savedPassword] =
          await Promise.all([
            AsyncStorage.getItem("stayLoggedIn"),
            AsyncStorage.getItem("email"),
            AsyncStorage.getItem("password"),
          ]);

        if (stayLoggedInValue) {
          setIsAuthenticating(true);

          // Call loginUser function
          const userData = await loginUser(savedEmail, savedPassword);
          const localId = userData.uid;
          const userEmail = userData.email;
          dispatch(setLocalId(localId));
          dispatch(setUserEmail(userEmail));

          // Register for push notifications after successful login
          const token = await registerForPushNotificationsAsync();

          const userRef = databaseRef(db, `users/${localId}`);

          get(userRef)
            .then((snapshot) => {
              if (snapshot.exists()) {
                // Extract the user's name and profile picture URL from the snapshot data
                const userData = snapshot.val();
                const name = userData.firstName + " " + userData.lastName;

                // Dispatch the setUserName action with the fetched user name
                dispatch(setUserName(name));
              } else {
                // console.log("No data available");
              }
            })
            .catch((error) => {
              console.error("Error fetching user data:", error);
            });

          const stripeCustomerResponse = await fetch(
            `${API_URL}/create-customer`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                email: savedEmail,
                name: userName,
                firebaseId: localId,
              }),
            }
          );

          if (!stripeCustomerResponse.ok) {
            // Log response status and error message if available
            console.error(
              "Failed to create Stripe customer. Status:",
              stripeCustomerResponse.status
            );
            const errorMessage = await stripeCustomerResponse.text();
            console.error("Error Message:", errorMessage);
            throw new Error("Failed to create Stripe customer");
          }

          const stripeCustomerData = await stripeCustomerResponse.json();

          dispatch(setStripeCustomerId(stripeCustomerData));

          dispatch(setExpoPushToken(token));

          // Reset form fields and loading state
          setEmail("");
          setPassword("");
          // setAuthenticated(true);
          setIsAuthenticating(false);
        }
      } catch (error) {
        console.error("Error during login:", error); // Log the error for debugging purposes

        let errorMessage = "An error occurred while logging in.";
        if (error.code === "auth/invalid-credential") {
          errorMessage =
            "Invalid email or password. Please check your credentials and try again.";
        }

        // Alert the user with the appropriate error message
        Alert.alert("Error", errorMessage);

        // Reset loading state
        setIsAuthenticating(false);
      }
    };

    loadData();
  }, []);

  const db = getDatabase();

  const userRef = databaseRef(db, `users/${userId}`);
  const userId = useSelector(selectLocalId);
  const username = useSelector(selectUserName);
  const stripeCustomerID = useSelector(selectStripeCustomerId);
  const expoPushToken = useSelector(selectExpoPushToken);

  get(userRef)
    .then((snapshot) => {
      if (snapshot.exists()) {
        // Extract the existing user data
        const userData = snapshot.val();

        // Extract the user's name and profile picture URL from the snapshot data
        const name = userData.firstName + " " + userData.lastName;

        // Dispatch the setUserName action with the fetched user name
        dispatch(setUserName(name));

        // Merge the existing user data with the new stripeCustomerId
        const updatedUserData = {
          ...userData,
          stripeCustomerId: stripeCustomerID.customerId,
          expoPushToken: expoPushToken,
        };

        // Update the user record in Firebase with the merged data
        set(userRef, updatedUserData, (error) => {
          if (error) {
            console.error(
              "Error updating user record with Stripe customer ID:",
              error
            );
          } else {
            // User record updated with Stripe customer ID
          }
        });
      } else {
        // console.log("No data available");
      }
    })
    .catch((error) => {
      console.error("Error fetching user data:", error);
    });

  const shareContent = async () => {
    try {
      const result = await Share.share({
        message: "You should be raging with us.",
        url: "https://ragestate.com/events",
        title: "RAGESTATE Events",
      });
      if (result.action === Share.sharedAction) {
      } else if (result.action === Share.dismissedAction) {
      }
    } catch (error) {
      console.error("Error sharing content:", error.message);
    }
  };

  return (
    <View style={{ backgroundColor: "#000", paddingBottom: 25, flex: 1 }}>
      <View>
        <TickerAnnouncement announcements={announcements} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollViewContainer}>
        <View style={styles.container}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/RSLogo2025.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Welcome header */}
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeHeading}>
              LIVE IN YOUR WORLD, RAGE IN OURS
            </Text>
            <Text style={styles.welcomeSubheading}>
              Find your next adventure
            </Text>
          </View>

          {/* Feature navigation grid */}
          <View style={styles.featureGrid}>
            {featureOptions.map((feature, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.featureCard,
                  pressed && styles.pressed,
                ]}
                onPress={() => navigateToScreen(feature.navigateTo)}
              >
                <View style={styles.featureIconContainer}>
                  <Ionicons name={feature.icon} size={32} color="#fff" />
                </View>
                <Text style={styles.featureTitle}>{feature.name}</Text>
                <Text style={styles.featureDescription}>
                  {feature.description}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Upcoming feature preview or highlight */}
          <View style={styles.highlightSection}>
            <Text style={styles.highlightTitle}>Feed Coming Soon</Text>
            <Text style={styles.highlightDescription}>
              Stay tuned for exclusive content and special features
            </Text>
          </View>

          <Pressable onPress={shareContent} style={styles.shareButton}>
            <View style={styles.buttonContent}>
              <Text style={styles.shareButtonText}>Share RAGESTATE</Text>
              <MaterialCommunityIcons name="send" color={"white"} size={20} />
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const windowHeight = Dimensions.get("window").height;
const windowWidth = Dimensions.get("window").width;

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const styles = StyleSheet.create({
  scrollViewContainer: {
    flexGrow: 1,
    paddingVertical: 16,
  },
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingHorizontal: 16,
  },
  welcomeSection: {
    marginBottom: 24,
    alignItems: "center",
  },
  welcomeHeading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6,
    fontFamily,
  },
  welcomeSubheading: {
    fontSize: 16,
    color: "#aaa",
    fontFamily,
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  featureCard: {
    width: windowWidth > 500 ? "48%" : "48%",
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 140,
  },
  featureIconContainer: {
    marginBottom: 12,
    backgroundColor: "#222",
    borderRadius: 50,
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 6,
    fontFamily,
  },
  featureDescription: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
    fontFamily,
  },
  highlightSection: {
    backgroundColor: "#0a0a0a",
    borderRadius: 12,
    padding: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#444",
    marginBottom: 24,
  },
  highlightTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 6,
    fontFamily,
  },
  highlightDescription: {
    fontSize: 14,
    color: "#aaa",
    fontFamily,
  },
  shareButton: {
    backgroundColor: "#222",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignSelf: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444",
  },
  shareButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily,
    marginRight: 8,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  pressed: {
    opacity: 0.7,
    backgroundColor: "#1a1a1a",
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  logo: {
    width: 150,
    height: 100,
  },
});
