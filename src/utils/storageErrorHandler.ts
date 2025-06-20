import {
  deleteField,
  doc,
  getDoc,
  getFirestore,
  updateDoc,
} from "firebase/firestore";
import {
  getDownloadURL,
  getStorage,
  ref,
  StorageError,
} from "firebase/storage";
import { logError } from "./logError";

// Error codes from Firebase Storage
export type FirebaseStorageErrorCode =
  | "storage/unknown"
  | "storage/object-not-found"
  | "storage/bucket-not-found"
  | "storage/project-not-found"
  | "storage/quota-exceeded"
  | "storage/unauthenticated"
  | "storage/unauthorized"
  | "storage/retry-limit-exceeded"
  | "storage/invalid-checksum"
  | "storage/canceled"
  | "storage/invalid-event-name"
  | "storage/invalid-url"
  | "storage/invalid-argument"
  | "storage/no-default-bucket"
  | "storage/cannot-slice-blob"
  | "storage/server-file-wrong-size"
  | string; // For any other codes not explicitly listed

/**
 * Extracts Firebase Storage error code from various error formats
 * @param error Any error object that might contain a Firebase Storage error code
 * @returns The Firebase Storage error code or "storage/unknown" if not found
 */
export function extractStorageErrorCode(
  error: StorageError | any
): FirebaseStorageErrorCode {
  if (!error) return "storage/unknown";

  // Direct code property (most common)
  if (error.code && typeof error.code === "string") {
    return error.code as FirebaseStorageErrorCode;
  }

  // Check for code in message
  if (error.message && typeof error.message === "string") {
    const codeMatch = error.message.match(/storage\/[\w-]+/);
    if (codeMatch) {
      return codeMatch[0] as FirebaseStorageErrorCode;
    }

    // Try to classify based on common error message patterns
    const message = error.message.toLowerCase();
    if (message.includes("not found") || message.includes("404")) {
      return "storage/object-not-found";
    }
    if (message.includes("quota") || message.includes("storage limit")) {
      return "storage/quota-exceeded";
    }
    if (
      message.includes("permission") ||
      message.includes("not authorized") ||
      message.includes("access denied")
    ) {
      return "storage/unauthorized";
    }
    if (
      message.includes("network") ||
      message.includes("internet") ||
      message.includes("connection")
    ) {
      return "storage/retry-limit-exceeded";
    }
  }

  return "storage/unknown";
}

/**
 * Provides user-friendly error messages for common Firebase Storage errors
 * @param error Any error related to Firebase Storage operations
 * @returns A user-friendly error message
 */
export function getStorageErrorMessage(error: StorageError | any): string {
  // Log the error for debugging
  logError(error, "FirebaseStorage", {
    errorCode: extractStorageErrorCode(error),
  });

  if (!error) return "Unknown error occurred";

  const errorCode = extractStorageErrorCode(error);
  const errorMessage = error.message?.toLowerCase() || "";

  // Return user-friendly error messages based on Firebase Storage error codes
  switch (errorCode) {
    case "storage/object-not-found":
      return "The image could not be found. It may have been deleted or moved.";

    case "storage/bucket-not-found":
    case "storage/project-not-found":
      return "Storage configuration error. Please contact support.";

    case "storage/quota-exceeded":
      return "Storage quota exceeded. Please try a smaller image or contact support.";

    case "storage/unauthenticated":
      return "You need to be logged in to access this image.";

    case "storage/unauthorized":
      return "You don't have permission to access this image.";

    case "storage/retry-limit-exceeded":
      return "Network issues prevented loading the image. Please try again.";

    case "storage/invalid-checksum":
      return "The image appears to be corrupted. Please try again.";

    case "storage/canceled":
      return "Image loading was cancelled.";

    case "storage/invalid-url":
      return "The image URL is invalid.";

    default:
      // For any other errors, include some message details if available
      if (
        errorMessage.includes("network") ||
        errorMessage.includes("internet") ||
        errorMessage.includes("connection")
      ) {
        return "Network connection issue. Please check your internet connection.";
      }
      return "Error loading image. Please try again.";
  }
}

/**
 * Determines if an error is eligible for automatic retry
 * @param error The error from a Firebase Storage operation
 * @returns Boolean indicating if retry is appropriate
 */
