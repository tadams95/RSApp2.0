import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { ImageCacheManager } from "../../utils/imageCacheConfig";
import { imagePreloader } from "../../utils/imagePreloader";

interface ImageCacheMonitorProps {
  /**
   * Whether to show the cache monitor (only in development)
   * @default false
   */
  visible?: boolean;
  /**
   * Position of the monitor on screen
   * @default "top-right"
   */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

/**
 * Development tool for monitoring image cache performance
 * Only renders in development mode
 */
const ImageCacheMonitor: React.FC<ImageCacheMonitorProps> = ({
  visible = false,
  position = "top-right",
}) => {
  const [cacheInfo, setCacheInfo] = useState<any>(null);
  const [preloadStatus, setPreloadStatus] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!__DEV__ || !visible) return;

    const updateCacheInfo = async () => {
      try {
        const info = await ImageCacheManager.getCacheInfo();
        const status = imagePreloader.getPreloadStatus();
        
        setCacheInfo(info);
        setPreloadStatus(status);
      } catch (error) {
        console.warn("Failed to get cache info:", error);
      }
    };

    // Update initially
    updateCacheInfo();

    // Update every 5 seconds when expanded
    let interval: ReturnType<typeof setInterval> | null = null;
    if (expanded) {
      interval = setInterval(updateCacheInfo, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [visible, expanded]);

  // Don't render in production or when not visible
  if (!__DEV__ || !visible) {
    return null;
  }

  const getPositionStyle = () => {
    const baseStyle = {
      position: "absolute" as const,
      zIndex: 9999,
    };

    switch (position) {
      case "top-left":
        return { ...baseStyle, top: 50, left: 10 };
      case "top-right":
        return { ...baseStyle, top: 50, right: 10 };
      case "bottom-left":
        return { ...baseStyle, bottom: 50, left: 10 };
      case "bottom-right":
        return { ...baseStyle, bottom: 50, right: 10 };
      default:
        return { ...baseStyle, top: 50, right: 10 };
    }
  };

  const handleClearCache = () => {
    ImageCacheManager.clearAllCaches();
    console.log("Image cache cleared manually");
  };

  const handleClearPreloadCache = () => {
    imagePreloader.clearPreloadCache();
    console.log("Preload cache cleared manually");
  };

  return (
    <View style={[styles.container, getPositionStyle()]}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <Text style={styles.headerText}>
          📷 {expanded ? "▼" : "▶"}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <Text style={styles.title}>Image Cache Status</Text>
          
          {cacheInfo && (
            <View style={styles.section}>
              <Text style={styles.label}>Cache Status:</Text>
              <Text style={styles.value}>
                Memory: {cacheInfo.memoryCache}
              </Text>
              <Text style={styles.value}>
                Disk: {cacheInfo.diskCache}
              </Text>
            </View>
          )}

          {preloadStatus && (
            <View style={styles.section}>
              <Text style={styles.label}>Preloaded Images:</Text>
              <Text style={styles.value}>
                {preloadStatus.loaded}/{preloadStatus.total}
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleClearCache}
            >
              <Text style={styles.actionText}>Clear Cache</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleClearPreloadCache}
            >
              <Text style={styles.actionText}>Clear Preload</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderRadius: 8,
    minWidth: 120,
    maxWidth: 200,
  },
  header: {
    padding: 8,
    alignItems: "center",
  },
  headerText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  content: {
    padding: 8,
    paddingTop: 0,
  },
  title: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
  },
  section: {
    marginBottom: 8,
  },
  label: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 2,
  },
  value: {
    color: "#ccc",
    fontSize: 9,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: "#333",
    padding: 4,
    borderRadius: 4,
    flex: 1,
    marginHorizontal: 2,
  },
  actionText: {
    color: "white",
    fontSize: 8,
    textAlign: "center",
  },
});

export default ImageCacheMonitor;
