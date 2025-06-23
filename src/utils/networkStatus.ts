/**
 * Network Status Utility
 *
 * Provides comprehensive network status monitoring and indicators for the UI
 */

import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useState } from "react";

// Network status types
export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
  isWifiEnabled?: boolean;
  details: {
    isConnectionExpensive?: boolean;
    cellularGeneration?: string | null;
    carrier?: string | null;
    ipAddress?: string;
    subnet?: string;
    frequency?: number;
    linkSpeed?: number;
    rxLinkSpeed?: number;
    txLinkSpeed?: number;
    strength?: number;
    ssid?: string;
    bssid?: string;
  };
}

export interface ConnectionQuality {
  level: "excellent" | "good" | "fair" | "poor" | "offline";
  speed: "fast" | "medium" | "slow" | "unknown";
  latency: "low" | "medium" | "high" | "unknown";
  description: string;
  showWarning: boolean;
}

// Network status hook
export function useNetworkStatus() {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: null,
    type: "unknown",
    details: {},
  });

  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>(
    {
      level: "excellent",
      speed: "unknown",
      latency: "unknown",
      description: "Connected",
      showWarning: false,
    }
  );

  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);

  // Determine connection quality based on network info
  const assessConnectionQuality = useCallback(
    (state: any): ConnectionQuality => {
      if (!state.isConnected) {
        return {
          level: "offline",
          speed: "unknown",
          latency: "unknown",
          description: "No internet connection",
          showWarning: true,
        };
      }

      if (state.isInternetReachable === false) {
        return {
          level: "poor",
          speed: "unknown",
          latency: "unknown",
          description: "Limited connectivity - no internet access",
          showWarning: true,
        };
      }

      // WiFi connection analysis
      if (state.type === "wifi") {
        const strength = state.details?.strength || 0;
        const frequency = state.details?.frequency || 0;
        const linkSpeed = state.details?.linkSpeed || 0;

        if (strength >= -50 && linkSpeed >= 100) {
          return {
            level: "excellent",
            speed: "fast",
            latency: "low",
            description: "Excellent WiFi connection",
            showWarning: false,
          };
        } else if (strength >= -70 && linkSpeed >= 50) {
          return {
            level: "good",
            speed: "medium",
            latency: "low",
            description: "Good WiFi connection",
            showWarning: false,
          };
        } else if (strength >= -80) {
          return {
            level: "fair",
            speed: "medium",
            latency: "medium",
            description: "Fair WiFi connection",
            showWarning: false,
          };
        } else {
          return {
            level: "poor",
            speed: "slow",
            latency: "high",
            description: "Weak WiFi signal",
            showWarning: true,
          };
        }
      }

      // Cellular connection analysis
      if (state.type === "cellular") {
        const generation = state.details?.cellularGeneration;
        const isExpensive = state.details?.isConnectionExpensive;

        let quality: ConnectionQuality = {
          level: "good",
          speed: "medium",
          latency: "medium",
          description: "Cellular connection",
          showWarning: false,
        };

        switch (generation) {
          case "5g":
            quality = {
              level: "excellent",
              speed: "fast",
              latency: "low",
              description: "5G connection",
              showWarning: false,
            };
            break;
          case "4g":
            quality = {
              level: "good",
              speed: "fast",
              latency: "low",
              description: "4G LTE connection",
              showWarning: false,
            };
            break;
          case "3g":
            quality = {
              level: "fair",
              speed: "medium",
              latency: "medium",
              description: "3G connection",
              showWarning: false,
            };
            break;
          case "2g":
            quality = {
              level: "poor",
              speed: "slow",
              latency: "high",
              description: "2G connection - limited functionality",
              showWarning: true,
            };
            break;
          default:
            quality = {
              level: "fair",
              speed: "medium",
              latency: "medium",
              description: "Cellular connection",
              showWarning: false,
            };
        }

        // Add expense warning for metered connections
        if (isExpensive) {
          quality.description += " (metered)";
          quality.showWarning = true;
        }

        return quality;
      }

      // Other connection types
      return {
        level: "good",
        speed: "unknown",
        latency: "unknown",
        description: "Connected",
        showWarning: false,
      };
    },
    []
  );

  // Monitor network changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const newNetworkState: NetworkState = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        isWifiEnabled: state.isWifiEnabled,
        details: {
          isConnectionExpensive:
            state.details?.isConnectionExpensive ?? undefined,
          cellularGeneration:
            (state.details as any)?.cellularGeneration ?? undefined,
          carrier: (state.details as any)?.carrier ?? undefined,
          ipAddress: (state.details as any)?.ipAddress ?? undefined,
          subnet: (state.details as any)?.subnet ?? undefined,
          frequency: (state.details as any)?.frequency ?? undefined,
          linkSpeed: (state.details as any)?.linkSpeed ?? undefined,
          rxLinkSpeed: (state.details as any)?.rxLinkSpeed ?? undefined,
          txLinkSpeed: (state.details as any)?.txLinkSpeed ?? undefined,
          strength: (state.details as any)?.strength ?? undefined,
          ssid: (state.details as any)?.ssid ?? undefined,
          bssid: (state.details as any)?.bssid ?? undefined,
        },
      };

      setNetworkState(newNetworkState);

      const quality = assessConnectionQuality(state);
      setConnectionQuality(quality);

      const currentlyOnline = state.isConnected ?? false;
      const previouslyOnline = isOnline;

      setIsOnline(currentlyOnline);

      // Track if user was offline and came back online
      if (!previouslyOnline && currentlyOnline) {
        setWasOffline(true);
        // Clear the flag after a delay
        setTimeout(() => setWasOffline(false), 3000);
      }
    });

    return unsubscribe;
  }, [assessConnectionQuality, isOnline]);

  // Get network status summary
  const getNetworkSummary = useCallback(() => {
    return {
      isOnline,
      quality: connectionQuality.level,
      description: connectionQuality.description,
      shouldShowWarning: connectionQuality.showWarning,
      connectionType: networkState.type,
      wasOffline,
    };
  }, [isOnline, connectionQuality, networkState.type, wasOffline]);

  // Check if connection is suitable for heavy operations
  const isConnectionGood = useCallback(() => {
    return (
      isOnline &&
      connectionQuality.level !== "poor" &&
      connectionQuality.level !== "offline"
    );
  }, [isOnline, connectionQuality.level]);

  // Check if connection is metered/expensive
  const isConnectionExpensive = useCallback(() => {
    return networkState.details.isConnectionExpensive === true;
  }, [networkState.details.isConnectionExpensive]);

  return {
    networkState,
    connectionQuality,
    isOnline,
    wasOffline,
    getNetworkSummary,
    isConnectionGood,
    isConnectionExpensive,
  };
}

