import { useState, useEffect } from "react";

import {
  StyleSheet,
  Text,
  View,
  Share,
  Pressable,
  Dimensions,
  Image,
  ScrollView,
  Platform,
  Alert,
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
import { MaterialCommunityIcons } from "@expo/vector-icons";

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

  const navigateToEventsScreen = () => {
    navigation.navigate("Events"); // Navigate to the 'Events' screen
  };

  const navigateToShopScreen = () => {
    navigation.navigate("Shop"); // Navigate to the 'Shop' screen
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
  // const firstName = username.split(" ")[0];
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
        url: "https://www.ragestate.com",
        title: "RAGESTATE App",
      });
      if (result.action === Share.sharedAction) {
      } else if (result.action === Share.dismissedAction) {
      }
    } catch (error) {
      console.error("Error sharing content:", error.message);
    }
  };

  return (
    <View style={{ backgroundColor: "#000", paddingBottom: 25 }}>
      <View>
        <TickerAnnouncement announcements={announcements} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollViewContainer}>
        <View style={styles.container}>
          <Pressable
            onPress={navigateToEventsScreen}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Image
              source={require("../assets/BlurHero_1.3.png")}
              style={styles.heroImage}
            />
          </Pressable>
          <Pressable
            onPress={navigateToShopScreen}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Image
              source={require("../assets/ShopHero_1.png")}
              style={styles.heroImage}
            />
          </Pressable>

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
  },
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  content: {
    justifyContent: "center",
    alignItems: "center",
    marginBottom: windowHeight * 0.05, // Adjust marginBottom dynamically
  },
  text: {
    fontSize: windowHeight * 0.04, // Adjust fontSize dynamically
    fontWeight: "bold",
    marginBottom: windowHeight * 0.02, // Adjust marginBottom dynamically
    color: "#333",
    fontFamily,
  },
  subtitle: {
    fontSize: windowHeight * 0.01, // Adjust fontSize dynamically
    color: "#666",
    fontFamily,
  },
  shareButton: {
    backgroundColor: "black",
    borderRadius: 8,
    paddingVertical: windowHeight * 0.02, // Adjust padding vertically dynamically
    paddingHorizontal: windowHeight * 0.04, // Adjust padding horizontally dynamically
    elevation: 3,
    margin: windowHeight * 0.02, // Adjust margin dynamically
    alignSelf: "center",
    alignItems: "center",
  },
  shareButtonText: {
    color: "#fff",
    fontSize: windowHeight * 0.0175, // Adjust fontSize dynamically
    fontWeight: "700",
    fontFamily,
    marginRight: windowHeight * 0.01, // Adjust marginRight dynamically
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroImage: {
    height: windowWidth > 600 ? windowHeight * 0.6 : windowHeight * 0.39, // Adjust height dynamically based on screen size
    width: "100%",
    resizeMode: "cover",
  },
  pressed: {
    opacity: 0.5,
  },
  pressable: {
    width: "90%", // Adjust width to be responsive
    marginVertical: 10, // Add some margin for spacing
  },
});
