/**
 * MusicPlayerContext
 * Universal music player context that supports multiple platforms:
 * - SoundCloud (full playback via widget)
 * - Spotify (30s preview via embed)
 * - YouTube (full playback via embed)
 *
 * This context manages playback state, progress tracking, and platform-specific
 * WebView embeds for a unified music experience across the app.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus, Linking, View } from "react-native";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import { usePostHog } from "../analytics/PostHogProvider";
import {
  detectMusicPlatform,
  getDeepLink,
  getMusicPlatformConfig,
  MusicPlatform,
  MusicTrackInfo,
} from "../utils/musicPlatforms";

// ============================================
// Types
// ============================================

export type PlayerState = "idle" | "loading" | "playing" | "paused" | "error";

export interface PlayerProgress {
  currentTime: number; // milliseconds
  duration: number; // milliseconds
  percentage: number; // 0-100
}

export interface CurrentTrack {
  url: string;
  platform: MusicPlatform;
  trackInfo?: MusicTrackInfo;
}

interface MusicPlayerContextType {
  // Current state
  currentTrack: CurrentTrack | null;
  playerState: PlayerState;
  progress: PlayerProgress;

  // Actions
  play: (url: string, trackInfo?: MusicTrackInfo) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seekTo: (percentage: number) => void;

  // Platform-specific
  openInApp: (url: string) => Promise<void>;

  // Helpers
  isCurrentSong: (url: string) => boolean;
  canPlayInApp: (platform: MusicPlatform) => boolean;
}

// ============================================
// Context
// ============================================

const MusicPlayerContext = createContext<MusicPlayerContextType | null>(null);

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (!context) {
    throw new Error("useMusicPlayer must be used within MusicPlayerProvider");
  }
  return context;
}

// ============================================
// WebView HTML Generators
// ============================================

/**
 * Generate SoundCloud widget HTML
 */
