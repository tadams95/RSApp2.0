import { useCallback, useEffect, useState } from "react";
import {
  fetchSoundCloudTrackInfo,
  isValidSoundCloudUrl,
  SoundCloudTrackInfo,
} from "../utils/soundcloud";

/**
 * Hook to fetch and cache SoundCloud track metadata
 *
 * Usage:
 * ```tsx
 * const { trackInfo, isLoading, error, refetch } = useSoundCloudTrack(songUrl);
 * ```
 */

export interface UseSoundCloudTrackResult {
  trackInfo: SoundCloudTrackInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSoundCloudTrack(
  songUrl: string | null | undefined
): UseSoundCloudTrackResult {
  const [trackInfo, setTrackInfo] = useState<SoundCloudTrackInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrack = useCallback(async () => {
    // Reset state
    setError(null);

    // Validate URL
    if (!songUrl || !isValidSoundCloudUrl(songUrl)) {
      setTrackInfo(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const info = await fetchSoundCloudTrackInfo(songUrl);

      if (info) {
        setTrackInfo(info);
        setError(null);
      } else {
        setTrackInfo(null);
        setError("Could not load track info");
      }
    } catch (err) {
      console.error("[useSoundCloudTrack] Error:", err);
      setTrackInfo(null);
      setError("Failed to fetch track info");
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
    refetch,
  };
}

export default useSoundCloudTrack;