// Network speed test utility
export class NetworkSpeedTest {
  private testUrl = "https://www.google.com/favicon.ico"; // Small file for speed test
  private testSize = 318; // bytes

  async measureLatency(): Promise<number> {
    try {
      const start = Date.now();
      const response = await fetch(this.testUrl, {
        method: "HEAD",
        cache: "no-store",
      });
      const end = Date.now();

      if (response.ok) {
        return end - start;
      }
      return -1;
    } catch (error) {
      console.error("Latency test failed:", error);
      return -1;
    }
  }

  async measureDownloadSpeed(): Promise<number> {
    try {
      const start = Date.now();
      const response = await fetch(this.testUrl, {
        cache: "no-store",
      });
      const end = Date.now();

      if (response.ok) {
        const duration = (end - start) / 1000; // seconds
        const speedKbps = (this.testSize * 8) / (duration * 1024); // kbps
        return speedKbps;
      }
      return -1;
    } catch (error) {
      console.error("Speed test failed:", error);
      return -1;
    }
  }

  async runQuickTest(): Promise<{
    latency: number;
    downloadSpeed: number;
    rating: "excellent" | "good" | "fair" | "poor" | "failed";
  }> {
    try {
      const [latency, downloadSpeed] = await Promise.all([
        this.measureLatency(),
        this.measureDownloadSpeed(),
      ]);

      let rating: "excellent" | "good" | "fair" | "poor" | "failed" = "failed";

      if (latency > 0 && downloadSpeed > 0) {
        if (latency < 100 && downloadSpeed > 1000) {
          rating = "excellent";
        } else if (latency < 300 && downloadSpeed > 500) {
          rating = "good";
        } else if (latency < 600 && downloadSpeed > 100) {
          rating = "fair";
        } else {
          rating = "poor";
        }
      }

      return {
        latency,
        downloadSpeed,
        rating,
      };
    } catch (error) {
      console.error("Network test failed:", error);
      return {
        latency: -1,
        downloadSpeed: -1,
        rating: "failed",
      };
    }
  }
}

// Utility functions
export function formatNetworkSpeed(speedKbps: number): string {
  if (speedKbps < 1) return "Unknown";
  if (speedKbps < 1024) return `${Math.round(speedKbps)} Kbps`;
  return `${(speedKbps / 1024).toFixed(1)} Mbps`;
}

export function formatLatency(latencyMs: number): string {
  if (latencyMs < 0) return "Unknown";
  return `${latencyMs}ms`;
}

export function getConnectionTypeIcon(type: string): string {
  switch (type) {
    case "wifi":
      return "📶";
    case "cellular":
      return "📱";
    case "ethernet":
      return "🔌";
    case "bluetooth":
      return "🔵";
    default:
      return "🌐";
  }
}

export function getQualityColor(level: ConnectionQuality["level"]): string {
  switch (level) {
    case "excellent":
      return "#4CAF50"; // Green
    case "good":
      return "#8BC34A"; // Light Green
    case "fair":
      return "#FF9800"; // Orange
    case "poor":
      return "#F44336"; // Red
    case "offline":
      return "#9E9E9E"; // Gray
    default:
      return "#2196F3"; // Blue
  }
}

// Export network speed test instance
export const networkSpeedTest = new NetworkSpeedTest();
