# Color Consistency Checklist

> **Goal**: Align mobile app colors with web design spec (social-ui-design-spec.md)
> **Scope**: 93 files with hardcoded hex colors
> **Approach**: Centralize tokens in GlobalStyles, then update files systematically

---

## Phase 1: Define Semantic Color Tokens

Update `src/constants/styles.ts` with semantic tokens matching web spec.

### 1.1 Core Semantic Tokens

| Token           | Web Spec Value           | Current Mobile                  | Action    |
| --------------- | ------------------------ | ------------------------------- | --------- |
| `bgRoot`        | `#050505`                | `#000`                          | Add new   |
| `bgElev1`       | `#0d0d0f`                | `#222`, `#1a1a1a`               | Add new   |
| `bgElev2`       | `#16171a`                | `#2a2a2a`                       | Add new   |
| `bgReverse`     | `#ffffff`                | N/A                             | Add new   |
| `borderSubtle`  | `#242528`                | `#333`, `#555`                  | Add new   |
| `borderStrong`  | `#34363a`                | `#555`                          | Add new   |
| `textPrimary`   | `#f5f6f7`                | `#fff`                          | Add new   |
| `textSecondary` | `#a1a5ab`                | `#999`, `#aaa`                  | Add new   |
| `textTertiary`  | `#5d6269`                | `#666`, `#888`                  | Add new   |
| `accent`        | `#ff1f42`                | `#E12D39`, `#ff3c00`            | **Unify** |
| `accentGlow`    | `#ff415f`                | N/A                             | Add new   |
| `accentMuted`   | `rgba(255,31,66,0.25)`   | N/A                             | Add new   |
| `success`       | `#3ddc85`                | `#4caf50`, `#4ade80`            | **Unify** |
| `warning`       | `#ffb347`                | `#ff9800`                       | **Unify** |
| `danger`        | `#ff4d4d`                | `#FF6B6B`, `#ef4444`, `#d32f2f` | **Unify** |
| `bgHover`       | `rgba(255,255,255,0.05)` | N/A                             | Add new   |

**Checklist:**

- [ ] Add semantic color tokens to `src/constants/styles.ts`
- [ ] Keep existing grey/redVivid scales for backward compatibility
- [ ] Add shadow tokens matching web spec
- [ ] Add comment documentation for token usage

---

## Phase 2: Update App Screens (src/app/)

### 2.1 Root & Layouts (~6 files)

- [ ] `src/app/_layout.tsx` - Root background, loading states
- [ ] `src/app/index.tsx` - Initial screen
- [ ] `src/app/(app)/_layout.tsx` - Tab bar, navigation
- [ ] `src/app/(auth)/_layout.tsx` - Auth stack background
- [ ] `src/app/(guest)/_layout.tsx` - Guest stack background
- [ ] `src/app/(app)/profile/_layout.tsx` - Profile stack
- [ ] `src/app/(app)/social/_layout.tsx` - Social stack

### 2.2 Auth Screens (~4 files)

- [ ] `src/app/(auth)/index.tsx` - Auth landing
- [ ] `src/app/(auth)/login.tsx` - Login form
- [ ] `src/app/(auth)/signup.tsx` - Signup form
- [ ] `src/app/(auth)/forgotPassword.tsx` - Password reset

### 2.3 Main App Screens (~8 files)

- [ ] `src/app/(app)/home/index.tsx` - Home screen
- [ ] `src/app/(app)/account/index.tsx` - Account screen
- [x] `src/app/(app)/events/index.tsx` - Events list
- [x] `src/app/(app)/events/[id].tsx` - Event detail
- [x] `src/app/(app)/events/my-events.tsx` - My events
- [x] `src/app/(app)/events/paginated-events.tsx` - Paginated events

### 2.4 Social Screens (~2 files)

- [ ] `src/app/(app)/social/index.tsx` - Feed screen (FAB, tabs)
- [ ] `src/app/(app)/social/post/[postId].tsx` - Single post view

### 2.5 Shop Screens (~4 files)

- [ ] `src/app/(app)/shop/index.tsx` - Shop landing
- [ ] `src/app/(app)/shop/[handle].tsx` - Product detail
- [ ] `src/app/(app)/shop/ProductDetail.tsx` - Product component
- [ ] `src/app/(app)/shop/paginated-shop.tsx` - Paginated products

