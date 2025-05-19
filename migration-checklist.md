# Migration Checklist for Rage State App

Use this checklist to track progress on the migration to Expo Router and implementation of modernization features.

## Project Setup

- [✅] Install required dependencies
  - [✅] `expo-router`(version ~5.0.7)
  - [✅] `react-native-safe-area-context`(version 5.4.0)
  - [✅] `react-native-screens` (version ~4.10.0)
  - [✅] `expo-linking`(version ~7.1.5)
  - [✅] `expo-constants`(version ~17.1.6)
  - [✅] `expo-status-bar`(version ~2.2.3)
- [✅] Update configuration files
  - [✅] Set main entry point to "expo-router/entry" in package.json
  - [✅] Add scheme "ragestate" to app.json
  - [✅] Enable metro web bundler in app.json (if supporting web)
  - [✅] Update babel.config.js if needed
- [✅] Create new directory structure
  - [✅] Create src/ directory
  - [✅] Create src/app/ directory for routes
  - [✅] Set up component organization structure

## Core Structure Implementation

- [✅] Root Layout (src/app/\_layout.tsx)
  - [✅] Splash screen handling
  - [✅] App update checking
  - [✅] Redux Provider setup
  - [✅] Auth Provider implementation
- [✅] Authentication Context
  - [✅] Create AuthContext.tsx
  - [✅] Implement authentication state management
  - [✅] Handle "stay logged in" functionality
  - [✅] Connect auth state to routing
- [✅] Route Groups
  - [✅] Auth group layout (/(auth)/\_layout.tsx)
  - [✅] App group layout (/(app)/\_layout.tsx)
  - [✅] Guest group layout (/(guest)/\_layout.tsx)

## Page Implementations

- [✓] Auth Screens
  - [✅] Entry/Welcome screen
  - [✅] Login screen
  - [✅] Signup screen
  - [✅] Forgot password screen
- [✓] Main App Screens
  - [✅] Home screen
  - [✅] Shop screens
    - [✅] Product list
    - [✅] Product details (dynamic route)
  - [✅] Event screens
    - [✅] Event list
    - [✅] Event details (dynamic route)
    - [✅] My events screen
  - [✅] Cart screen
  - [✅] Account screen
- [✅] Guest Mode
  - [✅] Guest shop screens
  - [✅] Guest event screens

## Component Adaptations

- [ ] Update navigation references
  - [ ] Create navigation utility functions
  - [ ] Replace navigation.navigate() with router.navigate()
  - [ ] Update goBack() functions
- [ ] Adapt shared components
  - [✅] UI components
    - [✅] TickerAnnouncement
  - [✅] Loading overlays
  - [✅] Modals
    - [✅] SettingsModal
    - [✅] QRModal
    - [✅] HistoryModal
    - [✅] EditProfile
  - [ ] Form components

## Technical Improvements

- [ ] Package Dependency Updates

  - [ ] Replace unmaintained packages
    - [ ] Replace `@rneui/base` and `@rneui/themed` with a maintained UI library:
      - [ ] Option 1: Install and migrate to `react-native-paper`
      - [ ] Option 2: Install and migrate to `react-native-ui-lib`
    - [ ] Replace `react-native-swiper` with a maintained alternative:
      - [ ] Option 1: Install and migrate to `react-native-reanimated-carousel`
      - [ ] Option 2: Install and migrate to `react-native-snap-carousel`
  - [ ] Verify compatibility of packages with no metadata
    - [ ] Evaluate if `@babel/helper-create-class-features-plugin` can be removed or updated
    - [ ] Ensure `firebase` SDK compatibility with latest Expo version
    - [ ] Check if `fs-extra` is necessary (typically only used in build scripts)
    - [ ] Validate `shopify-buy` SDK for compatibility with current Shopify API
  - [ ] Run `npx expo-doctor` regularly to monitor package health

- [✅] TypeScript Migration
  - [✅] Set up TypeScript configuration
  - [✅] Convert utility functions
    - [✅] auth.ts
  - [✅] Convert shared components
    - [✅] LoadingOverlay
  - [✅] Convert screens (guest mode)
    - [✅] GuestEventView
    - [✅] GuestEvent
    - [✅] GuestShop
    - [✅] GuestIndexPage
