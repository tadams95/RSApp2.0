import { useCallback, useEffect, useState } from "react";
import {
  formatPhoneNumberInput,
  validateEmail,
  validateName,
  validatePhoneNumber,
} from "../components/modals/EditProfileValidation";

/**
 * Interface for form errors
 */
interface ProfileFormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  [key: string]: string | undefined;
}

/**
 * Interface for form values
 */
interface ProfileFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  [key: string]: string;
}

/**
 * Custom hook for handling profile form validation
 * Can be reused across different profile-related forms
 */
export function useProfileFormValidation(
  initialValues: Partial<ProfileFormValues> = {}
) {
  // Set default initial values
  const defaultValues: ProfileFormValues = {
    firstName: initialValues.firstName || "",
    lastName: initialValues.lastName || "",
    email: initialValues.email || "",
    phoneNumber: initialValues.phoneNumber || "",
  };

  // State for form values and errors
  const [values, setValues] = useState<ProfileFormValues>(defaultValues);
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isValid, setIsValid] = useState<boolean>(false);

  /**
   * Validates a specific field
   */
  const validateField = useCallback(
    (field: keyof ProfileFormValues, value: string) => {
      let error = "";

      switch (field) {
        case "firstName":
        case "lastName":
          const nameValidation = validateName(value);
          if (!nameValidation.isValid && value.trim() !== "") {
            error = nameValidation.errorMessage;
          }
          break;

        case "email":
          const emailValidation = validateEmail(value);
          if (!emailValidation.isValid) {
            error = emailValidation.errorMessage;
          }
          break;

        case "phoneNumber":
          const phoneValidation = validatePhoneNumber(value);
          if (!phoneValidation.isValid) {
            error = phoneValidation.errorMessage;
          }
          break;
      }

      // Update errors state
      setErrors((prev) => ({ ...prev, [field]: error }));
      return error === "";
    },
    []
  );

  /**
   * Handles input change with validation
   */
  const handleChange = useCallback(
    (field: keyof ProfileFormValues, value: string) => {
      // Format phone number if needed
      let processedValue = value;
      if (field === "phoneNumber") {
        processedValue = formatPhoneNumberInput(value);
      }

      // Update values state
      setValues((prev) => ({ ...prev, [field]: processedValue }));

      // Mark form as dirty once user starts entering data
      if (!isDirty && value.trim() !== "") {
        setIsDirty(true);
      }

      // Validate field
      validateField(field, processedValue);
    },
    [validateField, isDirty]
  );

  /**
   * Validates all fields
   */
  const validate = useCallback(() => {
    const newErrors: ProfileFormErrors = {};
    let isFormValid = true;

    // Only validate fields with values
    Object.entries(values).forEach(([field, value]) => {
      if (value.trim() !== "") {
        const fieldIsValid = validateField(
          field as keyof ProfileFormValues,
          value
        );
        if (!fieldIsValid) {
          isFormValid = false;
        }
      }
    });

    return isFormValid;
  }, [values, validateField]);

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setValues(defaultValues);
    setErrors({});
    setIsDirty(false);
  }, [defaultValues]);

  /**
   * Check if form is valid whenever values change
   */
  useEffect(() => {
    if (isDirty) {
      const formIsValid = validate();
      setIsValid(formIsValid);
    }
  }, [values, isDirty, validate]);

  return {
    values,
    errors,
    isValid,
    isDirty,
    handleChange,
    validate,
    resetForm,
    setValues,
  };
}

export default useProfileFormValidation;