function generateSoundCloudHtml(songUrl: string): string {
  const widgetUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    songUrl
  )}&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body, html { margin: 0; padding: 0; overflow: hidden; }
        iframe { border: none; }
      </style>
    </head>
    <body>
      <iframe id="sc-widget" width="100%" height="166" scrolling="no" frameborder="no"
        src="${widgetUrl}">
      </iframe>
      
      <script src="https://w.soundcloud.com/player/api.js"></script>
      <script>
        (function() {
          var widget = SC.Widget(document.getElementById('sc-widget'));
          var isReady = false;
          
          function sendToRN(type, data) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type, platform: 'soundcloud', ...data }));
          }
          
          widget.bind(SC.Widget.Events.READY, function() {
            isReady = true;
            widget.getDuration(function(duration) {
              sendToRN('ready', { duration: duration });
            });
          });
          
          widget.bind(SC.Widget.Events.PLAY, function() {
            sendToRN('play', {});
          });
          
          widget.bind(SC.Widget.Events.PAUSE, function() {
            sendToRN('pause', {});
          });
          
          widget.bind(SC.Widget.Events.FINISH, function() {
            sendToRN('finish', {});
          });
          
          widget.bind(SC.Widget.Events.ERROR, function(e) {
            sendToRN('error', { error: e });
          });
          
          widget.bind(SC.Widget.Events.PLAY_PROGRESS, function(e) {
            sendToRN('progress', {
              currentTime: e.currentPosition,
              percentage: e.relativePosition * 100
            });
          });
          
          window.addEventListener('message', function(event) {
            if (!isReady) return;
            
            try {
              var command = JSON.parse(event.data);
              
              switch(command.action) {
                case 'play':
                  widget.play();
                  break;
                case 'pause':
                  widget.pause();
                  break;
                case 'seekTo':
                  widget.getDuration(function(duration) {
                    var position = (command.percentage / 100) * duration;
                    widget.seekTo(position);
                  });
                  break;
                case 'setVolume':
                  widget.setVolume(command.volume);
                  break;
              }
            } catch(e) {
              // Ignore parse errors
            }
          });
          
          document.addEventListener('message', function(event) {
            window.dispatchEvent(new MessageEvent('message', { data: event.data }));
          });
        })();
      </script>
    </body>
    </html>
  `;
}

/**
 * Extract Spotify track ID from URL
 */
function extractSpotifyId(url: string): string | null {
  // Handles: open.spotify.com/track/{id}, open.spotify.com/intl-en/track/{id}
  const match = url.match(
    /spotify\.com(?:\/intl-[\w]+)?\/(?:track|album|episode)\/([a-zA-Z0-9]+)/i
  );
  return match ? match[1] : null;
}

/**
 * Generate Spotify embed HTML (30s preview)
 */
function generateSpotifyHtml(songUrl: string): string {
  const trackId = extractSpotifyId(songUrl);

  if (!trackId) {
    return `
      <!DOCTYPE html>
      <html><body>
        <script>
          window.ReactNativeWebView.postMessage(JSON.stringify({ 
            type: 'error', 
            platform: 'spotify',
            error: 'Invalid Spotify URL' 
          }));
        </script>
      </body></html>
    `;
  }

  // Spotify embed URL - use compact theme for audio-only
  const embedUrl = `https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body, html { 
          margin: 0; 
          padding: 0; 
          overflow: hidden; 
          background: transparent;
        }
        iframe { 
          border: none; 
          border-radius: 12px;
        }
      </style>
    </head>
    <body>
      <iframe 
        id="spotify-embed"
        src="${embedUrl}"
        width="100%" 
        height="152" 
        frameBorder="0" 
        allowfullscreen="" 
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy">
      </iframe>
      
      <script>
        (function() {
          var iframe = document.getElementById('spotify-embed');
          var isReady = false;
          var isPlaying = false;
          var duration = 30000; // Spotify preview is typically 30s
          var startTime = null;
          var progressInterval = null;
          
          function sendToRN(type, data) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type, 
              platform: 'spotify',
              ...data 
            }));
          }
          
          // Spotify doesn't have a public API for embeds, so we simulate state
          iframe.onload = function() {
            isReady = true;
            sendToRN('ready', { duration: duration });
          };
          
          iframe.onerror = function() {
            sendToRN('error', { error: 'Failed to load Spotify embed' });
          };
          
          // Listen for commands from React Native
          window.addEventListener('message', function(event) {
            if (!isReady) return;
            
            try {
              var command = JSON.parse(event.data);
              
              switch(command.action) {
                case 'play':
                  // We can't programmatically control Spotify embed
                  // User must tap the play button in the embed
                  // Just notify that we're ready for manual play
                  sendToRN('manualPlayRequired', {});
                  break;
                case 'pause':
                  // Can't pause programmatically either
                  break;
                case 'trackPlay':
                  // Called when user starts playing via embed
                  isPlaying = true;
                  startTime = Date.now();
                  sendToRN('play', {});
                  
                  // Simulate progress since we can't get real progress
                  progressInterval = setInterval(function() {
                    if (isPlaying && startTime) {
                      var elapsed = Date.now() - startTime;
                      var percentage = Math.min((elapsed / duration) * 100, 100);
                      sendToRN('progress', {
                        currentTime: elapsed,
                        percentage: percentage
                      });
                      
                      if (elapsed >= duration) {
                        clearInterval(progressInterval);
                        sendToRN('finish', {});
                        isPlaying = false;
                      }
                    }
                  }, 500);
                  break;
                case 'trackPause':
                  isPlaying = false;
                  clearInterval(progressInterval);
                  sendToRN('pause', {});
                  break;
              }
            } catch(e) {
              // Ignore parse errors
            }
          });
          
          document.addEventListener('message', function(event) {
            window.dispatchEvent(new MessageEvent('message', { data: event.data }));
          });
        })();
      </script>
    </body>
    </html>
  `;
}

/**
 * Extract YouTube video ID from URL
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/i,
    /(?:music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Generate YouTube embed HTML
 */
function generateYouTubeHtml(songUrl: string): string {
  const videoId = extractYouTubeId(songUrl);

  if (!videoId) {
    return `
      <!DOCTYPE html>
      <html><body>
        <script>
          window.ReactNativeWebView.postMessage(JSON.stringify({ 
            type: 'error', 
            platform: 'youtube',
            error: 'Invalid YouTube URL' 
          }));
        </script>
      </body></html>
    `;
  }

  // Use youtube-nocookie.com for privacy
  // Enable JS API for playback control
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(
    "https://localhost"
  )}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body, html { 
          margin: 0; 
          padding: 0; 
          overflow: hidden;
          background: #000;
        }
        #player {
          width: 100%;
          height: 100%;
        }
      </style>
    </head>
    <body>
      <div id="player"></div>
      
      <script>
        var tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        var firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        
        var player;
        var isReady = false;
        var progressInterval = null;
        
        function sendToRN(type, data) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ 
            type, 
            platform: 'youtube',
            ...data 
          }));
        }
        
        function onYouTubeIframeAPIReady() {
          player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: '${videoId}',
            playerVars: {
              'playsinline': 1,
              'rel': 0,
              'modestbranding': 1,
              'controls': 1
            },
            events: {
              'onReady': onPlayerReady,
              'onStateChange': onPlayerStateChange,
              'onError': onPlayerError
            }
          });
        }
        
        function onPlayerReady(event) {
          isReady = true;
          var duration = player.getDuration() * 1000; // Convert to ms
          sendToRN('ready', { duration: duration });
        }
        
        function onPlayerStateChange(event) {
          switch(event.data) {
            case YT.PlayerState.PLAYING:
              sendToRN('play', {});
              startProgressTracking();
              break;
            case YT.PlayerState.PAUSED:
              sendToRN('pause', {});
              stopProgressTracking();
              break;
            case YT.PlayerState.ENDED:
              sendToRN('finish', {});
              stopProgressTracking();
              break;
            case YT.PlayerState.BUFFERING:
              sendToRN('buffering', {});
              break;
          }
        }
        
        function onPlayerError(event) {
          var errorMessages = {
            2: 'Invalid video ID',
            5: 'HTML5 player error',
            100: 'Video not found',
            101: 'Embedding disabled',
            150: 'Embedding disabled'
          };
          sendToRN('error', { 
            error: errorMessages[event.data] || 'Unknown error',
            code: event.data 
          });
        }
        
        function startProgressTracking() {
          stopProgressTracking();
          progressInterval = setInterval(function() {
            if (player && player.getCurrentTime) {
              var currentTime = player.getCurrentTime() * 1000;
              var duration = player.getDuration() * 1000;
              var percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
              sendToRN('progress', {
                currentTime: currentTime,
                percentage: percentage
              });
            }
          }, 500);
        }
        
        function stopProgressTracking() {
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
        }
        
        // Listen for commands from React Native
        window.addEventListener('message', function(event) {
          if (!isReady || !player) return;
          
          try {
            var command = JSON.parse(event.data);
            
            switch(command.action) {
              case 'play':
                player.playVideo();
                break;
              case 'pause':
                player.pauseVideo();
                break;
              case 'seekTo':
                var duration = player.getDuration();
                var position = (command.percentage / 100) * duration;
                player.seekTo(position, true);
                break;
              case 'setVolume':
                player.setVolume(command.volume);
                break;
            }
          } catch(e) {
            // Ignore parse errors
          }
        });
        
        document.addEventListener('message', function(event) {
          window.dispatchEvent(new MessageEvent('message', { data: event.data }));
        });
      </script>
    </body>
    </html>
  `;
}

