import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import ChatBubble from '../components/ChatBubble.jsx';
import MoodInput from '../components/MoodInput.jsx';
import NowPlaying from '../components/NowPlaying.jsx';
import PlaylistCard from '../components/PlaylistCard.jsx';
import FloatingPlayer from '../components/FloatingPlayer.jsx';
import VinylPlayer from '../components/VinylPlayer.jsx';
import GlitchText from '../components/GlitchText.jsx';
import { playHover, playClick } from '../hooks/useSound.js';
import { arioState } from '../hooks/arioState.js';
import { useLanguage } from '../hooks/LanguageContext.jsx';
import useSpeech from '../hooks/useSpeech.js';

export default function Player({ mode = 'free' }) {
  const saved = arioState.load();
  const { t, lang } = useLanguage();
  const { speak, stop: stopSpeech, unlock } = useSpeech(lang);
  const [messages, setMessages] = useState(saved?.messages || []);
  const [loading, setLoading] = useState(false);
  const [nowPlaying, setNowPlaying] = useState(saved?.nowPlaying || null);
  const [showFloat, setShowFloat] = useState(false);
  const [speechOn, setSpeechOn] = useState(true);
  const chatRef = useRef(null);
  const isPlaylistMode = mode === 'playlist';

  // Persist state across tab switches
  useEffect(() => {
    return () => arioState.save({ messages, nowPlaying });
  }, [messages, nowPlaying]);

  // Build play queue from all songs in messages
  const playQueue = useMemo(() => {
    const songs = [];
    messages.forEach(msg => {
      if (msg.play && msg.play.length > 0) songs.push(...msg.play);
    });
    return songs;
  }, [messages]);

  const currentPlayIdx = useMemo(() => {
    if (!nowPlaying) return -1;
    return playQueue.findIndex(s => s.id === nowPlaying.id);
  }, [nowPlaying, playQueue]);

  const playNext = useCallback((dir) => {
    if (playQueue.length === 0) return;
    let next = currentPlayIdx + dir;
    if (next < 0) next = playQueue.length - 1;
    if (next >= playQueue.length) next = 0;
    setNowPlaying(playQueue[next]);
  }, [currentPlayIdx, playQueue]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text) => {
    playClick();
    unlock();     // unlock Web Speech API (must be from user gesture)
    stopSpeech(); // stop any ongoing speech from previous response
    const userMsg = { role: 'user', content: text, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, mode, lang }),
      });
      const data = await res.json();

      const arioMsg = {
        role: 'assistant',
        content: data.say,
        reason: data.reason,
        segue: data.segue,
        play: data.play || [],
        ts: Date.now(),
      };
      setMessages(prev => [...prev, arioMsg]);

      // Speak the DJ response if voice is enabled
      if (data.say && speechOn) speak(data.say);

      if (data.play && data.play.length > 0) {
        setNowPlaying(data.play[0]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: t('player.error'),
        play: [],
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [mode, t, lang, unlock, stopSpeech, speak, speechOn]);


  return (
    <div className="flex flex-col h-full">
      <div ref={chatRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-4 space-y-4" style={{ paddingBottom: '140px' }}>
        {/* Welcome */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="mb-6">
              <VinylPlayer size={130} spinning={false} glowColor="var(--color-cyber-cyan)" />
            </div>
            <GlitchText
              className="text-3xl font-black mb-3 glow-cyan"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {t('player.welcome')}
            </GlitchText>
            <p className="text-[var(--color-cyber-muted)] text-base mb-1 font-mono">
              {t('player.subtitle')}
            </p>
            <p className="text-[var(--color-cyber-muted)] text-sm max-w-xs">
              {t('player.prompt')}
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-sm">
              {[
                { emoji: '😌', label: t('player.chill') },
                { emoji: '⚡', label: t('player.energy') },
                { emoji: '🌙', label: t('player.late') },
                { emoji: '💔', label: t('player.feels') },
              ].map(({ emoji, label }) => (
                <button
                  key={label}
                  onMouseEnter={playHover}
                  onClick={() => sendMessage(`I'm feeling ${label.toLowerCase()}. ${emoji}`)}
                  className="cyber-btn flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-cyber-card)] border border-[var(--color-cyber-cyan)]/10 hover:border-[var(--color-cyber-cyan)]/40 transition-all duration-200 text-left"
                >
                  <span className="text-xl">{emoji}</span>
                  <span className="text-sm text-[var(--color-cyber-text)]">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, i) => (
          <div key={i} className="animate-slide-up">
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-md bg-[var(--color-cyber-purple)]/10 border border-[var(--color-cyber-purple)]/20 text-[var(--color-cyber-text)]">
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <ChatBubble message={msg.content} reason={msg.reason} segue={msg.segue} />
                {msg.play && msg.play.length > 0 && (
                  <div className="ml-12 space-y-2">
                    {msg.play.map((track, j) => (
                      <PlaylistCard key={j} track={track}
                        onPlay={() => { playClick(); setNowPlaying(track); }} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-3 ml-4 animate-slide-up">
            <VinylPlayer size={32} spinning glowColor="var(--color-cyber-cyan)" />
            <span className="text-[var(--color-cyber-cyan)] text-xs font-mono animate-pulse-cyan">
              {t('player.loading')}
            </span>
          </div>
        )}
      </div>

      {/* Now Playing bar */}
      {nowPlaying && (
        <NowPlaying
          track={nowPlaying}
          queue={playQueue}
          currentIdx={currentPlayIdx}
          onClose={() => setNowPlaying(null)}
          onNext={playNext}
          onOpenFloat={() => setShowFloat(true)}
        />
      )}

      {/* Floating player */}
      {showFloat && nowPlaying && (
        <FloatingPlayer
          track={nowPlaying}
          queue={playQueue}
          currentIdx={currentPlayIdx}
          onClose={() => setShowFloat(false)}
          onNext={playNext}
        />
      )}

      {/* AI Voice toggle — persistent bottom-right */}
      <div className="fixed bottom-36 right-4 z-45">
        <button
          onClick={() => { setSpeechOn(!speechOn); if (!speechOn) unlock(); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all backdrop-blur-md ${
            speechOn
              ? 'bg-[var(--color-cyber-purple)]/25 text-[var(--color-cyber-purple)] border border-[var(--color-cyber-purple)]/50 shadow-[0_0_16px_rgba(179,0,255,0.3)]'
              : 'bg-[var(--color-cyber-surface)]/90 text-[var(--color-cyber-muted)] border border-[var(--color-cyber-purple)]/15 hover:border-[var(--color-cyber-purple)]/30'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${speechOn ? 'bg-[var(--color-cyber-purple)] animate-pulse-purple' : 'bg-[var(--color-cyber-muted)]/40'}`} />
          AI VOICE
          <span className="text-[10px] opacity-60">{speechOn ? 'ON' : 'OFF'}</span>
        </button>
      </div>
      <MoodInput onSend={sendMessage} loading={loading} />
    </div>
  );
}
