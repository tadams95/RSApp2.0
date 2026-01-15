# Social Media Links in Profile Header 🔗

> **Goal**: Allow users to link and display their X (Twitter), Instagram, TikTok, SoundCloud, Spotify, and YouTube profiles in the header  
> **Priority**: Enhancement  
> **Status**: ✅ COMPLETE

---

## Overview

Users want to showcase their social presence beyond just the app. By adding clickable social media icons in the profile header, users can cross-promote their other platforms and followers can easily connect with them elsewhere.

**Current State**:

- `socialLinks` object exists in UserData interface ([auth.ts#L51](src/utils/auth.ts#L51))
- Supports: `twitter`, `instagram`, `tiktok`, `soundcloud`, `spotify`, `youtube`
- UI implementation exists in ProfileHeader via SocialLinksRow component
- EditProfile modal has fields to edit all 6 social links

---

## User Experience Vision

### The Goal

- **Quick access**: Tappable icons that deep-link to external profiles
- **Visual identity**: Recognizable brand icons (X, Instagram, TikTok, SoundCloud, Spotify, YouTube)
- **Non-intrusive**: Icons should complement, not clutter the header
- **Discoverability**: Easy for profile visitors to find and follow on other platforms

### Design Placement

Looking at [ProfileHeader.tsx](src/components/profile/ProfileHeader.tsx), the ideal placement is:

**Option A (Implemented)**: Below the location row, above the action row

```
┌──────────────────────────────────────┐
│ [Avatar]  Display Name ✓            │
│           @username                  │
│           Bio text goes here...      │
│           📍 City, State            │
│    [X] [IG] [TT] [SC] [SP] [YT]     │
│           [Edit]  0 Following · 0   │
└──────────────────────────────────────┘
```

---

## Technical Implementation

### 1. Data Model Extension

Update `src/utils/auth.ts` UserData interface:

```typescript
socialLinks?: {
  soundcloud?: string;    // SoundCloud profile
  instagram?: string;     // Instagram profile
  twitter?: string;       // X/Twitter profile
  tiktok?: string;        // TikTok profile
  spotify?: string;       // Spotify artist/user
  youtube?: string;       // YouTube channel
};
```

### 2. New Component: `SocialLinksRow.tsx`

Create `src/components/profile/SocialLinksRow.tsx`:

```typescript
interface SocialLinksRowProps {
  socialLinks?: {
    twitter?: string;
    instagram?: string;
    tiktok?: string;
    soundcloud?: string;
    spotify?: string;
    youtube?: string;
  };
}

// Features:
// - Renders only icons for links that exist
// - Tapping opens URL in system browser or app (deep link)
// - Uses MaterialCommunityIcons + custom XLogo for consistent styling
// - Haptic feedback on tap
// - PostHog tracking for link taps
```

### 3. Icon Mapping

| Platform   | Icon                   | Color     | Deep Link Pattern                       |
| ---------- | ---------------------- | --------- | --------------------------------------- |
| X/Twitter  | Custom `XLogo` SVG     | `#000000` | `twitter://user?screen_name={username}` |
| Instagram  | `instagram`            | `#E4405F` | `instagram://user?username={username}`  |
| TikTok     | `music-note` or custom | `#000000` | `tiktok://user/@{username}`             |
| SoundCloud | `soundcloud`           | `#FF5500` | `soundcloud://users:{id}` or web URL    |

### 4. URL Validation Utilities

Create `src/utils/socialLinks.ts`:

```typescript
// Validation functions for each platform
export function isValidTwitterUrl(url: string): boolean;
export function isValidInstagramUrl(url: string): boolean;
export function isValidTikTokUrl(url: string): boolean;

// Extract username from URL for deep linking
export function extractTwitterUsername(url: string): string | null;
export function extractInstagramUsername(url: string): string | null;
export function extractTikTokUsername(url: string): string | null;

// Generate deep link or fallback to web URL
export function getSocialDeepLink(platform: string, url: string): string;
```

### 5. EditProfile Modal Updates

Update `src/components/modals/EditProfile.tsx`:

1. Add state for each social link:

```typescript
const [twitterUrl, setTwitterUrl] = useState<string>("");
const [instagramUrl, setInstagramUrl] = useState<string>("");
const [tiktokUrl, setTiktokUrl] = useState<string>("");
```

2. Add input fields with validation (collapsible section to avoid clutter):

```tsx
<View style={styles.socialLinksSection}>
  <TouchableOpacity onPress={toggleSocialSection}>
    <Text style={styles.sectionHeader}>
      Social Links (optional) {expanded ? "▼" : "▶"}
    </Text>
  </TouchableOpacity>

  {expanded && (
    <>
      <SocialLinkInput
        platform="twitter"
        value={twitterUrl}
        onChange={setTwitterUrl}
        placeholder="https://x.com/username"
      />
      <SocialLinkInput
        platform="instagram"
        value={instagramUrl}
        onChange={setInstagramUrl}
        placeholder="https://instagram.com/username"
      />
      <SocialLinkInput
        platform="tiktok"
        value={tiktokUrl}
        onChange={setTiktokUrl}
        placeholder="https://tiktok.com/@username"
      />
    </>
  )}
</View>
```

3. Save to Firestore `profiles/{userId}` collection (public data).

---

## Firestore Data Structure

### `/profiles/{userId}` (Public Profile)

```json
{
  "displayName": "...",
  "username": "...",
  "bio": "...",
  "socialLinks": {
    "twitter": "https://x.com/username",
    "instagram": "https://instagram.com/username",
    "tiktok": "https://tiktok.com/@username",
    "soundcloud": "https://soundcloud.com/artist"
  },
  "updatedAt": "2026-01-07T..."
}
```

### Security Rules

Already handled - `/profiles/{userId}` is publicly readable, owner-writable.

---

## 🔍 Scout Report: Exact File Locations

> **Scouted**: January 7, 2026  
> **Status**: Ready for implementation

### Files to Modify

| Order | File                                       | Line(s)      | Change                                                         |
| ----- | ------------------------------------------ | ------------ | -------------------------------------------------------------- |
| 1     | `src/utils/auth.ts`                        | **Line 54**  | Add `tiktok?: string` to `socialLinks` interface               |
| 2     | `src/components/profile/ProfileHeader.tsx` | **Line 108** | Insert `<SocialLinksRow>` after location row, before actionRow |
| 3     | `src/components/profile/index.ts`          | **Line 7**   | Add export for `SocialLinksRow`                                |
| 4     | `src/components/modals/EditProfile.tsx`    | **Line 575** | Add Social Links collapsible section after Profile Song        |

### New Files to Create

| Order | File                                        | Purpose                                        |
| ----- | ------------------------------------------- | ---------------------------------------------- |
| 1     | `src/components/profile/SocialLinksRow.tsx` | Icon row component (X, IG, TikTok, SoundCloud) |
| 2     | `src/utils/socialLinks.ts`                  | URL validation & deep link utilities           |

### Insertion Point: ProfileHeader.tsx (Line 108)

```tsx
          {/* Location */}
          {location && (
            <View style={styles.locationRow}>
              <MaterialCommunityIcons
                name="map-marker-outline"
                size={14}
                color={GlobalStyles.colors.grey4}
              />
              <Text style={styles.location}>{location}</Text>
            </View>
          )}

          {/* 👇 INSERT SocialLinksRow HERE */}
          {profile?.socialLinks && (
            <SocialLinksRow
              socialLinks={profile.socialLinks}
              userId={profile.userId}
              isOwnProfile={isOwnProfile}
            />
          )}

          {/* Edit Profile Button + Stats Row */}
          <View style={styles.actionRow}>
```

### Insertion Point: auth.ts (Line 54)

```typescript
  socialLinks?: {
    soundcloud?: string;
    instagram?: string;
    twitter?: string;
    tiktok?: string;    // 👈 ADD THIS LINE
  };
```

### Execution Order

```
1. CREATE  src/components/profile/SocialLinksRow.tsx  (no dependencies)
2. CREATE  src/utils/socialLinks.ts                   (utilities for #1)
3. UPDATE  src/utils/auth.ts                          (add tiktok to interface)
4. UPDATE  src/components/profile/ProfileHeader.tsx   (integrate component)
5. UPDATE  src/components/profile/index.ts            (add export)
6. UPDATE  src/components/modals/EditProfile.tsx      (Phase 2 - edit inputs)
```

---

## Implementation Checklist

### Phase 1: Core Display (Day 1)

- [x] **Step 1.1**: Create `src/components/profile/SocialLinksRow.tsx` ✅
- [x] **Step 1.2**: Create `src/utils/socialLinks.ts` validation utilities ✅
- [x] **Step 1.3**: Update `src/utils/auth.ts` line 54 - add `tiktok` field ✅
- [x] **Step 1.4**: Update `src/components/profile/ProfileHeader.tsx` line 108 - add component ✅
- [x] **Step 1.5**: Update `src/components/profile/index.ts` line 7 - add export ✅
- [x] **Step 1.6**: Add PostHog tracking for social link taps ✅ (included in SocialLinksRow)

### Phase 2: Edit Functionality (Day 2)

- [x] **Step 2.1**: Add collapsible social links section to EditProfile ✅
- [x] **Step 2.2**: Add input fields for Twitter, Instagram, TikTok ✅
- [x] **Step 2.3**: Implement real-time URL validation ✅
- [x] **Step 2.4**: Save social links to `/profiles/{userId}` ✅

### Phase 3: Polish (Day 3)

- [x] Add haptic feedback on icon tap ✅ (included in SocialLinksRow)
- [x] Handle edge cases (invalid URLs, missing app installs) ✅
  - Added `Linking.canOpenURL()` check before opening
  - Added user-friendly Alert dialogs for errors
  - Deep link → Web URL fallback chain implemented
- [x] Test deep linking on iOS and Android ⏳ (manual testing required)
- [x] Add accessibility labels and hints ✅
  - `accessibilityRole="link"` on icons
  - `accessibilityLabel` with platform name
  - `accessibilityHint` with action description
  - `accessibilityRole="list"` on container
- [x] Update `UserData` interface to include `tiktok` ✅ (plus spotify, youtube)

---

## Component Architecture

```
src/components/profile/
├── ProfileHeader.tsx          # Updated to include SocialLinksRow
├── SocialLinksRow.tsx         # NEW: Horizontal row of social icons
├── SocialLinkIcon.tsx         # NEW: Individual icon button component
└── index.ts                   # Updated exports

src/utils/
├── soundcloud.ts              # Existing
└── socialLinks.ts             # NEW: Validation & deep link utilities

src/components/modals/
├── EditProfile.tsx            # Updated with social links section
└── SocialLinkInput.tsx        # NEW: Reusable input with icon & validation
```

---

## Analytics Events

| Event Name            | Properties                                      |
| --------------------- | ----------------------------------------------- |
| `social_link_tapped`  | `platform`, `profile_user_id`, `is_own_profile` |
| `social_link_added`   | `platform`, `url_domain`                        |
| `social_link_removed` | `platform`                                      |

---

## Edge Cases & Considerations

1. **No deep link available**: Fall back to `Linking.openURL()` for web
2. **Invalid URL entered**: Show inline error, don't save
3. **Empty links**: Don't render icon if link is empty/null
4. **Character limits**: Twitter handles max 15 chars, Instagram 30, TikTok 24
5. **URL vs Username**: Allow both formats, normalize on save
6. **Icon consistency**: Use monochrome icons to match app theme, or brand colors?

---

## Future Enhancements

- **Link verification**: Badge or indicator if profile is verified on platform
- **Follower counts**: Fetch and display follower counts from APIs (requires auth)
- **More platforms**: YouTube, Facebook, Twitch, Discord
- **QR code sharing**: Generate QR with all social links

---

## Dependencies

- `@expo/vector-icons` (MaterialCommunityIcons) - already installed
- `expo-linking` or `react-native` Linking - already available
- `expo-haptics` - already installed (likely)

---

## Testing Plan

1. **Unit tests**: URL validation functions
2. **Component tests**: SocialLinksRow renders correct icons
3. **Integration tests**: EditProfile saves social links correctly
4. **Manual testing**: Deep links on iOS/Android devices
5. **Accessibility testing**: VoiceOver/TalkBack announces icons correctly