### 2.6 Cart Screens (~8 files)

- [ ] `src/app/(app)/cart/index.tsx` - Cart screen
- [ ] `src/app/(app)/cart/components/CartReconciliationHandler.tsx`
- [ ] `src/app/(app)/cart/components/CartRecoveryModal.tsx`
- [ ] `src/app/(app)/cart/components/PaymentErrorHandler.tsx`
- [ ] `src/app/(app)/cart/components/TransactionConflictHandler.tsx`
- [ ] `src/app/(app)/cart/components/CheckoutFlowErrorBoundary.tsx`
- [ ] `src/app/(app)/cart/components/CheckoutTransactionHandler.tsx`
- [ ] `src/app/(app)/cart/components/CheckoutErrorBoundary.tsx`

### 2.7 Guest Screens (~4 files)

- [ ] `src/app/(guest)/index.tsx`
- [ ] `src/app/(guest)/shop/index.tsx`
- [ ] `src/app/(guest)/shop/[id].tsx`
- [ ] `src/app/(guest)/events/index.tsx`
- [ ] `src/app/(guest)/events/[id].tsx`

---

## Phase 3: Update Components (src/components/)

### 3.1 Feed Components (~6 files) - HIGH PRIORITY

- [ ] `src/components/feed/PostCard.tsx` - Post display
- [ ] `src/components/feed/PostActions.tsx` - Like, comment, share
- [ ] `src/components/feed/PostComposer.tsx` - Create post modal
- [ ] `src/components/feed/CommentsList.tsx` - Comments display
- [ ] `src/components/feed/CommentInput.tsx` - Comment input
- [ ] `src/components/feed/MediaGrid.tsx` - Media display

### 3.2 Profile Components (~5 files)

- [ ] `src/components/profile/UserProfileView.tsx`
- [ ] `src/components/profile/ProfileHeader.tsx`
- [ ] `src/components/profile/ProfileStats.tsx`
- [ ] `src/components/profile/FollowButton.tsx`
- [ ] `src/components/profile/UserCard.tsx`

### 3.3 Modal Components (~7 files)

- [ ] `src/components/modals/EditProfile.tsx`
- [ ] `src/components/modals/SettingsModal.tsx`
- [ ] `src/components/modals/QRModal.tsx`
- [ ] `src/components/modals/HistoryModal.tsx`
- [ ] `src/components/modals/MyEvents.tsx`
- [ ] `src/components/modals/EventAdminView.tsx`
- [ ] `src/components/modals/AdminModal.tsx`

### 3.4 UI Components (~6 files)

- [ ] `src/components/ui/ProfileFormInput.tsx`
- [ ] `src/components/ui/CompressedImageUploader.tsx`
- [ ] `src/components/ui/AppCarousel.tsx`
- [ ] `src/components/ui/NetworkStatusBanner.tsx`
- [ ] `src/components/ui/LazyImage.tsx`
- [ ] `src/components/ui/PaginatedList.tsx`

### 3.5 Error Components (~15 files)

- [ ] `src/components/ErrorBoundary.tsx`
- [ ] `src/components/ErrorUI.tsx`
- [ ] `src/components/LoginErrorNotice.tsx`
- [ ] `src/components/SignupErrorNotice.tsx`
- [ ] `src/components/PasswordResetErrorNotice.tsx`
- [ ] `src/components/ProfileUpdateErrorNotice.tsx`
- [ ] `src/components/account/AccountErrorBoundary.tsx`
- [ ] `src/components/account/UserDataErrorBoundary.tsx`
- [ ] `src/components/account/SettingsErrorBoundary.tsx`
- [ ] `src/components/account/ProfilePictureErrorBoundary.tsx`
- [ ] `src/components/account/EditProfileErrorBoundary.tsx`
- [ ] `src/components/account/ProfileSyncErrorBoundary.tsx`
- [ ] `src/components/shopify/CartOperationErrorBoundary.tsx`
- [ ] `src/components/shopify/ProductFetchErrorBoundary.tsx`
- [ ] `src/components/shopify/ShopifyErrorBoundary.tsx`
- [ ] `src/components/shopify/CheckoutPaymentErrorBoundary.tsx`