/**
 * Generate platform-specific WebView HTML
 */
function generateWebViewHtml(
  url: string,
  platform: MusicPlatform
): string | null {
  switch (platform) {
    case "soundcloud":
      return generateSoundCloudHtml(url);
    case "spotify":
      return generateSpotifyHtml(url);
    case "youtube":
      return generateYouTubeHtml(url);
    default:
      return null;
  }
}

// ============================================
// Provider Component
// ============================================

export function MusicPlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const webViewRef = useRef<WebView>(null);
  const { capture } = usePostHog();

  // State
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>("idle");
  const [progress, setProgress] = useState<PlayerProgress>({
    currentTime: 0,
    duration: 0,
    percentage: 0,
  });
  const [webViewHtml, setWebViewHtml] = useState<string | null>(null);

  // Track duration from widget
  const durationRef = useRef<number>(0);

  // Handle messages from WebView
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        switch (data.type) {
          case "ready":
            durationRef.current = data.duration || 0;
            setProgress((prev) => ({ ...prev, duration: data.duration || 0 }));

            // Auto-play for SoundCloud and YouTube
            if (data.platform === "soundcloud" || data.platform === "youtube") {
              webViewRef.current?.injectJavaScript(
                `window.postMessage(JSON.stringify({ action: 'play' }), '*'); true;`
              );
            } else if (data.platform === "spotify") {
              // Spotify requires manual interaction
              setPlayerState("paused");
              // Track that user needs to tap play
              capture("spotify_manual_play_required", {
                track_url: currentTrack?.url || null,
              });
            }
            break;

          case "play":
            setPlayerState("playing");
            break;

          case "pause":
            setPlayerState("paused");
            break;

          case "finish":
            setPlayerState("idle");
            setProgress({
              currentTime: 0,
              duration: durationRef.current,
              percentage: 0,
            });

            // Track playback completion
            if (currentTrack) {
              capture("profile_music_finished", {
                platform: currentTrack.platform,
                track_title: currentTrack.trackInfo?.title || null,
                track_artist: currentTrack.trackInfo?.artist || null,
              });
            }
            break;

          case "error":
            setPlayerState("error");
            console.error(`[MusicPlayer] ${data.platform} error:`, data.error);

            // Track playback error
            if (currentTrack) {
              capture("profile_music_error", {
                platform: currentTrack.platform,
                error: data.error,
                error_code: data.code,
              });
            }
            break;

          case "progress":
            setProgress({
              currentTime: data.currentTime || 0,
              duration: durationRef.current,
              percentage: data.percentage || 0,
            });
            break;

          case "buffering":
            setPlayerState("loading");
            break;

          case "manualPlayRequired":
            // Spotify embed needs user tap - keep in loading state
            // The embed itself will handle the play state
            setPlayerState("loading");
            break;
        }
      } catch {
        // Ignore parse errors
      }
    },
    [currentTrack, capture]
  );

  // Handle app state changes (background/foreground)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // Track when app goes to background while playing
      if (
        nextAppState === "background" &&
        playerState === "playing" &&
        currentTrack
      ) {
        capture("profile_music_backgrounded", {
          platform: currentTrack.platform,
          progress_percentage: progress.percentage,
        });
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription.remove();
  }, [playerState, currentTrack, progress.percentage, capture]);

  // Actions
  const play = useCallback(
    (url: string, trackInfo?: MusicTrackInfo) => {
      const platform = detectMusicPlatform(url);

      // Check if platform supports in-app playback
      if (!canPlayInAppFn(platform)) {
        // Open in external app instead
        openInAppFn(url);
        return;
      }

      // If same song, just resume
      if (url === currentTrack?.url && playerState === "paused") {
        webViewRef.current?.injectJavaScript(
          `window.postMessage(JSON.stringify({ action: 'play' }), '*'); true;`
        );
        return;
      }

      // New track - load it
      setCurrentTrack({ url, platform, trackInfo });
      setPlayerState("loading");
      setProgress({ currentTime: 0, duration: 0, percentage: 0 });

      const html = generateWebViewHtml(url, platform);
      setWebViewHtml(html);

      // Track play event
      capture("profile_music_played", {
        platform,
        track_url: url,
        track_title: trackInfo?.title || null,
        track_artist: trackInfo?.artist || null,
        is_preview: platform === "spotify", // Spotify only does 30s previews
      });
    },
    [currentTrack, playerState, capture]
  );

  const pause = useCallback(() => {
    if (playerState === "playing") {
      webViewRef.current?.injectJavaScript(
        `window.postMessage(JSON.stringify({ action: 'pause' }), '*'); true;`
      );

      // Track pause event
      if (currentTrack) {
        capture("profile_music_paused", {
          platform: currentTrack.platform,
          progress_percentage: progress.percentage,
        });
      }
    }
  }, [playerState, currentTrack, progress.percentage, capture]);

  const resume = useCallback(() => {
    if (playerState === "paused") {
      webViewRef.current?.injectJavaScript(
        `window.postMessage(JSON.stringify({ action: 'play' }), '*'); true;`
      );

      // Track resume event
      if (currentTrack) {
        capture("profile_music_resumed", {
          platform: currentTrack.platform,
        });
      }
    }
  }, [playerState, currentTrack, capture]);

  const stop = useCallback(() => {
    // Track stop event before clearing
    if (currentTrack && playerState !== "idle") {
      capture("profile_music_stopped", {
        platform: currentTrack.platform,
        progress_percentage: progress.percentage,
      });
    }

    setCurrentTrack(null);
    setPlayerState("idle");
    setProgress({ currentTime: 0, duration: 0, percentage: 0 });
    setWebViewHtml(null);
  }, [currentTrack, playerState, progress.percentage, capture]);

  const seekTo = useCallback((percentage: number) => {
    webViewRef.current?.injectJavaScript(
      `window.postMessage(JSON.stringify({ action: 'seekTo', percentage: ${percentage} }), '*'); true;`
    );
  }, []);

  // Open in platform's native app or browser
  const openInAppFn = useCallback(
    async (url: string) => {
      const platform = detectMusicPlatform(url);
      const platformConfig = getMusicPlatformConfig(platform);

      // Track analytics
      capture("profile_music_opened", {
        platform,
        destination: "app",
      });

      // Try deep link first
      const deepLink = getDeepLink(url, platform);
      if (deepLink) {
        try {
          const canOpen = await Linking.canOpenURL(deepLink);
          if (canOpen) {
            await Linking.openURL(deepLink);
            return;
          }
        } catch (err) {
          console.log(
            `Deep link failed for ${platform}, falling back to web URL`
          );
        }
      }

      // Fall back to original URL
      try {
        await Linking.openURL(url);
      } catch (err) {
        console.error("Couldn't open URL", err);
      }
    },
    [capture]
  );

  const isCurrentSong = useCallback(
    (url: string) => currentTrack?.url === url,
    [currentTrack]
  );

  // Check if platform supports in-app playback
  const canPlayInAppFn = useCallback((platform: MusicPlatform): boolean => {
    // SoundCloud and YouTube support full in-app playback
    // Spotify technically works but with limitations (30s preview, manual play)
    return platform === "soundcloud" || platform === "youtube";
  }, []);

  const contextValue: MusicPlayerContextType = {
    currentTrack,
    playerState,
    progress,
    play,
    pause,
    resume,
    stop,
    seekTo,
    openInApp: openInAppFn,
    isCurrentSong,
    canPlayInApp: canPlayInAppFn,
  };

  return (
    <MusicPlayerContext.Provider value={contextValue}>
      {children}

      {/* Hidden WebView for audio playback */}
      {webViewHtml && (
        <View
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            opacity: 0,
            overflow: "hidden",
          }}
          pointerEvents="none"
        >
          <WebView
            ref={webViewRef}
            source={{ html: webViewHtml }}
            onMessage={handleMessage}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            // Android: Keep playing when app backgrounded
            androidLayerType="hardware"
            // Allow YouTube iframe
            mixedContentMode="compatibility"
            // Allow autoplay
            allowsFullscreenVideo={false}
          />
        </View>
      )}
    </MusicPlayerContext.Provider>
  );
}

export default MusicPlayerContext;
