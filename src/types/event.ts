// Event types - canonical definitions
// Re-exported from @/utils/eventDataHandler for backward compatibility

import { Timestamp } from "firebase/firestore";

// Define types for event data
export interface EventData {
  id?: string;
  name: string;
  dateTime: Timestamp;
  location: string;
  price: number;
  imgURL: string;
  quantity: number;
  description?: string;
  attendingCount?: number;
  [key: string]: any; // For any additional fields
}
