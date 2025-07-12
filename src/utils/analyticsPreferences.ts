import AsyncStorage from "@react-native-async-storage/async-storage";

const ANALYTICS_PREFERENCE_KEY = "analytics_enabled";

export interface AnalyticsPreference {
  enabled: boolean;
  lastUpdated: number;
}

/**
 * Analytics Preferences Manager
 * Handles user consent for PostHog analytics tracking
 */
export class AnalyticsPreferences {
  /**
   * Get current analytics preference
   * Defaults to enabled if no preference is stored
   */
  static async getPreference(): Promise<AnalyticsPreference> {
    try {
      const stored = await AsyncStorage.getItem(ANALYTICS_PREFERENCE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }

      // Default to enabled for new users
      const defaultPreference: AnalyticsPreference = {
        enabled: true,
        lastUpdated: Date.now(),
      };

      await this.setPreference(defaultPreference.enabled);
      return defaultPreference;
    } catch (error) {
      console.error("Failed to get analytics preference:", error);
      // Fail safely - default to enabled
      return {
        enabled: true,
        lastUpdated: Date.now(),
      };
    }
  }

  /**
   * Set analytics preference
   */
  static async setPreference(enabled: boolean): Promise<void> {
    try {
      const preference: AnalyticsPreference = {
        enabled,
        lastUpdated: Date.now(),
      };

      await AsyncStorage.setItem(
        ANALYTICS_PREFERENCE_KEY,
        JSON.stringify(preference)
      );
    } catch (error) {
      console.error("Failed to set analytics preference:", error);
      throw error;
    }
  }

  /**
   * Check if analytics is currently enabled
   */
  static async isEnabled(): Promise<boolean> {
    const preference = await this.getPreference();
    return preference.enabled;
  }

  /**
   * Enable analytics tracking
   */
  static async enable(): Promise<void> {
    await this.setPreference(true);
  }

  /**
   * Disable analytics tracking
   */
  static async disable(): Promise<void> {
    await this.setPreference(false);
  }

  /**
   * Clear all stored analytics preferences
   * Used for account deletion or data reset
   */
  static async clear(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ANALYTICS_PREFERENCE_KEY);
    } catch (error) {
      console.error("Failed to clear analytics preferences:", error);
    }
  }
}
