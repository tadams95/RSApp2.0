# Multi-Platform Music Links 🎵

> **Goal**: Expand profile song support beyond SoundCloud to include Spotify, YouTube, Apple Music, and more  
> **Priority**: Enhancement  
> **Estimated Effort**: 4-6 days

---

## Overview

While SoundCloud is great for independent artists and DJ mixes, many users prefer Spotify for its vast catalog or YouTube for music videos and live performances. This feature expands the profile song functionality to support multiple music platforms.

**Current State**:

- `profileSongUrl` field exists and stores a single SoundCloud URL
- [SoundCloudPlayerContext.tsx](src/hooks/SoundCloudPlayerContext.tsx) handles playback via WebView widget
- [ProfileSongCard.tsx](src/components/profile/ProfileSongCard.tsx) displays track info and controls
- [useSoundCloudTrack.ts](src/hooks/useSoundCloudTrack.ts) fetches track metadata via oEmbed
- [soundcloud.ts](src/utils/soundcloud.ts) handles URL validation and parsing

---

## User Experience Vision

### The Goal

- **User choice**: Let users feature music from their preferred platform
- **Seamless playback**: In-app preview where possible, graceful handoff where not
- **Visual consistency**: Unified card design regardless of platform
- **Discovery**: Help users discover new music through profile browsing

### Platform Support Tiers

| Tier | Platform    | In-App Playback    | Metadata  | Priority     |
| ---- | ----------- | ------------------ | --------- | ------------ |
| 1    | SoundCloud  | ✅ Full (existing) | ✅ oEmbed | Already done |
| 1    | Spotify     | ⚠️ 30s preview     | ✅ oEmbed | High         |
| 1    | YouTube     | ⚠️ Limited         | ✅ oEmbed | High         |
| 2    | Apple Music | ⚠️ 30s preview     | ✅ API    | Medium       |
| 3    | Bandcamp    | ❌ Link only       | ✅ oEmbed | Low          |
| 3    | Tidal       | ❌ Link only       | ✅ API    | Low          |

---

## Technical Research

### Spotify Integration

**oEmbed API** (No auth required):

```
GET https://open.spotify.com/oembed?url={spotify_url}
```

Response:

```json
{
  "type": "rich",
  "title": "Track Name",
  "thumbnail_url": "https://i.scdn.co/image/...",
  "html": "<iframe src='https://open.spotify.com/embed/track/...'>"
}
```

**Embed Player**:

- 30-second preview clips (no auth)
- Full playback requires Spotify Premium + SDK
- Embed iframe works in WebView

**URL Patterns**:

- `https://open.spotify.com/track/{id}`
- `https://open.spotify.com/album/{id}`
- `https://spotify.link/{shortcode}`

### YouTube Integration

**oEmbed API** (No auth required):

```
GET https://www.youtube.com/oembed?url={youtube_url}&format=json
```

Response:

```json
{
  "title": "Video Title",
  "author_name": "Channel Name",
  "thumbnail_url": "https://i.ytimg.com/vi/{id}/hqdefault.jpg"
}
```

**Embed Player**:

- Full playback available (with ads for non-Premium)
- Works in WebView with youtube-nocookie.com embed
- Background playback limited on mobile

**URL Patterns**:

- `https://youtube.com/watch?v={id}`
- `https://youtu.be/{id}`
- `https://youtube.com/shorts/{id}`
- `https://music.youtube.com/watch?v={id}`

### Apple Music Integration

**MusicKit JS** or **Apple Music API**:

- Requires developer token (API key)
- 30-second previews available
- Full playback requires Apple Music subscription

**URL Patterns**:

- `https://music.apple.com/{country}/album/{name}/{id}?i={trackId}`
- `https://music.apple.com/{country}/song/{name}/{id}`

---

## Technical Implementation

### 1. Data Model Changes

Update `src/utils/auth.ts`:

```typescript
interface UserData {
  // ... existing fields ...

  // OPTION A: Single URL with auto-detection
  profileSongUrl?: string; // Any supported platform URL

  // OPTION B: Explicit platform selection (recommended)
  profileMusic?: {
    platform: "soundcloud" | "spotify" | "youtube" | "apple_music";
    url: string;
    // Cached metadata (avoid repeated API calls)
    title?: string;
    artist?: string;
    artworkUrl?: string;
    cachedAt?: string;
  };
}
```

**Recommendation**: Use Option B for better UX and data integrity.

### 2. Platform Detection Utility

Create `src/utils/musicPlatforms.ts`:

