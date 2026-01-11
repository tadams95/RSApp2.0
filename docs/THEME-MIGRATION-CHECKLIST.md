# Theme Migration Checklist

> **Objective**: Migrate ~75 files from hardcoded dark-mode styling to token-based theming  
> **Reference**: `PHASE-4-PRODUCTION-READINESS.md` §4.3 and `social-ui-design-spec.md`  
> **Status**: Phase A ✅ Complete | Phase B ✅ Complete | Phase C ✅ Complete | Phase D-F In Progress

---

## Quick Reference: Color Token Mapping

| Hardcoded Value                 | Token                        | Usage                     |
| ------------------------------- | ---------------------------- | ------------------------- |
| `#000`, `#050505`               | `theme.colors.bgRoot`        | Root backgrounds          |
| `#0d0d0d`, `#111`               | `theme.colors.bgElev1`       | Cards, elevated surfaces  |
| `#16171a`, `#1a1a1c`, `#222`    | `theme.colors.bgElev2`       | Nested elements           |
| `#fff`, `#f5f6f7`               | `theme.colors.textPrimary`   | Primary text              |
| `#999`, `#a1a5ab`, `#888`       | `theme.colors.textSecondary` | Secondary text            |
| `#666`, `#5d6269`               | `theme.colors.textTertiary`  | Tertiary/placeholder text |
| `#333`, `#242528`               | `theme.colors.borderSubtle`  | Subtle borders            |
| `#444`, `#34363a`               | `theme.colors.borderStrong`  | Strong borders            |
| `#ff3c00`, `#FF0000`            | `theme.colors.accent`        | Brand accent              |
| `#ef4444`, `#ff6b6b`, `#e74c3c` | `theme.colors.danger`        | Error states              |
| `#2ecc71`, `#34C759`            | `theme.colors.success`       | Success states            |
| `#FF9500`, `#ffb347`            | `theme.colors.warning`       | Warning states            |

---

## Migration Pattern

```typescript
// BEFORE: Hardcoded styles
const styles = StyleSheet.create({
  container: { backgroundColor: "#000" },
  text: { color: "#fff" },
});

// AFTER: Themed styles
import { useThemedStyles } from "@/hooks/useThemedStyles";

const styles = useThemedStyles((theme) => ({
  container: { backgroundColor: theme.colors.bgRoot },
  text: { color: theme.colors.textPrimary },
}));
```

---

## ✅ Phase A: Foundation (COMPLETE)

- [x] `src/constants/themes.ts` — Light/dark token definitions
- [x] `src/contexts/ThemeContext.tsx` — ThemeProvider, useTheme hook
- [x] `src/hooks/useThemedStyles.ts` — StyleSheet factory hook
- [x] `src/app/_layout.tsx` — ThemeProvider wrapper, StatusBar theming
- [x] `src/app/(app)/account/appearance.tsx` — Theme settings screen
- [x] `src/components/modals/SettingsModal.tsx` — Appearance link added

---

## ✅ Phase B: Critical Screens (COMPLETE)

### Priority 1: Core Layout & Navigation

| Status | File                          | Tokens to Apply                                                                                                    |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [x]    | `src/app/(app)/_layout.tsx`   | **Tab Bar**: `bgElev1` background, `borderSubtle` top border, `accent` for active tab, `textTertiary` for inactive |
| [x]    | `src/app/(auth)/_layout.tsx`  | **Stack**: `bgRoot` background, header styling                                                                     |
| [x]    | `src/app/(guest)/_layout.tsx` | **Stack**: `bgRoot` background, header styling                                                                     |

### Priority 2: Authentication Screens

| Status | File                                            | Tokens to Apply                                                                                                           |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [x]    | `src/app/(auth)/login.tsx`                      | `bgRoot` container, `bgElev1` inputs, `textPrimary` labels, `textTertiary` placeholders, `accent` button, `danger` errors |
| [x]    | `src/app/(auth)/signup.tsx`                     | Same as login pattern                                                                                                     |
| [x]    | `src/app/(auth)/forgotPassword.tsx`             | Same as login pattern                                                                                                     |
| [x]    | `src/app/(auth)/complete-profile.tsx`           | `bgRoot` container, `bgElev1` form fields, `borderSubtle` dividers, `accent` save button                                  |
| [x]    | `src/components/auth/PasswordStrengthMeter.tsx` | `danger`/`warning`/`success` for strength levels, `bgElev2` track                                                         |