### 3.6 Auth Components (~1 file)

- [ ] `src/components/auth/PasswordStrengthMeter.tsx`

### 3.7 Event Components (~1 file)

- [x] `src/components/events/EventNotFound.tsx`

### 3.8 Debug Components (~2 files)

- [ ] `src/components/debug/NotificationTestPanel.tsx`
- [ ] `src/components/debug/ImageCacheMonitor.tsx`

### 3.9 Other Components (~3 files)

- [ ] `src/components/LoadingOverlay.tsx`
- [ ] `src/components/ProfileSyncDemo.tsx`
- [ ] `src/components/RealtimeDatabaseConnectionStatus.tsx`

---

## Phase 4: Utilities & Config

- [ ] `src/constants/styles.ts` - Main style definitions (Phase 1)
- [ ] `src/constants/styles.tsx` - Deprecated, consider removing
- [ ] `src/utils/networkStatus.ts` - Network status colors

---

## Phase 5: Testing & Validation

- [ ] Update test files if they reference colors directly
- [ ] Visual regression check on key screens
- [ ] Verify no TypeScript errors after changes
- [ ] Test dark mode consistency (if applicable)

---

## Color Mapping Reference

### Backgrounds

| Old Value         | New Token | Web Value |
| ----------------- | --------- | --------- |
| `#000`            | `bgRoot`  | `#050505` |
| `#111`, `#1a1a1a` | `bgElev1` | `#0d0d0f` |
| `#222`, `#2a2a2a` | `bgElev2` | `#16171a` |

### Borders

| Old Value | New Token      | Web Value |
| --------- | -------------- | --------- |
| `#333`    | `borderSubtle` | `#242528` |
| `#555`    | `borderStrong` | `#34363a` |

### Text

| Old Value         | New Token       | Web Value |
| ----------------- | --------------- | --------- |
| `#fff`, `#ffffff` | `textPrimary`   | `#f5f6f7` |
| `#999`, `#aaa`    | `textSecondary` | `#a1a5ab` |
| `#666`, `#888`    | `textTertiary`  | `#5d6269` |
| `#ccc`, `#ddd`    | `textSecondary` | `#a1a5ab` |

### Accent/Actions

| Old Value                                  | New Token | Web Value |
| ------------------------------------------ | --------- | --------- |
| `#E12D39`, `#ff3c00`, `#ff3b30`            | `accent`  | `#ff1f42` |
| `#FF6B6B`, `#ef4444`, `#d32f2f`, `#dc3545` | `danger`  | `#ff4d4d` |
| `#4caf50`, `#4ade80`                       | `success` | `#3ddc85` |
| `#ff9800`                                  | `warning` | `#ffb347` |
| `#2196f3`, `#007bff`                       | `info`    | `#3d8bff` |

---

## Estimated Effort

| Phase                  | Files   | Estimated Time |
| ---------------------- | ------- | -------------- |
| Phase 1: Define Tokens | 1       | 15 min         |
| Phase 2: App Screens   | ~36     | 2-3 hours      |
| Phase 3: Components    | ~46     | 3-4 hours      |
| Phase 4: Utils/Config  | 3       | 15 min         |
| Phase 5: Testing       | -       | 30 min         |
| **Total**              | **~86** | **~6-8 hours** |

---

## Execution Strategy

**Recommended approach**: Work in batches to minimize risk of breaking changes:

1. ✅ **Phase 1 first** - Establishes the foundation
2. 🔄 **Phase 3.1 (Feed)** - High-visibility social features
3. 🔄 **Phase 2.4 (Social screens)** - Complement feed work
4. 🔄 **Phase 3.2-3.3 (Profile/Modals)** - Core user flows
5. 🔄 **Phase 2.1-2.3 (Layouts/Auth)** - Foundation screens
6. 🔄 **Remaining phases** - Lower priority screens

We can tackle this incrementally over multiple sessions if needed.

---

## Notes

- Keep existing `grey0-9` and `redVivid0-9` scales for backward compatibility
- Some files may have multiple color references - update all in one pass
- Test after each phase to catch issues early
- Consider creating a `Colors` export alias for cleaner imports
