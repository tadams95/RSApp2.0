# Events UI Improvement Specification

> **Created:** January 14, 2026  
> **Status:** Ready for Implementation  
> **Priority:** High  
> **Estimated Effort:** 4-6 hours

## Overview

This specification addresses UI issues and design improvements for the Events screens, including the Events List (`events/index.tsx`) and Event Detail (`events/[id].tsx`) pages.

---

## Issues Identified

### 1. Image Overflow on Events List

**Severity:** High  
**File:** `src/app/(app)/events/index.tsx`  
**Location:** Lines 551-554 (`eventImage` style)

**Problem:**  
The event image has no `resizeMode` property, causing images to stretch and overflow their containers instead of maintaining proper aspect ratio.

**Current Code:**

```tsx
eventImage: {
  width: "100%",
  height: "100%",
  position: "absolute",
},
```

**Root Cause:**  
Missing `resizeMode: "cover"` property on the image style.

---

### 2. Inconsistent Image Loading Between List & Detail

**Severity:** Medium  
**Files:** Both `events/index.tsx` and `events/[id].tsx`

**Problem:**  
The Events List uses a standard `<Image>` component with direct URL, while Event Detail uses `useFirebaseImage` hook + `ProgressiveImage`. This causes:

- Different images appearing on list vs detail pages
- Inconsistent loading behavior
- The Firebase error for "harvest-rage" event

**List Page (Current):**

```tsx
<Image
  source={
    typeof item.imgURL === "string" && item.imgURL.trim() !== ""
      ? { uri: item.imgURL }
      : require("../../../assets/BlurHero_2.png")
  }
  style={styles.eventImage}
  ...
/>
```

**Detail Page (Current):**

```tsx
const { imageSource, ... } = useFirebaseImage(eventData?.imgURL || null, {...});

<ProgressiveImage
  source={imageSource}
  lowResSource={PROGRESSIVE_PLACEHOLDERS.EVENT}
  ...
/>
```

**Root Cause:**  
`useFirebaseImage` interprets non-HTTP URLs as Firebase Storage paths and fetches via `getDownloadURL()`, while the list page uses URLs directly.

---

### 3. Event Detail Page Needs Design Enhancement

**Severity:** Low (Aesthetic)  
**File:** `src/app/(app)/events/[id].tsx`

**Problem:**  
The Event Detail page has a basic design compared to the visually rich Events List page which features:

- Full-screen hero images
- Gradient overlays for text contrast
- Price tag badges
- Better visual hierarchy

---

## Implementation Plan

### Phase 1: Fix Image Overflow (Quick Win)

**Time:** 15 minutes

- [x] **1.1** Add `resizeMode: "cover"` to `eventImage` style in `events/index.tsx`

**File:** `src/app/(app)/events/index.tsx`  
**Location:** Lines 551-554

```tsx
eventImage: {
  width: "100%",
  height: "100%",
  position: "absolute",
  resizeMode: "cover", // ADD THIS
},
```

---

### Phase 2: Standardize Image Loading

**Time:** 1-2 hours

- [x] **2.1** Update Events List to use `ProgressiveImage` component for consistent image loading
- [x] **2.2** Both pages now use `ProgressiveImage` for unified image handling
- [x] **2.3** Fixed navigation pattern to match Shop (pass only ID, fetch fresh data)

**Root Cause Identified:**  
The Events pages were passing entire event objects as JSON.stringify params during navigation, while the Shop only passes the product handle and fetches fresh data on the detail page. The URL was getting corrupted through JSON serialization.

**Solution Implemented:**

1. **Created `useEvent(id)` hook** in `useEvents.ts` to fetch a single event by ID
   - First checks cached events list from React Query
   - Falls back to direct Firestore fetch if not in cache
2. **Simplified navigation** in both app and guest events list pages:

   ```tsx
   // Before: Passed entire serialized event object
   router.push({
     pathname: `/(app)/events/${eventId}`,
     params: {
       id: eventId,
       eventData: JSON.stringify({ ...event }), // URL corruption happened here
     },
   });

   // After: Just pass the ID (matches Shop pattern)
   router.push(`/(app)/events/${eventId}`);
   ```

3. **Updated detail pages** to fetch fresh data using the hook:

   ```tsx
   const {
     data: eventData,
     isLoading: eventLoading,
     error: eventError,
   } = useEvent(eventId);
   ```

