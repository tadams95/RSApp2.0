/**
 * Validation utilities for EditProfile component
 * Contains functions to validate name, email, and phone number inputs
 * Updated to match server-side validation rules
 */

/**
 * Validates a first or last name
 * Rules: Must be a valid string matching the server-side rules
 * Note: Server requires it to be a string, client adds additional validation
 */
export function validateName(name: string): {
  isValid: boolean;
  errorMessage: string;
} {
  // Check if empty (the server only requires it to be a string, but we add this validation for UX)
  if (!name.trim()) {
    return { isValid: false, errorMessage: "Name field cannot be empty" };
  }

  // Check for minimum length (client-side validation)
  if (name.trim().length < 2) {
    return {
      isValid: false,
      errorMessage: "Name must be at least 2 characters",
    };
  }

  // Check for maximum length to prevent excessive data in database (client-side validation)
  if (name.trim().length > 50) {
    return {
      isValid: false,
      errorMessage: "Name must be less than 50 characters",
    };
  }

  // Check for valid characters (letters, spaces, hyphens, apostrophes)
  // This is a client-side validation to ensure names follow expected format
  const namePattern = /^[A-Za-zÀ-ÖØ-öø-ÿ\s\-']+$/;
  if (!namePattern.test(name)) {
    return {
      isValid: false,
      errorMessage:
        "Name should contain only letters, spaces, hyphens or apostrophes",
    };
  }

  return { isValid: true, errorMessage: "" };
}

/**
 * Validates an email address
 * Uses regex pattern that exactly matches the server-side rules validation
 */
export function validateEmail(email: string): {
  isValid: boolean;
  errorMessage: string;
} {
  if (!email.trim()) {
    return { isValid: true, errorMessage: "" }; // Email field can be empty in profile edit
  }

  // Use the exact same regex pattern as the server-side validation rules
  // Copied directly from realtime.rules: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$/i
  // But with appropriate JavaScript escaping (single backslash instead of double)
  const emailPattern = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  if (!emailPattern.test(email)) {
    return {
      isValid: false,
      errorMessage:
        "Please enter a valid email address (e.g., name@example.com)",
    };
  }

  return { isValid: true, errorMessage: "" };
}

/**
 * Validates a phone number
 * Server requires it to be a string, client adds additional format validation
 * Accepts formats: (123) 456-7890, 123-456-7890, 123.456.7890, 1234567890, +1 123 456 7890
 */
export function validatePhoneNumber(phoneNumber: string): {
  isValid: boolean;
  errorMessage: string;
  formattedNumber?: string;
} {
  if (!phoneNumber.trim()) {
    return { isValid: true, errorMessage: "" }; // Phone number field can be empty in profile edit
  }

  // Note: Server rules only validate that phoneNumber is a string, but we add additional
  // validation on the client side to ensure proper formatting and provide better user experience

  // Remove all non-numeric characters for validation
  const digitsOnly = phoneNumber.replace(/\D/g, "");

  // Basic check: Number should have 10 digits (US/Canada)
  // or 11-15 digits with country code (e.g., +1 for US/Canada)
  if (digitsOnly.length < 10) {
    return {
      isValid: false,
      errorMessage: "Phone number should have at least 10 digits",
    };
  }

  if (digitsOnly.length > 15) {
    return {
      isValid: false,
      errorMessage: "Phone number contains too many digits (maximum 15)",
    };
  }

  // Format the number for display as (XXX) XXX-XXXX if it's 10 digits
  // or preserve country code for international numbers
  let formattedNumber = phoneNumber;
  if (digitsOnly.length === 10) {
    formattedNumber = `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(
      3,
      6
    )}-${digitsOnly.slice(6)}`;
  }

  return { isValid: true, errorMessage: "", formattedNumber };
}

/**
 * Formats a phone number as user types
 * Applies formatting: (XXX) XXX-XXXX for US/Canada numbers
 */
export function formatPhoneNumberInput(input: string): string {
  // Remove all non-numeric characters
  const digitsOnly = input.replace(/\D/g, "");

  // Format the number based on length
  if (digitsOnly.length === 0) {
    return "";
  } else if (digitsOnly.length <= 3) {
    return `(${digitsOnly}`;
  } else if (digitsOnly.length <= 6) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3)}`;
  } else {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(
      3,
      6
    )}-${digitsOnly.slice(6, 10)}`;
  }
}
