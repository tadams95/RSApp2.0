import { useLocalSearchParams } from "expo-router";
import React from "react";
import ErrorBoundary from "../../../components/ErrorBoundary";
import ProductDetail from "./ProductDetail";

/**
 * Wrapper component that applies error boundary to product detail screens
 */
export default function ProductWrapper() {
  const params = useLocalSearchParams<{ handle: string }>();

  return (
    <ErrorBoundary>
      <ProductDetail handle={params.handle} />
    </ErrorBoundary>
  );
}
