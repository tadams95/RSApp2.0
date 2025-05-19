import { router, Route } from "expo-router";

/**
 * Navigation utilities for Expo Router
 * This file contains helper functions for common navigation patterns
 */

/**
 * Navigate to a screen in the app route group
 * @param path The path segment after /(app)/
 * @param params Optional parameters to pass to the route
 */
export function navigateToApp(path: string, params?: Record<string, string | number | (string | number)[] | null | undefined>): void {
  router.push({
    pathname: `/(app)/${path}`,
    params
  });
}

/**
 * Navigate to a screen in the auth route group
 * @param path The path segment after /(auth)/
 * @param params Optional parameters to pass to the route
 */
export function navigateToAuth(path: string = "", params?: Record<string, string | number | (string | number)[] | null | undefined>): void {
  router.push({
    pathname: `/(auth)/${path}`,
    params
  });
}

/**
 * Navigate to a screen in the guest route group
 * @param path The path segment after /(guest)/
 * @param params Optional parameters to pass to the route
 */
export function navigateToGuest(path: string, params?: Record<string, string | number | (string | number)[] | null | undefined>): void {
  router.push({
    pathname: `/(guest)/${path}`,
    params
  });
}

/**
 * Navigate to the product detail screen
 * @param id The product ID
 * @param data The serialized product data
 */
export function navigateToProduct(id: string, data: object): void {
  router.push({
    pathname: "/(app)/shop/[id]",
    params: {
      id,
      data: JSON.stringify(data),
    },
  });
}

/**
 * Navigate to the guest product detail screen
 * @param id The product ID
 * @param data The serialized product data
 */
export function navigateToGuestProduct(id: string, data: object): void {
  router.push({
    pathname: "/(guest)/shop/[id]",
    params: {
      id,
      data: JSON.stringify(data),
    },
  });
}

/**
 * Navigate to the event detail screen
 * @param event The event data object
 */
export function navigateToEvent(event: {
  id?: string;
  name: string;
  dateTime: string;
  price: string | number;
  imgURL: string;
  description?: string;
  location?: string;
}): void {
  router.push({
    pathname: "/(app)/events/[id]",
    params: {
      id: event.id || event.name,
      name: event.name,
      dateTime: event.dateTime,
      price: event.price.toString(),
      imgURL: event.imgURL,
      description: event.description || "",
      location: event.location || "",
    },
  });
}

/**
 * Navigate to the guest event detail screen
 * @param event The event data object
 */
export function navigateToGuestEvent(event: {
  id?: string;
  name: string;
  dateTime: string;
  price: string | number;
  imgURL: string;
  description?: string;
  location?: string;
}): void {
  router.push({
    pathname: "/(guest)/events/[id]",
    params: {
      id: event.id || event.name,
      name: event.name,
      dateTime: event.dateTime,
      price: event.price.toString(),
      imgURL: event.imgURL,
      description: event.description || "",
      location: event.location || "",
    },
  });
}

/**
 * Navigate to the account screen
 * @param tab Optional tab name to focus (settings, history, etc.)
 */
export function navigateToAccount(tab?: string): void {
  router.push({
    pathname: "/(app)/account",
    params: tab ? { tab } : undefined,
  });
}

/**
 * Navigate to the cart screen
 */
export function navigateToCart(): void {
  router.push("/(app)/cart");
}

/**
 * Go back to the previous screen
 */
export function goBack(): void {
  router.back();
}

/**
 * Replace the current screen with a new one
 * @param pathname The full path to navigate to
 * @param params Optional parameters to pass to the route
 */
export function replaceScreen(pathname: string, params?: Record<string, string | number | (string | number)[] | null | undefined>): void {
  router.replace({
    pathname,
    params
  });
}

/**
 * Navigate to the home screen
 */
export function navigateToHome(): void {
  router.push("/(app)/home");
}

/**
 * Log out and navigate to the auth screen
 */
export function navigateToLogout(): void {
  replaceScreen("/(auth)/");
}
