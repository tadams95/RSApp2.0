// Extended cart item types for use with events, products, etc.

export interface EventDetails {
  dateTime: string;
  location: string;
}

// Extend this interface as needed for different product types
export interface CartItemMetadata {
  eventDetails?: EventDetails;
  [key: string]: any; // Allow for other metadata extensions
}
