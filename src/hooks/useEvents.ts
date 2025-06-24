import { useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
} from "firebase/firestore";

import { queryKeys, queryOptions } from "../config/reactQuery";
import {
  EventData,
  handleEventFetchError,
  sanitizeEventData,
} from "../utils/eventDataHandler";

/**
 * Hook to fetch all upcoming events
 * Used by both authenticated and guest event list screens
 */
export function useEvents(): UseQueryResult<EventData[], Error> {
  return useQuery({
    queryKey: queryKeys.events.list({}),
    queryFn: async (): Promise<EventData[]> => {
      try {
        const firestore = getFirestore();
        const currentDate = new Date();
        const eventCollectionRef = collection(firestore, "events");
        const q = query(
          eventCollectionRef,
          where("dateTime", ">=", currentDate)
        );
        const eventSnapshot = await getDocs(q);

        const eventData = eventSnapshot.docs
          .map((doc) => {
            // Apply data sanitization to each event
            const rawData = { id: doc.id, ...doc.data() };
            return sanitizeEventData(rawData);
          })
          .sort((a, b) => {
            // Sort events by date - with fallback for invalid dates
            try {
              return (
                a.dateTime.toDate().getTime() - b.dateTime.toDate().getTime()
              );
            } catch (error) {
              console.warn(
                "Date sorting error, using current time as fallback"
              );
              return 0; // Default to equality if dates can't be compared
            }
          });

        return eventData;
      } catch (error) {
        // Use our existing error handler
        const errorMessage = handleEventFetchError(
          error,
          "useEvents.queryFn",
          {}
        );
        throw new Error(errorMessage);
      }
    },
    ...queryOptions.events,
  });
}

/**
 * Hook to fetch all events (including past ones) for admin/management purposes
 * Currently not used but provides flexibility for future features
 */
export function useAllEvents(): UseQueryResult<EventData[], Error> {
  return useQuery({
    queryKey: queryKeys.events.list({ includePast: true }),
    queryFn: async (): Promise<EventData[]> => {
      try {
        const firestore = getFirestore();
        const eventCollectionRef = collection(firestore, "events");
        const eventSnapshot = await getDocs(eventCollectionRef);

        const eventData = eventSnapshot.docs
          .map((doc) => {
            const rawData = { id: doc.id, ...doc.data() };
            return sanitizeEventData(rawData);
          })
          .sort((a, b) => {
            try {
              return (
                a.dateTime.toDate().getTime() - b.dateTime.toDate().getTime()
              );
            } catch (error) {
              console.warn(
                "Date sorting error, using current time as fallback"
              );
              return 0;
            }
          });

        return eventData;
      } catch (error) {
        const errorMessage = handleEventFetchError(
          error,
          "useAllEvents.queryFn",
          {}
        );
        throw new Error(errorMessage);
      }
    },
    ...queryOptions.events,
  });
}

/**
 * Hook to fetch attending count for a specific event
 * Used by guest event detail screen to show how many people are attending
 */
export function useEventAttendingCount(
  eventName: string
): UseQueryResult<number, Error> {
  return useQuery({
    queryKey: [...queryKeys.events.detail(eventName), "attendingCount"],
    queryFn: async (): Promise<number> => {
      try {
        const firestore = getFirestore();
        const ragersCollectionRef = collection(
          firestore,
          "events",
          eventName,
          "ragers"
        );
        const querySnapshot = await getDocs(ragersCollectionRef);
        return querySnapshot.size;
      } catch (error) {
        const errorMessage = handleEventFetchError(
          error,
          "useEventAttendingCount.queryFn",
          { eventName }
        );
        throw new Error(errorMessage);
      }
    },
    enabled: !!eventName, // Only run query if eventName is provided
    ...queryOptions.events,
  });
}

/**
 * Helper hook for loading and error states
 * Provides consistent loading/error UI patterns across event screens
 */
export function useEventsWithHelpers() {
  const { data: events, isLoading, error, refetch } = useEvents();

  return {
    events: events || [],
    isLoading,
    error,
    refetch,
    // Helper flags for UI
    hasEvents: !isLoading && !error && events && events.length > 0,
    isEmpty: !isLoading && !error && events && events.length === 0,
    hasError: !!error,
  };
}

/**
 * Helper hook for attending count with error handling
 */
export function useEventAttendingCountWithHelpers(eventName: string) {
  const {
    data: attendingCount,
    isLoading,
    error,
    refetch,
  } = useEventAttendingCount(eventName);

  return {
    attendingCount: attendingCount || 0,
    isLoading,
    error,
    refetch,
    hasError: !!error,
  };
}
