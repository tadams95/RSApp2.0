// src/analytics/AnalyticsProvider.tsx

import { logEvent, setUserId, setUserProperties } from "firebase/analytics";
import React, { createContext, ReactNode, useContext } from "react";
import { analytics } from "../firebase/firebase";

type EventParams = Record<string, any>;

interface AnalyticsContextType {
  logEvent: (name: string, params?: EventParams) => Promise<void>;
  logScreenView: (screenName: string, screenClass?: string) => Promise<void>;
  logPurchase: (params: {
    transactionId: string;
    value: number;
    currency: string;
    items: any[];
  }) => Promise<void>;
  logAddToCart: (params: {
    itemId: string;
    itemName: string;
    itemCategory: string;
    price: number;
    quantity?: number;
    currency?: string;
  }) => Promise<void>;
  setUserProperty: (name: string, value: string) => Promise<void>;
  setUserId: (id: string | null) => Promise<void>;
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(
  undefined
);

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (context === undefined) {
    throw new Error("useAnalytics must be used within an AnalyticsProvider");
  }
  return context;
};

interface AnalyticsProviderProps {
  children: ReactNode;
}

export const AnalyticsProvider = ({ children }: AnalyticsProviderProps) => {
  const logAnalyticsEvent = async (name: string, params?: EventParams) => {
    try {
      if (analytics) {
        await logEvent(analytics, name as any, params);
      } else {
        console.log("Analytics not available, event would be:", name, params);
      }
    } catch (error) {
      console.error("Analytics error:", error);
    }
  };

  const logScreenView = async (screenName: string, screenClass?: string) => {
    try {
      if (analytics) {
        await logEvent(analytics, "screen_view" as any, {
          screen_name: screenName,
          screen_class: screenClass || screenName,
        });
      } else {
        console.log(
          "Analytics not available, screen view would be:",
          screenName
        );
      }
    } catch (error) {
      console.error("Screen view log error:", error);
    }
  };

  const logPurchase = async (params: {
    transactionId: string;
    value: number;
    currency: string;
    items: any[];
  }) => {
    try {
      if (analytics) {
        await logEvent(analytics, "purchase" as any, {
          transaction_id: params.transactionId,
          value: params.value,
          currency: params.currency,
          items: params.items,
        });
      } else {
        console.log("Analytics not available, purchase would be:", params);
      }
    } catch (error) {
      console.error("Purchase log error:", error);
    }
  };

  const logAddToCart = async (params: {
    itemId: string;
    itemName: string;
    itemCategory: string;
    price: number;
    quantity?: number;
    currency?: string;
  }) => {
    try {
      if (analytics) {
        await logEvent(analytics, "add_to_cart" as any, {
          item_id: params.itemId,
          item_name: params.itemName,
          item_category: params.itemCategory,
          price: params.price,
          quantity: params.quantity || 1,
          currency: params.currency || "USD",
        });
      } else {
        console.log("Analytics not available, add to cart would be:", params);
      }
    } catch (error) {
      console.error("Add to cart log error:", error);
    }
  };

  const setUserProperty = async (name: string, value: string) => {
    try {
      if (analytics) {
        await setUserProperties(analytics, { [name]: value });
      } else {
        console.log(
          "Analytics not available, user property would be:",
          name,
          value
        );
      }
    } catch (error) {
      console.error("Set user property error:", error);
    }
  };

  const setAnalyticsUserId = async (id: string | null) => {
    try {
      if (analytics) {
        await setUserId(analytics, id);
      } else {
        console.log("Analytics not available, user ID would be:", id);
      }
    } catch (error) {
      console.error("Set user ID error:", error);
    }
  };

  return (
    <AnalyticsContext.Provider
      value={{
        logEvent: logAnalyticsEvent,
        logScreenView,
        logPurchase,
        logAddToCart,
        setUserProperty,
        setUserId: setAnalyticsUserId,
      }}
    >
      {children}
    </AnalyticsContext.Provider>
  );
};
