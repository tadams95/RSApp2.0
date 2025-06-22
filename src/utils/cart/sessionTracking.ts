/**
 * Session Tracking Utilities
 *
 * This file provides utilities for tracking concurrent sessions and operations
 * to help detect potential transaction conflicts.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import { Platform } from "react-native";

// Storage keys for session tracking
const CURRENT_SESSION_KEY = "rs_current_session";
const ACTIVE_OPERATIONS_KEY = "rs_active_operations";
const DEVICE_ID_KEY = "rs_device_id";

/**
 * Interface for active operation tracking
 */
interface ActiveOperation {
  id: string;
  type: string;
  resourceId?: string;
  startTime: number;
  deviceId: string;
  completed?: boolean;
}

/**
 * Interface for session data
 */
interface SessionData {
  sessionId: string;
  startTime: number;
  lastActive: number;
  deviceId: string;
  deviceInfo: {
    brand?: string;
    model?: string;
    platform?: string;
  };
}

/**
 * Generates a unique device identifier or retrieves the existing one
 */
export async function getDeviceId(): Promise<string> {
  try {
    // Try to get stored device ID
    const storedId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (storedId) {
      return storedId;
    }

    // Generate a new device ID if none exists
    const newDeviceId = `${Device.brand || "unknown"}-${
      Platform.OS
    }-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    await AsyncStorage.setItem(DEVICE_ID_KEY, newDeviceId);
    return newDeviceId;
  } catch (error) {
    console.error("Error getting device ID:", error);
    return `unknown-${Date.now()}`;
  }
}

/**
 * Creates or updates the current session
 */
export async function trackSession(): Promise<SessionData> {
  try {
    // Get device ID
    const deviceId = await getDeviceId();

    // Get current session if exists
    const sessionData = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
    const currentTime = Date.now();

    if (sessionData) {
      // Update existing session
      const parsedSession = JSON.parse(sessionData) as SessionData;

      // If last active more than 30 minutes ago, create new session
      if (currentTime - parsedSession.lastActive > 30 * 60 * 1000) {
        return createNewSession(deviceId);
      }

      // Otherwise update last active time
      const updatedSession = {
        ...parsedSession,
        lastActive: currentTime,
      };

      await AsyncStorage.setItem(
        CURRENT_SESSION_KEY,
        JSON.stringify(updatedSession)
      );
      return updatedSession;
    } else {
      // Create new session
      return createNewSession(deviceId);
    }
  } catch (error) {
    console.error("Error tracking session:", error);
    // Return a fallback session if there's an error
    return {
      sessionId: `error-${Date.now()}`,
      startTime: Date.now(),
      lastActive: Date.now(),
      deviceId: "unknown",
      deviceInfo: {
        platform: Platform.OS,
      },
    };
  }
}

/**
 * Creates a new session
 */
async function createNewSession(deviceId: string): Promise<SessionData> {
  const currentTime = Date.now();
  const sessionId = `${currentTime}-${Math.random()
    .toString(36)
    .substring(2, 9)}`;

  const sessionData: SessionData = {
    sessionId,
    startTime: currentTime,
    lastActive: currentTime,
    deviceId,
    deviceInfo: {
      brand: Device.brand || undefined,
      model: Device.modelName || undefined,
      platform: Platform.OS,
    },
  };

  await AsyncStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(sessionData));
  return sessionData;
}

/**
 * Registers an active operation that might lead to transaction conflicts
 *
 * @param type The type of operation (e.g., 'checkout', 'order-update')
 * @param resourceId Optional identifier for the resource being modified
 * @returns The operation ID for later reference
 */
export async function registerOperation(
  type: string,
  resourceId?: string
): Promise<string> {
  try {
    const deviceId = await getDeviceId();
    const operationId = `${type}-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    // Create new operation entry
    const operation: ActiveOperation = {
      id: operationId,
      type,
      resourceId,
      startTime: Date.now(),
      deviceId,
      completed: false,
    };

    // Get current operations
    const existingData = await AsyncStorage.getItem(ACTIVE_OPERATIONS_KEY);
    let operations: ActiveOperation[] = existingData
      ? JSON.parse(existingData)
      : [];

    // Clean up old operations (older than 1 hour)
    operations = operations.filter(
      (op) => Date.now() - op.startTime < 60 * 60 * 1000
    );

    // Add new operation
    operations.push(operation);

    // Save updated list
    await AsyncStorage.setItem(
      ACTIVE_OPERATIONS_KEY,
      JSON.stringify(operations)
    );

    return operationId;
  } catch (error) {
    console.error("Error registering operation:", error);
    return `error-${Date.now()}`;
  }
}

/**
 * Marks an operation as completed
 *
 * @param operationId The ID of the operation to complete
 */
export async function completeOperation(operationId: string): Promise<void> {
  try {
    const existingData = await AsyncStorage.getItem(ACTIVE_OPERATIONS_KEY);
    if (!existingData) return;

    let operations: ActiveOperation[] = JSON.parse(existingData);

    // Find and mark operation as completed
    const updatedOperations = operations.map((op) => {
      if (op.id === operationId) {
        return { ...op, completed: true };
      }
      return op;
    });

    await AsyncStorage.setItem(
      ACTIVE_OPERATIONS_KEY,
      JSON.stringify(updatedOperations)
    );
  } catch (error) {
    console.error("Error completing operation:", error);
  }
}

/**
 * Checks if there are other active operations on the same resource
 * This can help detect potential conflicts
 *
 * @param type The type of operation to check for
 * @param resourceId The resource being modified
 * @returns Information about other active operations
 */
export async function checkForConcurrentOperations(
  type: string,
  resourceId?: string
): Promise<{
  hasConcurrentOperations: boolean;
  operationsCount: number;
  isSameDevice: boolean;
}> {
  try {
    const deviceId = await getDeviceId();
    const existingData = await AsyncStorage.getItem(ACTIVE_OPERATIONS_KEY);

    if (!existingData) {
      return {
        hasConcurrentOperations: false,
        operationsCount: 0,
        isSameDevice: false,
      };
    }

    const operations: ActiveOperation[] = JSON.parse(existingData);

    // Filter for incomplete operations of the same type on the same resource
    const relevantOperations = operations.filter(
      (op) =>
        !op.completed &&
        op.type === type &&
        (!resourceId || op.resourceId === resourceId)
    );

    // Check if any are from a different device
    const otherDeviceOperations = relevantOperations.filter(
      (op) => op.deviceId !== deviceId
    );

    return {
      hasConcurrentOperations: relevantOperations.length > 0,
      operationsCount: relevantOperations.length,
      isSameDevice: otherDeviceOperations.length === 0,
    };
  } catch (error) {
    console.error("Error checking for concurrent operations:", error);
    return {
      hasConcurrentOperations: false,
      operationsCount: 0,
      isSameDevice: true,
    };
  }
}

/**
 * Cleans up expired or completed operations
 */
export async function cleanupOperations(): Promise<void> {
  try {
    const existingData = await AsyncStorage.getItem(ACTIVE_OPERATIONS_KEY);
    if (!existingData) return;

    const operations: ActiveOperation[] = JSON.parse(existingData);

    // Keep only recent incomplete operations (less than 1 hour old)
    const currentTime = Date.now();
    const validOperations = operations.filter(
      (op) => !op.completed && currentTime - op.startTime < 60 * 60 * 1000
    );

    if (validOperations.length !== operations.length) {
      await AsyncStorage.setItem(
        ACTIVE_OPERATIONS_KEY,
        JSON.stringify(validOperations)
      );
    }
  } catch (error) {
    console.error("Error cleaning up operations:", error);
  }
}