```typescript
export type MusicPlatform =
  | "soundcloud"
  | "spotify"
  | "youtube"
  | "apple_music"
  | "unknown";

export interface PlatformConfig {
  name: string;
  icon: string;
  color: string;
  oEmbedUrl: string | null;
  urlPatterns: RegExp[];
  supportsInAppPlayback: boolean;
  supportsPreview: boolean;
}

export const PLATFORM_CONFIGS: Record<MusicPlatform, PlatformConfig> = {
  soundcloud: {
    name: "SoundCloud",
    icon: "soundcloud",
    color: "#FF5500",
    oEmbedUrl: "https://soundcloud.com/oembed",
    urlPatterns: [/soundcloud\.com/, /on\.soundcloud\.com/],
    supportsInAppPlayback: true,
    supportsPreview: true,
  },
  spotify: {
    name: "Spotify",
    icon: "spotify",
    color: "#1DB954",
    oEmbedUrl: "https://open.spotify.com/oembed",
    urlPatterns: [/open\.spotify\.com/, /spotify\.link/],
    supportsInAppPlayback: false, // 30s preview only
    supportsPreview: true,
  },
  youtube: {
    name: "YouTube",
    icon: "youtube",
    color: "#FF0000",
    oEmbedUrl: "https://www.youtube.com/oembed",
    urlPatterns: [/youtube\.com/, /youtu\.be/, /music\.youtube\.com/],
    supportsInAppPlayback: true, // WebView embed
    supportsPreview: true,
  },
  apple_music: {
    name: "Apple Music",
    icon: "apple",
    color: "#FC3C44",
    oEmbedUrl: null, // Requires API
    urlPatterns: [/music\.apple\.com/],
    supportsInAppPlayback: false,
    supportsPreview: true, // 30s with MusicKit
  },
  unknown: {
    name: "Music",
    icon: "music",
    color: "#888888",
    oEmbedUrl: null,
    urlPatterns: [],
    supportsInAppPlayback: false,
    supportsPreview: false,
  },
};

export function detectPlatform(url: string): MusicPlatform {
  // Returns detected platform or 'unknown'
}

export function isValidMusicUrl(url: string): boolean {
  return detectPlatform(url) !== "unknown";
}
```

### 3. Unified Track Hook

Create `src/hooks/useMusicTrack.ts`:

```typescript
interface MusicTrackInfo {
  title: string;
  artist: string;
  artworkUrl: string | null;
  duration?: number;
  platform: MusicPlatform;
  embedUrl?: string;
  originalUrl: string;
}

interface UseMusicTrackResult {
  trackInfo: MusicTrackInfo | null;
  isLoading: boolean;
  error: string | null;
  platform: MusicPlatform;
}

export function useMusicTrack(url: string | null): UseMusicTrackResult {
  // 1. Detect platform from URL
  // 2. Fetch metadata using appropriate oEmbed/API
  // 3. Return normalized track info
}
```

### 4. Universal Music Player Context

Extend or replace `SoundCloudPlayerContext.tsx`:

```typescript
// src/hooks/MusicPlayerContext.tsx

export type PlayerState = "idle" | "loading" | "playing" | "paused" | "error";

interface MusicPlayerContextType {
  // Current state
  currentTrack: MusicTrackInfo | null;
  playerState: PlayerState;
  progress: PlayerProgress;

  // Actions
  play: (url: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seekTo: (percentage: number) => void;

  // Platform-specific
  openInApp: (url: string) => void; // Deep link to native app
}
```

### 5. Updated ProfileSongCard

Modify `src/components/profile/ProfileSongCard.tsx`:

```typescript
// Changes needed:
// 1. Use useMusicTrack instead of useSoundCloudTrack
// 2. Display platform icon/badge
// 3. Handle different playback modes per platform
// 4. "Open in {Platform}" button for non-embeddable content

interface ProfileSongCardProps {
  songUrl: string | null | undefined;
  // NEW: optional cached data to avoid re-fetching
  cachedTrackInfo?: {
    title: string;
    artist: string;
    artworkUrl: string;
    platform: MusicPlatform;
  };
}
```

### 6. EditProfile Music Section

Update music input to support multiple platforms:

```tsx
// In EditProfile.tsx

<View style={styles.profileMusicSection}>
  <Text style={styles.sectionHeader}>Profile Music</Text>

  {/* Platform selector (optional - can auto-detect) */}
  <View style={styles.platformSelector}>
    <PlatformButton
      platform="soundcloud"
      selected={platform === "soundcloud"}
    />
    <PlatformButton platform="spotify" selected={platform === "spotify"} />
    <PlatformButton platform="youtube" selected={platform === "youtube"} />
    <PlatformButton
      platform="apple_music"
      selected={platform === "apple_music"}
    />
  </View>

  {/* URL input with platform auto-detection */}
  <TextInput
    placeholder="Paste any music link (SoundCloud, Spotify, YouTube...)"
    value={musicUrl}
    onChangeText={handleMusicUrlChange}
  />

  {/* Preview card */}
  {trackPreview && <MiniTrackPreview track={trackPreview} />}
</View>
```

---

## Architecture Overview

```
src/
├── hooks/
│   ├── SoundCloudPlayerContext.tsx  # Keep for backward compat
│   ├── MusicPlayerContext.tsx       # NEW: Universal player
│   ├── useSoundCloudTrack.ts        # Existing
│   └── useMusicTrack.ts             # NEW: Universal track hook
│
├── utils/
│   ├── soundcloud.ts                # Existing
│   ├── musicPlatforms.ts            # NEW: Platform detection & config
│   ├── spotify.ts                   # NEW: Spotify oEmbed helpers
│   └── youtube.ts                   # NEW: YouTube oEmbed helpers
│
├── components/profile/
│   ├── ProfileSongCard.tsx          # Update for multi-platform
│   ├── PlatformBadge.tsx            # NEW: Platform indicator icon
│   └── MiniTrackPreview.tsx         # NEW: Compact preview for edit
│
└── components/modals/
    └── EditProfile.tsx              # Update music section
```

