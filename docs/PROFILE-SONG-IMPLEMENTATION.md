# Profile Song Feature - MySpace Vibes 🎵

> **Goal**: Bring back the nostalgic MySpace experience where users can showcase their musical identity through a profile song  
> **Priority**: Enhancement  
> **Estimated Effort**: 3-5 days

---

## Overview

Allow users to display their SoundCloud profile song directly on their profile with an inline mini player. Users can discover each other's music taste without leaving the app.

**Current State**:

- `profileSongUrl` field already exists in `/profiles/{userId}` collection
- Example: `"https://soundcloud.com/ukf/borne-want-to-go?..."`
- Web app already supports setting this field

---

## User Experience Vision

### The MySpace Nostalgia

- Profile song is a **statement of identity** — "this is my vibe"
- Viewing someone's profile and hearing their song creates **connection**
- Discovery element: "oh, they like this artist too!"

### Mobile-First Considerations

- No auto-play (respects user's audio environment)
- Tap to play with clear visual affordance
- Minimal battery/data impact when not playing
- Background audio support (plays while browsing app)

---

## Technical Research Required

### 1. SoundCloud API Options

| Approach                      | Pros                               | Cons                                   |
| ----------------------------- | ---------------------------------- | -------------------------------------- |
| **oEmbed API**                | Free, no auth, returns metadata    | Limited info, no direct stream URL     |
| **Widget API**                | Official player, handles licensing | Web-based, may need WebView            |
| **SoundCloud SDK**            | Full access, stream URLs           | Requires API registration, rate limits |
| **react-native-track-player** | Native audio, background play      | Need stream URL (SDK required)         |

**Recommendation**: Start with oEmbed for metadata + WebView mini-widget for playback. This avoids API registration complexity and handles licensing properly.

### 2. URL Parsing

SoundCloud URLs come in various formats:

```
https://soundcloud.com/artist/track
https://soundcloud.com/artist/track?si=xxx
https://soundcloud.com/artist/sets/playlist
https://on.soundcloud.com/xxxxx (short links)
```

We need to normalize these to extract track info.

---

## UI/UX Design

### Layout: Profile Header Redesign

```
┌─────────────────────────────────────────────────────┐
│  ┌──────────┐   ┌─────────────────────────────────┐ │
│  │          │   │  ♫ Profile Song                 │ │
│  │  Avatar  │   │  ┌─────┐                        │ │
│  │  (pfp)   │   │  │ Art │  Track Title           │ │
│  │          │   │  │     │  Artist Name           │ │
│  └──────────┘   │  └─────┘  ▶ ━━━━━━━━━━━━ 3:24   │ │
│                 └─────────────────────────────────┘ │
│                                                     │
│  Display Name ✓                                     │
│  @username                                          │
│  Bio text here...                                   │
└─────────────────────────────────────────────────────┘
```

### Profile Song Card Component

**States**:

1. **Idle** — Show artwork, title, artist, play button
2. **Loading** — Subtle loading indicator on play button
3. **Playing** — Animated equalizer icon, pause button, progress bar
4. **Error** — Graceful fallback (link to SoundCloud)

**Visual Elements**:

- Square album artwork (48x48 or 56x56)
- Track title (1 line, ellipsis overflow)
- Artist name (1 line, muted color)
- Play/Pause button (circular, RAGESTATE red accent)
- Progress bar (thin, subtle)
- Duration display

### Interaction Flow

```
User views profile
    │
    ▼
Profile song card visible (idle state)
    │
    ├── User taps play button
    │       │
    │       ▼
    │   Loading state (fetch/buffer)
    │       │
    │       ▼
    │   Playing state (audio plays)
    │       │
    │       ├── User taps pause → Idle state
    │       ├── Song ends → Idle state
    │       ├── User navigates away → Audio continues (background)
    │       └── User taps card → Opens SoundCloud (optional)
    │
    └── User long-presses card
            │
            ▼
        Context menu: "Open in SoundCloud"
```

---

## Implementation Checklist

### Phase 1: Research & Setup

- [x] Test SoundCloud oEmbed API with sample URLs
- [x] Determine if WebView widget or native audio is better approach (Hidden WebView + Custom UI)
- [x] Install required dependencies:
  - [x] `react-native-webview` installed via `npx expo install`
- [x] Create utility to parse/validate SoundCloud URLs (`src/utils/soundcloud.ts`)

### Phase 2: Data Layer

- [x] Add `profileSongUrl` to UserData interface (`src/utils/auth.ts`)
- [x] Update profile fetching to include song URL (already works - spreads all profile data)
- [x] Create `useSoundCloudTrack` hook (`src/hooks/useSoundCloudTrack.ts`):
  - [x] Fetch track metadata from oEmbed API
  - [x] Cache results to avoid repeated API calls (via `soundcloud.ts` cache)
  - [x] Handle loading/error states

### Phase 3: UI Components

- [x] Create `ProfileSongCard` component
  - [x] Idle state with artwork, title, artist
  - [x] Loading state
  - [x] Playing state with progress
  - [x] Error/fallback state
- [x] Create `SoundCloudMiniPlayer` (internal player logic)
- [x] Update `ProfileHeader.tsx` layout for two-column design
- [x] Ensure responsive design for various screen sizes

### Phase 4: Audio Playback

- [x] Implement hidden WebView with SoundCloud widget
- [x] JavaScript bridge for play/pause/seek commands
- [x] Listen for widget events (progress, state changes, errors)
- [x] Create global audio context/provider (single source of truth)
- [x] Handle "switch song" logic (stop current, play new)
- [x] Background audio support (iOS/Android WebView config)
- [x] Handle app state changes (continue playing in background)

### Phase 5: Polish & Edge Cases

- [ ] Smooth animations (play/pause transitions)
- [ ] Handle invalid/broken SoundCloud URLs gracefully
- [ ] Handle private tracks (show "Private Track" state)
- [ ] Handle deleted tracks
- [ ] Test with various URL formats
- [ ] Accessibility: VoiceOver/TalkBack labels
- [ ] Analytics: track song plays

### Phase 6: Edit Capability

- [ ] Add "Profile Song" section to EditProfile modal
- [ ] SoundCloud URL input field with validation
- [ ] Preview player before confirming (fetch metadata, show card)
- [ ] Clear/remove song option
- [ ] Save to `/profiles/{userId}.profileSongUrl`

---

## Technical Specifications

### SoundCloud oEmbed API

**Endpoint**: `https://soundcloud.com/oembed`

**Request**:

```
GET https://soundcloud.com/oembed?url={trackUrl}&format=json
```

**Response**:

```json
{
  "title": "Want To Go",
  "author_name": "UKF",
  "author_url": "https://soundcloud.com/ukf",
  "thumbnail_url": "https://i1.sndcdn.com/artworks-xxx-large.jpg",
  "html": "<iframe ...></iframe>",
  "duration": 204000,
  ...
}
```

### Dependencies to Evaluate

```json
{
  "react-native-webview": "^13.x" // Required for hidden widget + JS bridge
}
```

**Note**: Using hidden WebView approach — no need for `react-native-track-player` or SoundCloud SDK.

### Component API Design

```typescript
interface ProfileSongCardProps {
  songUrl: string | null;
  compact?: boolean; // For smaller displays
  onPlay?: () => void; // Analytics callback
}

interface SoundCloudTrackInfo {
  title: string;
  artist: string;
  artworkUrl: string;
  duration: number; // milliseconds
  embedHtml?: string;
}
```

---

## Open Questions

> ✅ **All questions resolved**

1. **Background playback policy**: ✅ **Yes** — Music continues while navigating the app. Users can pause when needed.

2. **Multiple profiles playing**: ✅ **Option: Switch to new song** — When user taps play on a different profile, stop the current song and play the new one.

3. **Edit from app**: ✅ **Yes** — 1:1 experience with web. Users can set their profile song from the mobile app.

4. **SoundCloud link visibility**: ✅ **Keep in-app** — Everything stays within the app for seamless experience. Long-press for "Open in SoundCloud" option.

5. **Offline handling**: Show last-cached metadata with "Unavailable offline" state.

---

## Technical Approach Decision

### Chosen: Hidden WebView + Custom UI (Hybrid Approach)

**Why this approach:**

- ✅ **Full brand control** — Custom RAGESTATE player UI with red accents
- ✅ **Legal compliance** — Uses official SoundCloud widget for streaming
- ✅ **No API registration** — Avoids SoundCloud SDK approval process
- ✅ **Background playback** — WebView can continue playing
- ✅ **Medium complexity** — Simpler than full native audio implementation

**How it works:**

1. Fetch track metadata via oEmbed API (title, artist, artwork)
2. Render custom RAGESTATE-branded player UI
3. Hidden WebView loads SoundCloud widget (0x0 or off-screen)
4. JavaScript bridge controls play/pause/seek
5. Widget events update our custom UI (progress, state changes)

```
┌─────────────────────────────────────────┐
│  Visible: Custom RAGESTATE Player UI    │
│  ┌─────┐                                │
│  │ Art │  Track Title                   │
│  │     │  Artist Name                   │
│  └─────┘  ▶ ━━━━━━━━━━━━ 3:24          │
└─────────────────────────────────────────┘
          │
          │ JS Bridge (play/pause/progress)
          ▼
┌─────────────────────────────────────────┐
│  Hidden: SoundCloud Widget WebView      │
│  (handles actual audio streaming)       │
└─────────────────────────────────────────┘
```

---

## Success Criteria

- [ ] Users can see profile songs on any profile that has one set
- [ ] Tap to play works smoothly with <2s load time
- [ ] Audio plays clearly without interruption
- [ ] UI matches RAGESTATE design language
- [ ] No crashes or ANRs related to audio
- [ ] Battery impact is minimal when not playing
- [ ] Users report positive feedback on the feature

---

## References

- [SoundCloud oEmbed Docs](https://developers.soundcloud.com/docs/oembed)
- [SoundCloud Widget API](https://developers.soundcloud.com/docs/api/html5-widget)
- [react-native-track-player](https://react-native-track-player.js.org/)
- [expo-av Audio](https://docs.expo.dev/versions/latest/sdk/audio/)

---

## Next Steps

1. ~~**Answer open questions**~~ ✅ Complete
2. **Install dependency**: `npx expo install react-native-webview`
3. **Spike**: Test oEmbed API + hidden WebView JS bridge (2-3 hours)
4. **Begin Phase 1** implementation

---

_"Music is the shortcut to the heart" — MySpace knew this. Let's bring it back._ 🎶
