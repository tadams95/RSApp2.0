import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { AppState, AppStateStatus, View } from "react-native";
import WebView, { WebViewMessageEvent } from "react-native-webview";

// ============================================
// Types
// ============================================

export type PlayerState = "idle" | "loading" | "playing" | "paused" | "error";

export interface PlayerProgress {
  currentTime: number; // milliseconds
  duration: number; // milliseconds
  percentage: number; // 0-100
}

interface SoundCloudPlayerContextType {
  // Current state
  currentSongUrl: string | null;
  playerState: PlayerState;
  progress: PlayerProgress;

  // Actions
  play: (songUrl: string) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seekTo: (percentage: number) => void;

  // Helpers
  isCurrentSong: (songUrl: string) => boolean;
}

// ============================================
// Context
// ============================================

const SoundCloudPlayerContext =
  createContext<SoundCloudPlayerContextType | null>(null);

export function useSoundCloudPlayer() {
  const context = useContext(SoundCloudPlayerContext);
  if (!context) {
    throw new Error(
      "useSoundCloudPlayer must be used within SoundCloudPlayerProvider"
    );
  }
  return context;
}

// ============================================
// Widget HTML Generator
// ============================================

function generateWidgetHtml(songUrl: string): string {
  // The SoundCloud Widget API requires an iframe with the widget URL
  // We'll use postMessage to communicate between RN and the widget
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
          
          // Send message to React Native
          function sendToRN(type, data) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...data }));
          }
          
          // Widget event handlers
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
          
          // Listen for commands from React Native
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
          
          // Also handle document message events (for Android)
          document.addEventListener('message', function(event) {
            window.dispatchEvent(new MessageEvent('message', { data: event.data }));
          });
        })();
      </script>
    </body>
    </html>
  `;
}

// ============================================
// Provider Component
// ============================================

export function SoundCloudPlayerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const webViewRef = useRef<WebView>(null);
  const [currentSongUrl, setCurrentSongUrl] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<PlayerState>("idle");
  const [progress, setProgress] = useState<PlayerProgress>({
    currentTime: 0,
    duration: 0,
    percentage: 0,
  });
  const [widgetHtml, setWidgetHtml] = useState<string | null>(null);

  // Track duration from widget
  const durationRef = useRef<number>(0);

  // Handle messages from WebView
  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      switch (data.type) {
        case "ready":
          durationRef.current = data.duration || 0;
          setProgress((prev) => ({ ...prev, duration: data.duration || 0 }));
          // Auto-play when ready (user already tapped play)
          webViewRef.current?.injectJavaScript(
            `window.postMessage(JSON.stringify({ action: 'play' }), '*'); true;`
          );
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
          break;

        case "error":
          setPlayerState("error");
          break;

        case "progress":
          setProgress({
            currentTime: data.currentTime || 0,
            duration: durationRef.current,
            percentage: data.percentage || 0,
          });
          break;
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Handle app state changes (background/foreground)
  React.useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // WebView continues playing in background on iOS
      // On Android, it may pause - we could handle this if needed
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription.remove();
  }, []);

  // Actions
  const play = useCallback(
    (songUrl: string) => {
      // If same song, just resume
      if (songUrl === currentSongUrl && playerState === "paused") {
        webViewRef.current?.injectJavaScript(
          `window.postMessage(JSON.stringify({ action: 'play' }), '*'); true;`
        );
        return;
      }

      // New song - load it
      setCurrentSongUrl(songUrl);
      setPlayerState("loading");
      setProgress({ currentTime: 0, duration: 0, percentage: 0 });
      setWidgetHtml(generateWidgetHtml(songUrl));
    },
    [currentSongUrl, playerState]
  );

  const pause = useCallback(() => {
    if (playerState === "playing") {
      webViewRef.current?.injectJavaScript(
        `window.postMessage(JSON.stringify({ action: 'pause' }), '*'); true;`
      );
    }
  }, [playerState]);

  const resume = useCallback(() => {
    if (playerState === "paused") {
      webViewRef.current?.injectJavaScript(
        `window.postMessage(JSON.stringify({ action: 'play' }), '*'); true;`
      );
    }
  }, [playerState]);

  const stop = useCallback(() => {
    setCurrentSongUrl(null);
    setPlayerState("idle");
    setProgress({ currentTime: 0, duration: 0, percentage: 0 });
    setWidgetHtml(null);
  }, []);

  const seekTo = useCallback((percentage: number) => {
    webViewRef.current?.injectJavaScript(
      `window.postMessage(JSON.stringify({ action: 'seekTo', percentage: ${percentage} }), '*'); true;`
    );
  }, []);

  const isCurrentSong = useCallback(
    (songUrl: string) => currentSongUrl === songUrl,
    [currentSongUrl]
  );

  const contextValue: SoundCloudPlayerContextType = {
    currentSongUrl,
    playerState,
    progress,
    play,
    pause,
    resume,
    stop,
    seekTo,
    isCurrentSong,
  };

  return (
    <SoundCloudPlayerContext.Provider value={contextValue}>
      {children}

      {/* Hidden WebView for audio playback */}
      {widgetHtml && (
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
            source={{ html: widgetHtml }}
            onMessage={handleMessage}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            // Android: Keep playing when app backgrounded
            androidLayerType="hardware"
          />
        </View>
      )}
    </SoundCloudPlayerContext.Provider>
  );
}
