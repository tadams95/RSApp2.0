import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

// Only set notification handler if not in Expo Go
if (!isExpoGo) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export function usePushNotifications() {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    if (isExpoGo) return; // Skip notification setup in Expo Go

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        // Handle received notification here
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        // Handle notification response here
      });

    return () => {
      if (!isExpoGo) {
        Notifications.removeNotificationSubscription(notificationListener.current);
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  const registerForPushNotifications = async () => {
    if (isExpoGo) {
      console.log('Push notifications are not supported in Expo Go');
      return null;
    }

    try {
      const token = await registerForPushNotificationsAsync();
      return token;
    } catch (error) {
      console.log('Failed to get push token:', error);
      return null;
    }
  };

  return { registerForPushNotifications };
}

export async function schedulePushNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "RAGESTATE",
      body: "This is a test notification",
      data: { data: "goes here" },
      ios: {
        sound: true,
      },
    },
    trigger: { seconds: 2 },
  });
}

export async function registerForPushNotificationsAsync() {
  if (isExpoGo) return null;

  let token = null;

  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus === "granted") {
        token = await Notifications.getExpoPushTokenAsync({
          projectId: "0b623ccd-8529-45cb-bc54-dd7265c22a26",
        });
        return token.data;
      }
    }
  } catch (error) {
    console.log('Error getting push token:', error);
  }

  return null;
}

export async function sendPushNotification(expoPushToken) {
  const message = {
    to: expoPushToken,
    sound: "default",
    title: "Original Title",
    body: "And here is the body!",
    data: { someData: "goes here" },
  };

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });
}
