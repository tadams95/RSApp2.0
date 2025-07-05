// src/hooks/useScreenTracking.tsx

import { usePathname } from "expo-router";
import { useEffect } from "react";
import { useAnalytics } from "../analytics/AnalyticsProvider";

export function useScreenTracking() {
  const pathname = usePathname();
  const { logScreenView } = useAnalytics();

  useEffect(() => {
    if (pathname) {
      // Convert pathname to a readable screen name
      // e.g., "/(app)/shop/[id]" -> "Product Detail"
      const screenName = getScreenNameFromPath(pathname);

      // Log screen view
      logScreenView(screenName);
    }
  }, [pathname, logScreenView]);
}

function getScreenNameFromPath(path: string): string {
  // Extract screen name from path
  // This is a simple implementation - enhance as needed
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) return "Home";

  // Remove route groups like (app), (auth), (guest)
  const filteredSegments = segments.filter(
    (segment) => !segment.startsWith("(") || !segment.endsWith(")")
  );

  if (filteredSegments.length === 0) return "Home";

  const lastSegment = filteredSegments[filteredSegments.length - 1];

  if (!lastSegment) return "Home";

  // Handle dynamic routes
  if (lastSegment.startsWith("[") && lastSegment.endsWith("]")) {
    const paramName = lastSegment.replace("[", "").replace("]", "");
    if (paramName === "id" || paramName === "handle") {
      const routeBase = filteredSegments[filteredSegments.length - 2] || "";
      if (routeBase === "shop") return "Product Detail";
      if (routeBase === "events") return "Event Detail";
      return "Detail Page";
    }
    return "Dynamic Page";
  }

  // Convert to title case
  return (
    lastSegment.charAt(0).toUpperCase() +
    lastSegment
      .slice(1)
      .replace(/([A-Z])/g, " $1")
      .replace(/-/g, " ")
      .trim()
  );
}