4. **Direct URL usage** - Images now use the pristine URL from Firestore:
   ```tsx
   source={imageUrl ? { uri: imageUrl } : require("../../../assets/BlurHero_2.png")}
   ```

---

### Phase 3: Event Detail Design Buff

**Time:** 2-3 hours

#### 3.1 Enhance Hero Image Section

- [ ] Increase image container height
- [ ] Add gradient overlay for text contrast
- [ ] Add floating price tag badge

**File:** `src/app/(app)/events/[id].tsx`

**Current `imageContainer`:**

```tsx
imageContainer: {
  height: windowWidth * 1.1,
  position: "relative",
  backgroundColor: theme.colors.bgElev1,
},
```

**Updated `imageContainer`:**

```tsx
imageContainer: {
  height: windowWidth * 1.4, // Taller hero image
  position: "relative",
  backgroundColor: theme.colors.bgElev1,
},
```

#### 3.2 Add Gradient Overlay

Add after `imageContainer` in JSX:

```tsx
<LinearGradient
  colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.8)"]}
  style={styles.imageGradient}
/>
```

**New Style:**

```tsx
imageGradient: {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  height: "60%",
},
```

#### 3.3 Add Price Tag Badge

Add floating price badge like Events List:

```tsx
<View style={styles.priceTag}>
  <Text style={styles.priceTagText}>${eventData.price}</Text>
</View>
```

**New Styles:**

```tsx
priceTag: {
  position: "absolute",
  top: Platform.OS === "ios" ? 100 : 70,
  right: 16,
  backgroundColor: "rgba(0,0,0,0.6)",
  paddingVertical: 8,
  paddingHorizontal: 14,
  borderRadius: 20,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.3)",
  zIndex: 100,
},
priceTagText: {
  fontFamily,
  fontWeight: "700",
  color: theme.colors.textPrimary,
  fontSize: 18,
},
```

#### 3.4 Improve Event Info Section

- [ ] Add visual card styling to details section
- [ ] Add ticket availability indicator with color coding
- [ ] Add event description section (if available in data)

---

## File Changes Summary

| File                                   | Changes                                       |
| -------------------------------------- | --------------------------------------------- |
| `src/app/(app)/events/index.tsx`       | Add `resizeMode: "cover"` to image style      |
| `src/app/(app)/events/[id].tsx`        | Add gradient, price tag, increase hero height |
| `src/components/events/EventImage.tsx` | (Optional) Create shared component            |

---

## Testing Checklist

### Phase 1 Verification

- [ ] Events list images no longer overflow
- [ ] Images maintain aspect ratio on various screen sizes
- [ ] Fallback image displays correctly when URL is invalid

### Phase 2 Verification

- [ ] Same image appears on list and detail pages
- [ ] No Firebase errors in console for image loading
- [ ] Loading states work correctly
- [ ] Fallback images display when needed

### Phase 3 Verification

- [ ] Hero image is taller and more prominent
- [ ] Gradient overlay improves text readability
- [ ] Price tag is visible and properly positioned
- [ ] Design matches Events List aesthetic
- [ ] Works correctly in both light and dark themes

---

## Acceptance Criteria

- [ ] No image overflow on Events List page
- [ ] Consistent image display between List and Detail pages
- [ ] Event Detail page has enhanced visual design
- [ ] No regression in existing functionality
- [ ] All changes follow existing theme system patterns
- [ ] Analytics events still fire correctly

---

## Dependencies

- `expo-linear-gradient` (already installed)
- `ProgressiveImage` component (exists at `src/components/ui`)
- `useFirebaseImage` hook (exists at `src/hooks/useFirebaseImage.ts`)
- Theme system (`useTheme`, `useThemedStyles`)

---

## Related Files

- `src/app/(app)/events/index.tsx` - Events List screen
- `src/app/(app)/events/[id].tsx` - Event Detail screen
- `src/hooks/useFirebaseImage.ts` - Firebase image loading hook
- `src/components/ui/ProgressiveImage.tsx` - Progressive image component
- `src/constants/themes.ts` - Theme definitions

---

## Notes

1. **Firebase Storage vs Direct URLs:** Investigate whether `imgURL` values in Firestore are storage paths or full URLs. The `useFirebaseImage` hook handles both, but consistency in the database is important.

2. **Performance:** Using `useFirebaseImage` in a list with many items may impact performance. Consider implementing virtualization or lazy loading if issues arise.

3. **Theme Compliance:** All new styles should use `theme.colors` tokens, not hardcoded colors (except for gradients which need rgba values).
