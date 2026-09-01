import React, { useEffect, useRef } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { isAllowedManagedUrl, normalizeManagedUrl, platformForUrl } from '@/lib/brcommunity';

type Props = {
  url: string;
  title: string;
  soundEnabled: boolean;
  soundRequest: number;
  onEnableSound: () => void;
};

function youtubeEmbedUrl(url: string): string | null {
  try {
    const safeUrl = normalizeManagedUrl(url);
    if (!safeUrl) return null;
    const parsed = new URL(safeUrl);
    let videoId = '';
    if (parsed.hostname === 'youtu.be') {
      videoId = parsed.pathname.slice(1);
    } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'gaming.youtube.com'].includes(parsed.hostname.toLowerCase())) {
      if (parsed.pathname === '/watch') videoId = parsed.searchParams.get('v') || '';
      else if (parsed.pathname.startsWith('/shorts/')) videoId = parsed.pathname.split('/')[2] || '';
      else if (parsed.pathname.startsWith('/embed/')) videoId = parsed.pathname.split('/')[2] || '';
    }
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
  } catch {
    return null;
  }
}

export function WebMediaPreview({ url, title, soundEnabled, soundRequest, onEnableSound }: Props) {
  const safeUrl = normalizeManagedUrl(url);
  const platform = safeUrl ? platformForUrl(safeUrl) : 'other';
  const embedUrl = platform === 'youtube' ? youtubeEmbedUrl(safeUrl || '') : null;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sendAudioCommand = () => {
    const frame = iframeRef.current;
    const send = (func: string, args: unknown[] = []) => {
      frame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube.com');
    };
    send('unMute');
    send('setVolume', [100]);
    send('playVideo');
  };

  useEffect(() => {
    if (!soundEnabled) return;
    let attempts = 0;
    const timer = setInterval(() => {
      sendAudioCommand();
      attempts += 1;
      if (attempts >= 16) clearInterval(timer);
    }, 250);
    sendAudioCommand();
    return () => clearInterval(timer);
  }, [soundEnabled, soundRequest]);

  if (embedUrl) {
    const enableSound = () => {
      onEnableSound();
      sendAudioCommand();
    };
    return (
      <View style={styles.player}>
        {React.createElement('iframe', {
          ref: iframeRef,
          onLoad: () => {
            if (soundEnabled) sendAudioCommand();
          },
          title: title || 'YouTube video',
          src: embedUrl,
          allow: 'autoplay; encrypted-media; picture-in-picture',
          allowFullScreen: true,
          referrerPolicy: 'strict-origin-when-cross-origin',
          style: styles.iframe,
        })}
        {!soundEnabled ? (
          <Pressable onPress={enableSound} style={styles.soundButton}>
            <AppIcon family="ionicons" name="volume-high" size={16} color="#06111d" />
            <Text style={styles.soundText}>Enable sound</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (!safeUrl || !isAllowedManagedUrl(safeUrl)) return null;

  return (
    <Pressable onPress={() => void Linking.openURL(safeUrl)} style={styles.fallback}>
      <AppIcon family="ionicons" name="open-outline" size={24} color="#5eead4" />
      <Text style={styles.fallbackTitle}>{platform === 'instagram' ? 'Open Instagram Reel' : 'Open media link'}</Text>
      <Text style={styles.fallbackText}>This site does not allow embedded playback in the web preview.</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  player: { flex: 1, position: 'relative' },
  iframe: { width: '100%', height: '100%', borderWidth: 0, backgroundColor: '#060b13' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 8, backgroundColor: '#060b13' },
  fallbackTitle: { color: '#f7fbff', fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  fallbackText: { color: '#8ea2b8', fontFamily: 'Inter_400Regular', fontSize: 11, textAlign: 'center' },
  soundButton: { position: 'absolute', left: 12, bottom: 12, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#5eead4' },
  soundText: { color: '#06111d', fontFamily: 'Inter_700Bold', fontSize: 11 },
});