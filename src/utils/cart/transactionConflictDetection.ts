/**
 * Transaction Conflict Detection Utilities
 *
 * This file provides utilities for detecting and handling concurrent modifications
 * in Firestore transactions.
 */

import { DocumentSnapshot } from "firebase/firestore";

/**
 * Determines if two document snapshots represent different versions of the same document
 * This can be used to detect if a document has been modified concurrently
 *
 * @param clientSnapshot The document snapshot cached on the client side
 * @param serverSnapshot The latest document snapshot from the server
 * @returns Whether the document has been modified by another process
 */
export function detectConcurrentModification(
  clientSnapshot: DocumentSnapshot,
  serverSnapshot: DocumentSnapshot
): boolean {
  // If the document doesn't exist in either snapshot, consider it unchanged
  if (!clientSnapshot.exists() && !serverSnapshot.exists()) {
    return false;
  }

  // If the document exists in one snapshot but not the other, it's changed
  if (clientSnapshot.exists() !== serverSnapshot.exists()) {
    return true;
  }

  // Compare update timestamps if available
  const clientData = clientSnapshot.data();
  const serverData = serverSnapshot.data();

  if (!clientData || !serverData) {
    return false;
  }

  // Check for timestamp field that might indicate last update time
  if (clientData.updatedAt && serverData.updatedAt) {
    return clientData.updatedAt.seconds !== serverData.updatedAt.seconds;
  }

  // For documents without timestamps, compare a few key fields
  // This is an approximation and should be customized based on your data model
  const keysToCompare = Object.keys(clientData).filter(
    (key) =>
      typeof clientData[key] !== "function" && key !== "id" && key !== "ref"
  );

  for (const key of keysToCompare) {
    // Deep comparison would be better but this simple check works for many cases
    if (JSON.stringify(clientData[key]) !== JSON.stringify(serverData[key])) {
      return true;
    }
  }

  return false;
}

/**
 * Compares a specific field between client and server document snapshots
 * Useful when only specific fields are important for conflict detection
 *
 * @param clientSnapshot The document snapshot from client side
 * @param serverSnapshot The document snapshot from server
 * @param fieldPath The field to compare (dot notation supported for nested fields)
 * @returns Whether the specified field has been modified
 */
export function hasFieldChanged(
  clientSnapshot: DocumentSnapshot,
  serverSnapshot: DocumentSnapshot,
  fieldPath: string
): boolean {
  if (!clientSnapshot.exists() || !serverSnapshot.exists()) {
    return clientSnapshot.exists() !== serverSnapshot.exists();
  }

  const clientValue = getNestedFieldValue(
    clientSnapshot.data() || {},
    fieldPath
  );
  const serverValue = getNestedFieldValue(
    serverSnapshot.data() || {},
    fieldPath
  );

  return JSON.stringify(clientValue) !== JSON.stringify(serverValue);
}

/**
 * Helper to get a nested field value using dot notation
 */
function getNestedFieldValue(obj: any, path: string): any {
  return path.split(".").reduce((prev, curr) => {
    return prev ? prev[curr] : undefined;
  }, obj);
}

/**
 * Creates a transaction conflict information object with appropriate user guidance
 *
 * @param fieldName User-friendly name of the field that was modified
 * @param operationType Type of operation being performed (e.g., 'checkout', 'update', etc.)
 * @returns Transaction conflict information with user guidance
 */
export function createFieldConflictInfo(
  fieldName: string,
  operationType: string = "transaction"
): {
  code: string;
  message: string;
  detail: string;
  resolution: string;
  conflictType: "concurrent-modification" | "data-changed";
} {
  return {
    code: "field-changed",
    message: `The ${fieldName} was changed while processing your ${operationType}.`,
    detail: `Another user or process may have updated the ${fieldName} while you were working.`,
    resolution: `Please refresh to see the latest data and try your ${operationType} again.`,
    conflictType: "data-changed",
  };
}
