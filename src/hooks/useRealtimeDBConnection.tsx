import { getDatabase, onValue, ref } from "firebase/database";
import { useCallback, useEffect, useState } from "react";

/**
 * Custom hook to monitor Firebase Realtime Database connection state
 *
 * @returns {Object} Connection state and reconnect function
 * - isConnected: boolean indicating if connected to Firebase Realtime Database
 * - isConnecting: boolean indicating if currently attempting to connect
 * - reconnect: function to manually attempt reconnection
 */
export function useRealtimeDBConnection() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(true);

  // Function to get a database reference
  const getDatabaseRef = useCallback(() => {
    const db = getDatabase();
    return ref(db, ".info/connected");
  }, []);

  // Function to handle reconnection
  const reconnect = useCallback(() => {
    setIsConnecting(true);

    // The Firebase client will automatically attempt to reconnect
    // This is just to update our local state to show reconnecting status

    // After a short delay, we check the connection state again
    setTimeout(() => {
      const connectedRef = getDatabaseRef();

      // One-time check of connection state
      onValue(
        connectedRef,
        (snapshot) => {
          const isConnected = snapshot.val() === true;
          setIsConnected(isConnected);
          setIsConnecting(false);
        },
        { onlyOnce: true }
      );
    }, 1000);
  }, [getDatabaseRef]);

  useEffect(() => {
    // Initialize database and connection monitoring
    try {
      const connectedRef = getDatabaseRef();

      // Set up listener for connection state changes
      const unsubscribe = onValue(connectedRef, (snapshot) => {
        const newConnectedState = snapshot.val() === true;
        setIsConnected(newConnectedState);
        setIsConnecting(false);
      });

      // Clean up listener on unmount
      return () => {
        unsubscribe();
      };
    } catch (error) {
      console.error(
        "Error setting up Realtime Database connection monitor:",
        error
      );
      setIsConnecting(false);
      setIsConnected(false);
    }
  }, [getDatabaseRef]);

  return {
    isConnected,
    isConnecting,
    reconnect,
  };
}