export function shouldRetryStorageOperation(
  error: StorageError | any
): boolean {
  const errorCode = extractStorageErrorCode(error);

  // These errors are likely transient and may resolve with a retry
  const retryableErrors = [
    "storage/retry-limit-exceeded",
    "storage/server-file-wrong-size",
    "storage/canceled",
  ];

  // Network-related errors are usually worth retrying
  if (
    error.message?.toLowerCase().includes("network") ||
    error.message?.toLowerCase().includes("connection")
  ) {
    return true;
  }

  return retryableErrors.includes(errorCode);
}

/**
 * Checks if a Firebase Storage URL is still valid
 * @param url The Firebase Storage download URL to check
 * @returns Promise<boolean> True if the object exists, false if deleted/not found
 */
export async function isStorageObjectValid(url: string): Promise<boolean> {
  try {
    if (!url || !url.includes("firebasestorage.googleapis.com")) {
      return false;
    }

    // Extract the storage path from the URL
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/o\/(.+?)\?/);
    if (!pathMatch) return false;

    const decodedPath = decodeURIComponent(pathMatch[1]);
    const storage = getStorage();
    const storageRef = ref(storage, decodedPath);

    // Try to get a fresh download URL - this will fail if object doesn't exist
    await getDownloadURL(storageRef);
    return true;
  } catch (error: any) {
    const errorCode = extractStorageErrorCode(error);
    if (errorCode === "storage/object-not-found") {
      return false;
    }
    // For other errors (network, permissions), assume object exists but is temporarily inaccessible
    return true;
  }
}

/**
 * Cleans up a Firestore document field that references a deleted storage object
 * @param collectionPath The Firestore collection path (e.g., "customers")
 * @param documentId The document ID
 * @param fieldName The field name containing the storage URL
 * @param fallbackValue Optional fallback value to set instead of deleting the field
 */
export async function cleanupOrphanedStorageReference(
  collectionPath: string,
  documentId: string,
  fieldName: string,
  fallbackValue?: string
): Promise<void> {
  try {
    const firestore = getFirestore();
    const docRef = doc(firestore, collectionPath, documentId);

    const updateData: Record<string, any> = {};

    if (fallbackValue !== undefined) {
      updateData[fieldName] = fallbackValue;
    } else {
      updateData[fieldName] = deleteField();
    }

    await updateDoc(docRef, updateData);

    logError(
      new Error("Cleaned up orphaned storage reference"),
      "StorageCleanup",
      {
        collectionPath,
        documentId,
        fieldName,
        action: fallbackValue ? "set_fallback" : "delete_field",
      }
    );
  } catch (error: any) {
    logError(error, "StorageCleanupError", {
      collectionPath,
      documentId,
      fieldName,
    });
    throw error;
  }
}

/**
 * Validates and cleans up storage references in a Firestore document
 * @param collectionPath The Firestore collection path
 * @param documentId The document ID
 * @param storageFields Map of field names to fallback values for storage URL fields
 * @returns Promise<boolean> True if any cleanup was performed
 */
export async function validateAndCleanupStorageReferences(
  collectionPath: string,
  documentId: string,
  storageFields: Record<string, string | null>
): Promise<boolean> {
  let cleanupPerformed = false;

  for (const [fieldName, fallbackValue] of Object.entries(storageFields)) {
    try {
      // Get the current field value to check
      const firestore = getFirestore();
      const docRef = doc(firestore, collectionPath, documentId);
      const docSnapshot = await getDoc(docRef);

      if (!docSnapshot.exists()) continue;

      const fieldValue = docSnapshot.data()?.[fieldName];
      if (!fieldValue || typeof fieldValue !== "string") continue;

      // Check if the storage object is valid
      const isValid = await isStorageObjectValid(fieldValue);

      if (!isValid) {
        await cleanupOrphanedStorageReference(
          collectionPath,
          documentId,
          fieldName,
          fallbackValue || undefined
        );
        cleanupPerformed = true;
      }
    } catch (error: any) {
      logError(error, "StorageValidationError", {
        collectionPath,
        documentId,
        fieldName,
      });
    }
  }

  return cleanupPerformed;
}
