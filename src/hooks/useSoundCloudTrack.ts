import { useCallback, useEffect, useState } from "react";
import {
  fetchSoundCloudTrackInfo,
  isValidSoundCloudUrl,
  SoundCloudErrorType,
  SoundCloudTrackInfo,
} from "../utils/soundcloud";

/**
 * Hook to fetch and cache SoundCloud track metadata
 *
 * Usage:
 * ```tsx
 * const { trackInfo, isLoading, error, errorType, refetch } = useSoundCloudTrack(songUrl);
 * ```
 */

export interface UseSoundCloudTrackResult {
  trackInfo: SoundCloudTrackInfo | null;
  isLoading: boolean;
  error: string | null;
  errorType: SoundCloudErrorType | null;
  refetch: () => void;
}

export function useSoundCloudTrack(
  songUrl: string | null | undefined
): UseSoundCloudTrackResult {
  const [trackInfo, setTrackInfo] = useState<SoundCloudTrackInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<SoundCloudErrorType | null>(null);

  const fetchTrack = useCallback(async () => {
    // Reset state
    setError(null);
    setErrorType(null);

    // Validate URL
    if (!songUrl) {
      setTrackInfo(null);
      setIsLoading(false);
      return;
    }

    if (!isValidSoundCloudUrl(songUrl)) {
      setTrackInfo(null);
      setIsLoading(false);
      setError("Invalid SoundCloud URL");
      setErrorType("invalid_url");
      return;
    }

    setIsLoading(true);

    try {
      const result = await fetchSoundCloudTrackInfo(songUrl);

      if (result.info) {
        setTrackInfo(result.info);
        setError(null);
        setErrorType(null);
      } else {
        setTrackInfo(null);
        setError(result.error || "Could not load track info");
        setErrorType(result.errorType || "unknown");
      }
    } catch (err) {
      console.error("[useSoundCloudTrack] Error:", err);
      setTrackInfo(null);
      setError("Failed to fetch track info");
      setErrorType("unknown");
    } finally {
      setIsLoading(false);
    }
  }, [songUrl]);

  // Fetch when songUrl changes
  useEffect(() => {
    fetchTrack();
  }, [fetchTrack]);

  // Manual refetch function
  const refetch = useCallback(() => {
    fetchTrack();
  }, [fetchTrack]);

  return {
    trackInfo,
    isLoading,
    error,
    errorType,
    refetch,
  };
}

export default useSoundCloudTrack;
