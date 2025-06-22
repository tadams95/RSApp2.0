# Firebase Firestore Pagination with Error Handling

This document explains how to use the robust pagination system for Firebase Firestore that includes comprehensive error handling.

## Features

- Cursor-based pagination with Firestore
- Robust error handling for:
  - Invalid cursors
  - Out-of-bounds pagination requests
  - Network failures
- State persistence for recovering pagination
- Automatic retry with exponential backoff
- Recovery for interrupted pagination
- Network connectivity monitoring
- UI components with built-in loading, error, and empty states

## Core Components

### 1. Pagination Utility (`paginationHandler.ts`)

The core utility that handles all Firestore pagination operations with robust error handling:

```typescript
import {
  fetchPaginatedData,
  fetchNextPage,
  fetchPrevPage,
} from "../utils/paginationHandler";

// Fetch first page
const result = await fetchPaginatedData("collectionName", {
  pageSize: 10,
  orderByField: "createdAt",
  orderDirection: "desc",
});

// Fetch next page
const nextPage = await fetchNextPage("collectionName", result.paginationState);

// Fetch previous page
const prevPage = await fetchPrevPage("collectionName", result.paginationState);
```

### 2. React Hook (`usePagination.ts`)

A custom React hook that encapsulates the pagination logic for easy use in components:

```typescript
const {
  data,
  loading,
  error,
  hasNextPage,
  hasPrevPage,
  currentPage,
  fetchInitialPage,
  fetchNextPage,
  fetchPrevPage,
  refreshData,
} = usePagination("collectionName", {
  pageSize: 10,
  persistKey: "unique-key",
  orderByField: "createdAt",
  orderDirection: "desc",
});
```

### 3. Reusable UI Component (`PaginatedList.tsx`)

A complete UI component that handles rendering paginated data with error handling:

```tsx
<PaginatedList<ItemType>
  collectionPath="collectionName"
  renderItem={({ item }) => <YourItemComponent item={item} />}
  pageSize={10}
  orderByField="createdAt"
  orderDirection="desc"
  persistKey="unique-key"
/>
```

## Implementation Examples

### 1. Events List

See `src/app/(app)/events/paginated-events.tsx` for a complete example of how to use the pagination system for displaying events.

### 2. Shopify Products

For external API integrations like Shopify, see:

- `src/hooks/useShopifyPagination.ts` - Custom hook for Shopify pagination
- `src/app/(app)/shop/paginated-shop.tsx` - Implementation example

## Error Recovery Mechanisms

The pagination system implements several recovery mechanisms:

1. **Invalid Cursor Recovery**: If a cursor becomes invalid (e.g., the document was deleted), the system will reset to the first page with a clear error message.

2. **Out-of-Bounds Recovery**: If a page beyond available data is requested, the system will automatically adjust to the nearest available page.

3. **Network Recovery**: The system monitors network connectivity and automatically retries failed requests when connectivity is restored.

4. **Exponential Backoff**: Failed requests are retried with increasing delays to avoid overwhelming the server.

## State Persistence

Pagination state can be persisted to allow users to return to their previous position:

```typescript
// Save state with a unique key
savePaginationState("my-collection-key", paginationState);

// Load state (with optional expiration)
const savedState = loadPaginationState("my-collection-key", 60 * 60 * 1000); // 1 hour
```

## Adding to New Screens

1. Import the hook:

```tsx
import { usePagination } from "../../hooks/usePagination";
```

2. Use the hook in your component:

```tsx
const {
  data,
  loading,
  error,
  hasNextPage,
  hasPrevPage,
  fetchNextPage,
  fetchPrevPage,
} = usePagination("yourCollectionName", options);
```

3. Handle the UI states (loading, error, empty) and render your data.

## External API Adapters

For non-Firestore data sources, create custom hooks that follow the same pattern:

1. Create a pagination interface similar to `usePagination`
2. Implement cursor-based navigation
3. Handle error cases consistently
4. Provide the same recovery mechanisms

See `useShopifyPagination.ts` for an example adapter for Shopify's API.

## Testing

Tests are available in `tests/paginationHandler.test.ts` covering various edge cases and error conditions.