### Priority 3: Feed Components

| Status | File                                   | Tokens to Apply                                                                                                                  |
| ------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| [x]    | `src/components/feed/PostCard.tsx`     | `bgElev1` card, `borderSubtle` border, `shadows.card`, `radius.card` (14px), `textPrimary` author/body, `textTertiary` timestamp |
| [x]    | `src/components/feed/PostActions.tsx`  | `textSecondary` icons default, `reactionLike` for liked, `accent` for active states                                              |
| [x]    | `src/components/feed/PostComposer.tsx` | `bgElev1` composer, `bgElev2` input field, `borderSubtle` border, `radius.composer` (20px)                                       |
| [x]    | `src/components/feed/CommentInput.tsx` | `bgElev2` input, `borderSubtle` border, `textTertiary` placeholder                                                               |
| [x]    | `src/components/feed/CommentsList.tsx` | `bgElev1` container, `borderSubtle` separators                                                                                   |
| [x]    | `src/components/feed/MediaGrid.tsx`    | `bgElev2` placeholder, overlay with `rgba` based on theme                                                                        |
| [x]    | `src/app/(app)/home/index.tsx`         | `bgRoot` container, pull-to-refresh tint color                                                                                   |
| [x]    | `src/app/(app)/home/post/[postId].tsx` | `bgRoot` screen, themed post detail view                                                                                         |

---

## ✅ Phase C: Profile & Social (Priority 4, 6)

### Priority 4: Profile Components

| Status | File                                              | Tokens to Apply                                                                |
| ------ | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| [x]    | `src/components/profile/ProfileHeader.tsx`        | `bgElev1` header card, `textPrimary` name, `textSecondary` username/bio        |
| [x]    | `src/components/profile/ProfileStats.tsx`         | `textPrimary` numbers, `textTertiary` labels                                   |
| [x]    | `src/components/profile/FollowButton.tsx`         | `accent` filled when not following, `bgElev2` + `accent` border when following |
| [x]    | `src/components/profile/UserCard.tsx`             | `bgElev1` card, `borderSubtle` border                                          |
| [x]    | `src/components/profile/UserProfileView.tsx`      | Full theme migration — coordinate with ProfileHeader                           |
| [x]    | `src/components/profile/ProfileSongCard.tsx`      | `bgElev1` card, `textPrimary` song title, `textSecondary` artist               |
| [x]    | `src/components/profile/SocialLinksRow.tsx`       | `textSecondary` icons, preserve platform brand colors                          |
| [x]    | `src/components/profile/SoundCloudMiniPlayer.tsx` | Deprecated (returns null) - no changes needed                                  |
| [x]    | `src/components/profile/PlatformBadge.tsx`        | Preserves platform brand colors - no theme changes needed                      |
| [x]    | `src/app/(app)/profile/[userId].tsx`              | Wrapper only - uses UserProfileView which is themed                            |

### Priority 6: Notifications

