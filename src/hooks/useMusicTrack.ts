/**
 * useMusicTrack Hook
 * Unified hook for fetching track metadata from any supported music platform
 * (SoundCloud, Spotify, YouTube)
 */

import { useCallback, useEffect, useState } from "react";
import {
  detectMusicPlatform,
  fetchMusicTrackInfo,
  MusicErrorType,
  MusicPlatform,
  MusicTrackInfo,
} from "../utils/musicPlatforms";

// ============================================
// Types
// ============================================

export interface UseMusicTrackResult {
  /** Track metadata if successfully fetched */
  trackInfo: MusicTrackInfo | null;
  /** Whether the hook is currently fetching data */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Type of error for handling specific cases */
  errorType: MusicErrorType | null;
  /** Detected platform from the URL */
  platform: MusicPlatform;
  /** Manually refetch the track info */
  refetch: () => void;
}

// ============================================
// Hook Implementation
// ============================================

/**
 * Hook to fetch and cache music track metadata from any supported platform
 *
 * Supports: SoundCloud, Spotify, YouTube
 *
 * @example
 * ```tsx
 * const { trackInfo, isLoading, error, platform } = useMusicTrack(songUrl);
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error message={error} />;
 *
 * return (
 *   <View>
 *     <Text>{trackInfo?.title}</Text>
 *     <Text>{trackInfo?.artist}</Text>
 *     <PlatformBadge platform={platform} />
 *   </View>
 * );
 * ```
 */
export function useMusicTrack(
  songUrl: string | null | undefined
): UseMusicTrackResult {
  const [trackInfo, setTrackInfo] = useState<MusicTrackInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<MusicErrorType | null>(null);
  const [platform, setPlatform] = useState<MusicPlatform>("unknown");

  const fetchTrack = useCallback(async () => {
    // Reset state
    setError(null);
    setErrorType(null);

    // Handle empty URL
    if (!songUrl || !songUrl.trim()) {
      setTrackInfo(null);
      setIsLoading(false);
      setPlatform("unknown");
      return;
    }

    const trimmedUrl = songUrl.trim();

    // Detect platform first
    const detectedPlatform = detectMusicPlatform(trimmedUrl);
    setPlatform(detectedPlatform);

    // If unknown platform, show error
    if (detectedPlatform === "unknown") {
      setTrackInfo(null);
      setIsLoading(false);
      setError("Unsupported music platform");
      setErrorType("invalid_url");
      return;
    }

    setIsLoading(true);

    try {
      const result = await fetchMusicTrackInfo(trimmedUrl);

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
      console.error("[useMusicTrack] Error:", err);
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
    platform,
    refetch,
  };
}

export default useMusicTrack;
