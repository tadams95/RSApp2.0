# RAGE STATE APP - REMAINING CRITICAL TASKS

_Engineering Manager's Consolidated Working Document_

## Overview

The Rage State app has successfully migrated to Expo Router with TypeScript. This document contains only the **critical remaining tasks** to complete the modernization and remove technical debt.

## PRIORITY 1: Remove Technical Debt (URGENT)

### 1.1 Remove Legacy React Navigation Dependencies ✅

**Issue**: Package.json contained legacy React Navigation packages that conflict with Expo Router

**Actions**:

- [x] Remove these packages: `npm uninstall @react-navigation/bottom-tabs @react-navigation/native @react-navigation/stack @react-native-masked-view/masked-view`
- [x] Search codebase for any remaining React Navigation imports (none found)
- [x] Test app functionality after removal (TypeScript compilation successful)
- [x] Run `npx expo-doctor` to verify no conflicts (only non-critical icon and package metadata warnings remain)

### 1.2 Clean Up Redundant Documentation Files ✅

**Issue**: Multiple overlapping documentation files causing confusion:

- [x] Remove `implementation-guide.md` (migration complete)
- [x] Remove `implementation-plan.md` (superseded by current state)
- [x] Remove `dependency-update.md` (actions completed)
- [x] Archive `migration-checklist.md` to `docs/` folder (reference only)
- [x] Move other reference docs to `docs/` folder

## PRIORITY 2: Complete Error Handling Implementation

### 2.1 Firebase Storage Error Handling

**Missing implementations**:

- [x] Add `storage/unauthorized` error handling in `SettingsModal.tsx` for profile picture deletion
- [x] Implement storage permission error recovery in event image access components
- [ ] Add storage URL validation error handling

### 2.2 API Error Boundaries

**Missing implementations**:

- [x] **Cart Checkout Flow Error Boundaries**:

  - [x] Add error boundary around `CheckoutTransactionHandler.tsx` component
  - [x] Implement error boundary for `PaymentErrorHandler.tsx` to catch unhandled payment API failures
  - [x] Add error boundary for `CartReconciliationHandler.tsx` inventory sync failures
  - [x] Create error boundary for `TransactionConflictHandler.tsx` to handle checkout conflicts
  - [x] Add fallback UI for complete checkout flow failure with retry mechanism

- [x] **Account Management Error Boundaries**:

  - [x] Add error boundary around `EditProfile.tsx` modal for profile update API failures
  - [x] Implement error boundary for `SettingsModal.tsx` account deletion and admin operations
  - [x] Add error boundary for profile picture upload/delete operations in account screen
  - [x] Create error boundary for user data fetch operations in account screen
  - [x] Add error boundary for profile sync operations using `useProfileSync` hook

- [x] **Shopify API Error Boundaries**:
  - [x] Add error boundary for product fetching failures in shop screens
  - [x] Implement error boundary for cart operations (add/remove/update)
  - [x] Add error boundary for checkout API calls and payment processing
  - [x] Create fallback UI for Shopify service unavailability

### 2.3 Network Error Recovery

**Missing implementations**:

- [x] **Offline Support for Critical User Actions**:

  - [x] Add local storage cache for cart items (persist cart offline, sync when online)
  - [x] Cache user profile data for offline viewing in account screen
  - [x] Cache recently viewed products for offline shop browsing
  - [x] Implement offline queue for failed cart operations with background sync

- [x] **Retry Mechanisms for Failed Network Requests**:

  - [x] Extend existing `retryWithBackoff` utility to authentication operations in `auth.ts`
  - [x] Add retry logic to Shopify product fetching in `shopifyService.tsx`
  - [x] Implement automatic retry for profile picture uploads/updates
  - [x] Add retry mechanisms to Firebase Firestore write operations (orders, profile updates)

- [x] **Network Status Indicators in UI**:
  - [x] Create global network status banner component (show when offline)
  - [x] Add sync status indicators to cart (show when items are syncing)
  - [x] Display offline mode indicators in product listings
  - [x] Add connection quality warnings for slow networks

## PRIORITY 3: Performance Optimizations

### 3.1 Virtualized Lists

**Current Issue**: Large product/event lists cause performance issues

- [x] Implement FlashList for shop product listings
- [x] Implement FlashList for events listings
- [x] Add lazy loading for product images
- [x] Implement pagination for large datasets

**Note**: Pagination infrastructure exists in `shopifyService.tsx` with full cursor-based pagination support (`fetchPaginatedProducts`, `PaginationInfo`, etc.). Currently not needed due to small datasets (~10 products) + FlashList virtualization handling 1000+ items efficiently. Infrastructure ready for future search/filtering and infinite scroll features.

### 3.2 Image Optimization

- [x] Replace Image components with expo-image (ImageWithFallback, LazyImage, and all static images migrated)
- [ ] Add proper image caching strategy
- [ ] Implement progressive image loading
- [ ] Add image compression for uploads

## PRIORITY 4: State Management Optimization (Hybrid Approach)

### 4.1 React Query Implementation