- [ ] State Management
  - [ ] Implement React Query for server state
  - [ ] Consider Zustand for client state
  - [ ] Update Redux implementation if keeping it
- [ ] Performance Optimizations
  - [ ] Implement virtualized lists
  - [ ] Add image optimizations
  - [ ] Add lazy loading for routes
- [ ] UI/UX Improvements
  - [ ] Add skeleton loading screens
  - [ ] Implement smoother animations
  - [ ] Consider a design system or UI library
- [ ] Testing Infrastructure
  - [ ] Set up Jest
  - [ ] Add React Native Testing Library
  - [ ] Add basic test coverage
- [ ] Error Handling
  - [ ] Implement error boundaries
  - [ ] Add API error handling
  - [ ] Improve UX for error states
- [ ] Offline Support
  - [ ] Implement data caching
  - [ ] Add network state detection
  - [ ] Create offline-friendly workflows
- [ ] Security Enhancements
  - [ ] Use secure storage for sensitive data
  - [ ] Optimize Firebase rules
  - [ ] Add input validation
- [ ] Accessibility
  - [ ] Add screen reader support
  - [ ] Improve focus management
  - [ ] Add proper semantic elements
- [ ] Advanced Features
  - [ ] Enhance push notifications
  - [ ] Implement deep linking
- [ ] Analytics Integration

  - [ ] Install Firebase Analytics
  - [ ] Set up event tracking
  - [ ] Create custom events for key user actions
  - [ ] Implement user properties tracking

- [ ] Styling System
  - [ ] Install and configure NativeWind
  - [ ] Create design tokens and theme
  - [ ] Set up dark/light mode support
  - [ ] Convert core components to use NativeWind

## Testing and Validation

- [ ] Core Functionality Testing
  - [ ] Authentication flow
  - [ ] Navigation system
  - [ ] Product browsing and details
  - [ ] Shopping cart
  - [ ] Checkout process
  - [ ] Account management
- [ ] Cross-Platform Testing
  - [ ] iOS testing
  - [ ] Android testing
  - [ ] Web testing (if applicable)
- [ ] Edge Case Testing
  - [ ] Offline mode
  - [ ] Slow connections
  - [ ] Authentication edge cases
  - [ ] Form validation
- [ ] Performance Testing
  - [ ] Startup time
  - [ ] Navigation transitions
  - [ ] List rendering
  - [ ] Image loading

## Deployment

- [ ] Update EAS configuration
  - [ ] Update build profiles
  - [ ] Configure preview channels
- [ ] Build and Deploy
  - [ ] Create development build
  - [ ] Create preview build
  - [ ] Create production build
- [ ] Post-Deployment
  - [ ] Monitor for errors
  - [ ] Collect analytics
  - [ ] Gather user feedback

## File Migration Progress

- [ ] `favorites.js`
- [✅] `cartSlice.js`
- [ ] `store.js`

## Files/Folders to Remove After Migration

- [ ] **Root Files**

  - [ ] `App.js` (replaced by `src/app/_layout.tsx`)
  - [ ] `jsconfig.json` (replaced by TypeScript configuration)

- [ ] **Legacy Directories**

  - [ ] `screens/` (replaced by routes in `src/app/`)
  - [ ] `ui/` (moved to `src/components/ui/`)
  - [ ] `util/` (moved to `src/utils/`)
  - [ ] `templates/` (no longer needed with TypeScript)
  - [ ] `components/` (moved to `src/components/`)
  - [ ] `constants/` (moved to `src/constants/`)
  - [ ] `store/` (if using Zustand instead of Redux)
    - [ ] Or partially for migrated files if keeping Redux

- [ ] **Temporary Migration Files**
  - [ ] `implementation-guide.md`
  - [ ] `implementation-plan.md`
  - [ ] `migration-checklist.md`
  - [ ] `technical-improvements.md`
  - [ ] `analytics-and-styling-guide.md`
