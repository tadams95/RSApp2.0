/**
 * Validation utilities for EditProfile component
 * Contains functions to validate name, email, and phone number inputs
 */

/**
 * Validates a first or last name
 * Rules: Must not be empty, contain only letters, spaces and hyphens, be at least 2 chars long
 */
export function validateName(name: string): {
  isValid: boolean;
  errorMessage: string;
} {
  if (!name.trim()) {
    return { isValid: false, errorMessage: "Name field cannot be empty" };
  }

  // Check for minimum length
  if (name.trim().length < 2) {
    return {
      isValid: false,
      errorMessage: "Name must be at least 2 characters",
    };
  }

  // Check for valid characters (letters, spaces, hyphens, apostrophes)
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
 * Uses a standard regex pattern for email validation
 */
export function validateEmail(email: string): {
  isValid: boolean;
  errorMessage: string;
} {
  if (!email.trim()) {
    return { isValid: true, errorMessage: "" }; // Email field can be empty in profile edit
  }

  const emailPattern = /^[\w+.-]+@[\w.-]+\.[a-zA-Z]{2,}$/;
  if (!emailPattern.test(email)) {
    return {
      isValid: false,
      errorMessage: "Please enter a valid email address",
    };
  }

  return { isValid: true, errorMessage: "" };
}

/**
 * Validates a phone number
 * Rules: Must be in valid format with 10 digits (optionally with country code)
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

  // Remove all non-numeric characters for validation
  const digitsOnly = phoneNumber.replace(/\D/g, "");

  // Basic check: Number should have 10 digits (US/Canada)
  // or 11-12 digits with country code (e.g., +1 for US/Canada)
  if (digitsOnly.length < 10) {
    return {
      isValid: false,
      errorMessage: "Phone number should have at least 10 digits",
    };
  }

  if (digitsOnly.length > 15) {
    return {
      isValid: false,
      errorMessage: "Phone number contains too many digits",
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