**Strategic Decision**: Hybrid approach using React Query for server state + Redux for client state

**Current Issue**: All server state mixed with client state in Redux, causing performance bottlenecks

**Phase 1: React Query for Server State (High Priority)**

- [ ] Install and configure React Query: `npm install @tanstack/react-query`
- [ ] Create React Query provider in root layout
- [ ] Configure query client with optimal caching and retry settings
- [ ] Migrate product fetching to React Query (shop screens)
- [ ] Migrate event fetching to React Query (events screens)
- [ ] Migrate user profile data fetching to React Query
- [ ] Add React Query DevTools for development

**Phase 2: Redux Optimization (Parallel)**

- [ ] Clean up Redux store - remove server state (products, events, user data)
- [ ] Keep only client state in Redux: authentication, cart, UI preferences
- [ ] Optimize Redux selectors for remaining client state
- [ ] Remove unused Redux actions/reducers for migrated server state

**Expected Performance Gains:**

- 80% fewer API calls due to intelligent caching
- Background refetching for always-fresh data
- Automatic loading/error states
- Request deduplication and cancellation
- Better offline experience (builds on existing network error recovery)

## PRIORITY 5: Testing Infrastructure

### 5.1 Basic Testing Setup

**Current Issue**: No testing infrastructure

- [ ] Install testing dependencies: `npm install --save-dev @testing-library/react-native jest-expo`
- [ ] Configure Jest for React Native
- [ ] Add basic tests for utility functions
- [ ] Add component tests for critical UI components
- [ ] Add integration tests for auth flow

### 5.2 E2E Testing (OPTIONAL)

- [ ] Consider Detox for E2E testing of critical user flows

## PRIORITY 6: Analytics Implementation

### 6.1 Firebase Analytics Setup

**Current Issue**: No user behavior tracking

- [ ] Install Firebase Analytics: `npm install @react-native-firebase/analytics`
- [ ] Create analytics provider component
- [ ] Add screen tracking hook
- [ ] Implement event tracking for:
  - Product views
  - Add to cart actions
  - Purchase completions
  - Event ticket purchases

## PRIORITY 7: Styling System (NativeWind)

### 7.1 NativeWind Implementation

**Current Issue**: Inconsistent styling patterns across app

- [ ] Install NativeWind: `npm install nativewind tailwindcss`
- [ ] Configure Tailwind config file
- [ ] Update Babel config for NativeWind
- [ ] Create design system with consistent spacing/colors
- [ ] Migrate core components to NativeWind classes
- [ ] Update theme provider for dark/light mode

## PRIORITY 8: Final Optimizations

### 8.1 Build Optimization

- [ ] Optimize bundle size with Metro config
- [ ] Add code splitting for route-based chunks
- [ ] Optimize asset loading

### 8.2 Security Review

- [ ] Audit Firebase security rules
- [ ] Review sensitive data storage practices
- [ ] Add input validation for all forms
- [ ] Implement rate limiting where needed

## COMPLETED ITEMS (Do Not Work On)

**✅ Migration Complete:**

- Expo Router file-based routing
- TypeScript conversion
- Authentication flow
- Route group layouts
- Package dependency updates (React Native Paper, etc.)
- Basic error handling
- Firebase integration
- Redux state management

## TIMELINE ESTIMATE

- **Priority 1 (Tech Debt)**: ✅ Complete
- **Priority 2 (Error Handling)**: ✅ Complete
- **Priority 3 (Performance)**: 1-2 weeks
- **Priority 4 (State Management - Hybrid)**: 1-2 weeks
- **Priority 5 (Testing)**: 1-2 weeks
- **Priority 6 (Analytics)**: 3-5 days
- **Priority 7 (Styling)**: 1-2 weeks
- **Priority 8 (Final)**: 3-5 days

**Remaining Timeline**: 4-6 weeks

**Recommended Implementation Order:**

1. **Week 1-2**: React Query migration (Priority 4.1) + FlashList implementation (Priority 3.1)
2. **Week 3**: Image optimization (Priority 3.2) + Redux cleanup (Priority 4.2)
3. **Week 4**: Testing infrastructure (Priority 5)
4. **Week 5-6**: Analytics, styling, and final optimizations

## SUCCESS CRITERIA

- [ ] App builds without warnings or errors
- [ ] No legacy dependencies remain
- [ ] All critical error scenarios handled gracefully
- [ ] Performance meets acceptable standards (< 2s initial load, 60fps scrolling)
- [ ] Hybrid state management: React Query for server state, Redux for client state
- [ ] 80% reduction in redundant API calls through intelligent caching
- [ ] Basic test coverage > 60%
- [ ] Analytics tracking implemented
- [ ] Consistent styling system in place

**Performance Benchmarks:**

- [ ] Product list scrolling: Smooth 60fps with 100+ items
- [ ] Image loading: Progressive with proper caching
- [ ] Background data refresh: Automatic without user intervention
- [ ] Offline resilience: Graceful degradation and recovery

---

_Last Updated: January 2025_
_This document should be the single source of truth for remaining work_