| Status | File                                                  | Tokens to Apply                                                                             |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [x]    | `src/app/(app)/notifications/index.tsx`               | `bgRoot` container, themed list                                                             |
| [x]    | `src/app/(app)/account/notifications.tsx`             | `bgRoot` screen, `bgElev1` setting rows, `borderSubtle` dividers                            |
| [x]    | `src/components/notifications/NotificationCard.tsx`   | `bgElev1` card, keep semantic type colors (like=#FF4757, comment=#3498db, follow=`success`) |
| [x]    | `src/components/notifications/EmptyNotifications.tsx` | `textSecondary` message, `textTertiary` icon                                                |

---

## 🔲 Phase D: Commerce & Transfer (Priority 5, 7, 8)

### Priority 5: Events Components

| Status | File                                        | Tokens to Apply                                                  |
| ------ | ------------------------------------------- | ---------------------------------------------------------------- |
| [ ]    | `src/app/(app)/events/index.tsx`            | `bgRoot` container, event card theming                           |
| [ ]    | `src/app/(app)/events/[id].tsx`             | `bgRoot` screen, `bgElev1` detail sections, `accent` CTA buttons |
| [ ]    | `src/app/(app)/events/my-events.tsx`        | `bgRoot` list, `bgElev1` list items                              |
| [ ]    | `src/app/(app)/events/paginated-events.tsx` | `bgRoot` container, loading indicator `accent`                   |
| [ ]    | `src/components/events/EventNotFound.tsx`   | `textSecondary` message, `danger` icon                           |

### Priority 7: Shop Components

| Status | File                                    | Tokens to Apply                                                                |
| ------ | --------------------------------------- | ------------------------------------------------------------------------------ |
| [x]    | `src/app/(app)/shop/index.tsx`          | `bgRoot` grid, `bgElev1` product cards                                         |
| [x]    | `src/app/(app)/shop/[handle].tsx`       | `bgRoot` collection page                                                       |
| [x]    | `src/app/(app)/shop/ProductDetail.tsx`  | `bgRoot` screen, `bgElev1` info card, `accent` add-to-cart                     |
| [x]    | `src/app/(app)/shop/ProductWrapper.tsx` | Pass theme to child components                                                 |
| [x]    | `src/app/(app)/shop/paginated-shop.tsx` | `bgRoot` container, loading states                                             |
| [x]    | `src/app/(app)/cart/` (all files)       | `bgRoot` screen, `bgElev1` cart items, `accent` checkout                       |
| [x]    | `src/components/shopify/*.tsx`          | Error boundaries with `danger` styling (kept light theme for error visibility) |

### Priority 8: Transfer Components

| Status | File                                               | Tokens to Apply                                               |
| ------ | -------------------------------------------------- | ------------------------------------------------------------- |
| [x]    | `src/app/(app)/transfer/_layout.tsx`               | `bgRoot` header, `textPrimary` header text                    |
| [x]    | `src/app/(app)/transfer/claim.tsx`                 | `bgRoot` screen, `bgElev1` claim card, `success` confirmation |
| [x]    | `src/app/(app)/transfer/pending.tsx`               | `bgRoot` list, `warning` pending status                       |
| [ ]    | `src/components/transfer/EmailTransferForm.tsx`    | `bgElev1` form, `bgElev2` inputs, `borderSubtle` borders      |
| [ ]    | `src/components/transfer/UsernameTransferForm.tsx` | Same as EmailTransferForm                                     |
| [ ]    | `src/components/transfer/PendingTransferCard.tsx`  | `bgElev1` card, `warning` pending badge                       |
| [ ]    | `src/components/transfer/RecipientPreview.tsx`     | `bgElev2` preview box, `textSecondary` labels                 |
| [ ]    | `src/components/transfer/TransferMethodPicker.tsx` | `bgElev1` picker, `accent` selected option                    |

---

## ✅ Phase E: Supporting Components (Priority 9-13)

### Priority 9: Account & Settings

| Status | File                                    | Tokens to Apply                                                   |
| ------ | --------------------------------------- | ----------------------------------------------------------------- |
| [x]    | `src/app/(app)/account/index.tsx`       | `bgRoot` screen, `bgElev1` menu sections                          |
| [x]    | `src/components/ui/SettingsSection.tsx` | `bgElev1` section, `borderSubtle` borders, `textTertiary` headers |
| [x]    | `src/components/ui/SettingsToggle.tsx`  | `bgElev2` track, `accent` when on, `textPrimary` label            |

### Priority 10: Modal Components ✅ COMPLETE

| Status | File                                       | Tokens to Apply                                                              |
| ------ | ------------------------------------------ | ---------------------------------------------------------------------------- |
| [x]    | `src/components/modals/EditProfile.tsx`    | `bgElev1` modal, `radius.composer` (20px), `shadows.modal`, `bgElev2` inputs |
| [x]    | `src/components/modals/SettingsModal.tsx`  | `bgElev1` modal, `borderSubtle` dividers, `textPrimary` options              |
| [x]    | `src/components/modals/QRModal.tsx`        | `bgElev1` modal, white QR background preserved                               |
| [x]    | `src/components/modals/HistoryModal.tsx`   | `bgElev1` modal, `bgElev2` list items                                        |
| [x]    | `src/components/modals/AdminModal.tsx`     | `bgElev1` modal, `danger` destructive actions                                |
| [x]    | `src/components/modals/EventAdminView.tsx` | `bgElev1` container, admin action buttons                                    |
| [x]    | `src/components/modals/MyEvents.tsx`       | `bgElev1` modal, event list theming                                          |

### Priority 11: Shared UI Components ✅ COMPLETE

| Status | File                                            | Tokens to Apply                                                    |
| ------ | ----------------------------------------------- | ------------------------------------------------------------------ |
| [x]    | `src/components/ui/ContentContainer.tsx`        | `bgRoot` or `bgElev1` based on context                             |
| [x]    | `src/components/ui/ScreenWrapper.tsx`           | `bgRoot` wrapper, SafeArea theming                                 |
| [x]    | `src/components/ui/ProfileFormInput.tsx`        | `bgElev2` input, `borderSubtle` border, `textTertiary` placeholder |
| [x]    | `src/components/ui/NetworkStatusBanner.tsx`     | `warning` background for offline, `success` for reconnected        |
| [x]    | `src/components/ui/PaginatedList.tsx`           | Loading indicator `accent`, empty state `textSecondary`            |
| [x]    | `src/components/ui/LazyImage.tsx`               | `bgElev1` placeholder                                              |
| [x]    | `src/components/ui/ProgressiveImage.tsx`        | `bgElev2` loading state                                            |
| [x]    | `src/components/ui/ImageWithFallback.tsx`       | `bgElev2` fallback background                                      |
| [x]    | `src/components/ui/AppCarousel.tsx`             | `bgElev1` container, pagination dots `accent`/`textTertiary`       |
| [x]    | `src/components/ui/CompressedImageUploader.tsx` | `bgElev2` upload area, `borderSubtle` dashed border                |

### Priority 12: Error & Status Components ✅

| Status | File                                                  | Tokens to Apply                                                  |
| ------ | ----------------------------------------------------- | ---------------------------------------------------------------- |
| [x]    | `src/components/ErrorBoundary.tsx`                    | `bgRoot` screen, `danger` icon, `textPrimary` message            |
| [x]    | `src/components/ErrorUI.tsx`                          | `bgElev1` error card, `danger` accent                            |
| [x]    | `src/components/LoadingOverlay.tsx`                   | Semi-transparent `bgRoot`, `accent` spinner                      |
| [x]    | `src/components/LoginErrorNotice.tsx`                 | `danger` background/border, `textPrimary` on danger              |
| [x]    | `src/components/SignupErrorNotice.tsx`                | Same as LoginErrorNotice                                         |
| [x]    | `src/components/PasswordResetErrorNotice.tsx`         | Same as LoginErrorNotice                                         |
| [x]    | `src/components/ProfileUpdateErrorNotice.tsx`         | `danger` styling                                                 |
| [x]    | `src/components/RealtimeDatabaseConnectionStatus.tsx` | `success` connected, `warning` connecting, `danger` disconnected |

### Priority 13: Debug Components (Optional) ✅

| Status | File                                             | Tokens to Apply                        |
| ------ | ------------------------------------------------ | -------------------------------------- |
| [x]    | `src/components/debug/ImageCacheMonitor.tsx`     | `bgElev1` panel, `textSecondary` stats |
| [x]    | `src/components/debug/NotificationTestPanel.tsx` | `bgElev1` panel, `accent` test buttons |

---

## 🔲 Phase F: QA & Polish

- [ ] Test all screens in **Dark Mode**
- [ ] Test all screens in **Light Mode**
- [ ] Test **System** preference switching
- [ ] Verify StatusBar adapts (light-content vs dark-content)
- [ ] Check navigation bar tint colors
- [ ] Verify shadows render correctly in both modes
- [ ] Confirm WCAG AA contrast compliance
- [ ] Fix any visual regressions

---

## Progress Summary

| Phase                  | Files  | Completed | Remaining |
| ---------------------- | ------ | --------- | --------- |
| A: Foundation          | 6      | 6         | 0         |
| B: Critical            | 16     | 0         | 16        |
| C: Profile & Social    | 14     | 0         | 14        |
| D: Commerce & Transfer | 18     | 0         | 18        |
| E: Supporting          | 24     | 0         | 24        |
| F: QA & Polish         | 8      | 0         | 8         |
| **TOTAL**              | **86** | **6**     | **80**    |

---

## Notes

- **Preserve brand colors**: Platform badges (Spotify green, SoundCloud orange, etc.)
- **Preserve semantic colors**: Notification types keep their assigned colors
- **Modal spec**: 20px radius, `shadows.modal`, subtle border in dark mode
- **Card spec**: 14px radius, `shadows.card`, 1px `borderSubtle`
- **Input spec**: `bgElev2` background, `borderSubtle` border, `textTertiary` placeholder