---

## Implementation Phases

### Phase 1: Platform Detection & Metadata (Days 1-2)

- [x] Create `musicPlatforms.ts` with platform configs ✅
- [x] Implement `detectMusicPlatform()` function ✅
- [x] Create `useMusicTrack` hook with oEmbed support ✅
- [x] Add Spotify oEmbed fetching ✅
- [x] Add YouTube oEmbed fetching ✅
- [x] Update EditProfile to accept any music URL ✅

### Phase 2: Display Updates (Days 2-3)

- [x] Create `PlatformBadge.tsx` component ✅
- [x] Update `ProfileSongCard.tsx` for multi-platform ✅
- [x] Add "Open in {Platform}" button ✅
- [x] Handle non-playable platforms gracefully ✅
- [x] Add loading/error states per platform ✅

### Phase 3: Playback Support (Days 3-4)

- [x] Create `MusicPlayerContext.tsx` (or extend existing) ✅
- [x] Implement Spotify embed WebView (30s preview) ✅
- [x] Implement YouTube embed WebView ✅
- [x] Handle background audio considerations ✅
- [x] Add platform-specific play controls ✅

### Phase 4: Polish & Edge Cases (Days 5-6)

- [x] Deep linking to native apps (Spotify, YouTube) ✅
- [x] Cache metadata in Firestore for faster loads ✅
- [x] Handle expired/deleted tracks gracefully ✅
- [x] Add PostHog analytics for platform usage ✅
- [x] Test on iOS and Android ✅
- [x] Update profile migration if needed ✅

---

## Firestore Data Updates

### `/profiles/{userId}`

```json
{
  "profileSongUrl": "https://open.spotify.com/track/...",
  "profileMusic": {
    "platform": "spotify",
    "url": "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    "title": "Never Gonna Give You Up",
    "artist": "Rick Astley",
    "artworkUrl": "https://i.scdn.co/image/...",
    "cachedAt": "2026-01-07T12:00:00Z"
  }
}
```

**Migration Note**: Keep `profileSongUrl` for backward compatibility. New field `profileMusic` is preferred.

---

## Analytics Events

| Event Name              | Properties                                              |
| ----------------------- | ------------------------------------------------------- |
| `profile_music_played`  | `platform`, `track_title`, `track_artist`, `is_preview` |
| `profile_music_paused`  | `platform`, `progress_percentage`                       |
| `profile_music_opened`  | `platform`, `destination` (app/web)                     |
| `profile_music_set`     | `platform`, `previous_platform`                         |
| `profile_music_removed` | `platform`                                              |

---

## Platform-Specific Notes

### Spotify

- **Preview limitation**: Only 30s clips without Premium auth
- **Deep link**: `spotify:track:{id}` opens Spotify app
- **Web fallback**: `https://open.spotify.com/track/{id}`
- **Album art**: Always available via oEmbed

### YouTube

- **Full playback**: Available but with ads
- **Shorts support**: YouTube Shorts URLs should work
- **YouTube Music**: `music.youtube.com` URLs supported
- **Deep link**: `vnd.youtube:{id}` or `youtube://watch?v={id}`
- **Background play**: Limited on mobile without Premium

### Apple Music

- **Preview**: 30s with MusicKit JS
- **API key**: Required for metadata without oEmbed
- **Deep link**: `music://` scheme
- **Consideration**: May skip for v1, add in future

---

## Edge Cases

1. **Region-locked content**: Some tracks unavailable in certain regions
2. **Age-restricted YouTube**: Won't embed without login
3. **Private/unlisted content**: May fail oEmbed
4. **URL format variations**: Handle all common formats
5. **Track removed**: Show graceful "unavailable" state
6. **Slow network**: Show skeleton loading state
7. **Mixed content**: User switches platforms - clear old player state

---

## Future Enhancements

- **Multiple songs**: Allow playlist or multiple featured tracks
- **Music taste matching**: "You both like..." on profiles
- **Listening activity**: Real-time "Now Playing" from Spotify
- **Shareable links**: Generate RS App links that include music preview
- **Artist verification**: Special badge for verified musicians

---

## Dependencies

**Existing**:

- `react-native-webview` - for embed players
- `expo-linking` - for deep links
- `@tanstack/react-query` - for data fetching

**No new dependencies required** - oEmbed APIs are free and don't need SDKs.

---

## Testing Plan

1. **Unit tests**: Platform detection, URL validation
2. **Hook tests**: useMusicTrack returns correct data per platform
3. **Integration tests**: EditProfile saves music correctly
4. **E2E tests**: Full flow from edit → save → display → play
5. **Device testing**: Test deep links on iOS/Android
6. **Accessibility**: Screen reader announces track info
