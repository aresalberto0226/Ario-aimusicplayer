import { useState, useEffect } from 'react';
import GlitchText from '../components/GlitchText.jsx';
import { playHover, playClick } from '../hooks/useSound.js';
import { useLanguage } from '../hooks/LanguageContext.jsx';
import { getAvailableVoices } from '../hooks/useSpeech.js';

const VOICE_KEY = 'ario_voice';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [showApi, setShowApi] = useState(false);
  const [saved, setSaved] = useState(false);
  const { lang, setLang, t } = useLanguage();
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(() => {
    try { return localStorage.getItem(VOICE_KEY) || ''; }
    catch { return ''; }
  });

  // Load available browser voices
  useEffect(() => {
    const load = () => {
      setVoices(getAvailableVoices());
    };
    load();
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = load;
    }
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  const handleVoiceChange = (e) => {
    const name = e.target.value;
    setSelectedVoice(name);
    localStorage.setItem(VOICE_KEY, name);
  };

  const handleSave = async () => {
    playClick();
    await fetch('/api/prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey || undefined }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-20">
      <div className="px-4 pt-6 space-y-6">
        <div className="text-center mb-2">
          <GlitchText className="text-2xl font-black mb-1 glow-cyan" style={{ fontFamily: 'var(--font-display)' }}>
            {t('settings.title')}
          </GlitchText>
          <p className="text-xs text-[var(--color-cyber-muted)] font-mono">
            {t('settings.subtitle')}
          </p>
        </div>

        {/* Language Setting */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--color-cyber-cyan)] font-mono">
            {t('settings.language')}
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => setLang('en')}
              onMouseEnter={playHover}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 font-mono ${
                lang === 'en'
                  ? 'bg-[var(--color-cyber-purple)]/20 text-[var(--color-cyber-purple)] border border-[var(--color-cyber-purple)]/50 glow-purple'
                  : 'bg-[var(--color-cyber-surface)] text-[var(--color-cyber-muted)] border border-[var(--color-cyber-purple)]/10 hover:border-[var(--color-cyber-purple)]/30'
              }`}
            >
              {t('settings.langEn')}
            </button>
            <button
              onClick={() => setLang('zh')}
              onMouseEnter={playHover}
              className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 font-mono ${
                lang === 'zh'
                  ? 'bg-[var(--color-cyber-purple)]/20 text-[var(--color-cyber-purple)] border border-[var(--color-cyber-purple)]/50 glow-purple'
                  : 'bg-[var(--color-cyber-surface)] text-[var(--color-cyber-muted)] border border-[var(--color-cyber-purple)]/10 hover:border-[var(--color-cyber-purple)]/30'
              }`}
            >
              {t('settings.langZh')}
            </button>
          </div>
        </section>

        {/* Voice Setting */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--color-cyber-cyan)] font-mono">
            {t('settings.voice')}
          </h2>
          <p className="text-xs text-[var(--color-cyber-muted)] font-mono">
            {t('settings.voiceHint')}
          </p>
          <div className="flex gap-2">
            <select
              value={selectedVoice}
              onChange={handleVoiceChange}
              className="flex-1 px-4 py-3 rounded-xl bg-[var(--color-cyber-surface)] border border-[var(--color-cyber-purple)]/15 text-[var(--color-cyber-text)] focus:outline-none focus:border-[var(--color-cyber-cyan)]/50 transition-all duration-200 text-sm font-mono cursor-pointer"
            >
              <option value="">🎙 {t('settings.voiceAuto')}</option>
              {voices.map(v => (
                <option key={v.name} value={v.name}>
                  🎙 {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!window.speechSynthesis) return;
                window.speechSynthesis.cancel();
                const u = new SpeechSynthesisUtterance(
                  lang === 'zh'
                    ? '你好，我是 Ario，你的专属 AI 打碟师。让我为你挑选最好的音乐。'
                    : "Hello, I'm Ario, your personal AI DJ. Let me spin the perfect tracks for you."
                );
                u.rate = 1.10;
                u.pitch = 1.05;
                u.volume = 0.8;
                // Apply selected voice
                if (selectedVoice) {
                  const v = getAvailableVoices().find(v => v.name === selectedVoice);
                  if (v) u.voice = v;
                }
                window.speechSynthesis.speak(u);
              }}
              onMouseEnter={playHover}
              className="px-4 py-3 rounded-xl bg-[var(--color-cyber-cyan)]/10 text-[var(--color-cyber-cyan)] border border-[var(--color-cyber-cyan)]/20 hover:bg-[var(--color-cyber-cyan)]/20 hover:border-[var(--color-cyber-cyan)]/40 transition-all duration-200 text-sm font-mono whitespace-nowrap"
            >
              ▶ PREVIEW
            </button>
          </div>
        </section>

        {/* About Ario */}
        <section className="space-y-4 p-5 rounded-2xl bg-[var(--color-cyber-card)] border border-[var(--color-cyber-purple)]/10">
          <h2 className="text-base font-semibold text-[var(--color-cyber-cyan)] font-mono">
            {t('settings.about')}
          </h2>
          <p className="text-sm text-[var(--color-cyber-text)] leading-relaxed">
            {t('settings.aboutText')}
          </p>
          <div className="space-y-3 pt-2 border-t border-[var(--color-cyber-purple)]/10">
            <div>
              <h3 className="text-xs font-bold text-[var(--color-cyber-purple)] font-mono mb-1">🎧 Ario FM</h3>
              <p className="text-xs text-[var(--color-cyber-muted)] leading-relaxed">{t('settings.aboutFM')}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--color-cyber-cyan)] font-mono mb-1">📻 My Radio</h3>
              <p className="text-xs text-[var(--color-cyber-muted)] leading-relaxed">{t('settings.aboutRadio')}</p>
            </div>
            <div>
              <h3 className="text-xs font-bold text-[var(--color-cyber-gold)] font-mono mb-1">🎵 Profile</h3>
              <p className="text-xs text-[var(--color-cyber-muted)] leading-relaxed">{t('settings.aboutProfile')}</p>
            </div>
          </div>
        </section>

        {/* API Key — collapsible */}
        <section className="space-y-3">
          <button
            onClick={() => setShowApi(!showApi)}
            className="w-full flex items-center justify-between text-base font-semibold text-[var(--color-cyber-cyan)] font-mono hover:text-[var(--color-cyber-cyan)]/80 transition-colors"
          >
            <span>{t('settings.apiKey')}</span>
            <span className="text-xs transition-transform" style={{ transform: showApi ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          </button>
          {showApi && (
            <div className="space-y-3 animate-slide-up">
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={t('settings.apiPlaceholder')}
                className="w-full px-4 py-3 rounded-xl bg-[var(--color-cyber-surface)] border border-[var(--color-cyber-purple)]/15 text-[var(--color-cyber-text)] placeholder:text-[var(--color-cyber-muted)]/40 focus:outline-none focus:border-[var(--color-cyber-cyan)]/50 transition-all duration-200 text-sm font-mono"
              />
              <button
                onClick={handleSave}
                onMouseEnter={playHover}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 font-mono ${
                  saved
                    ? 'bg-[var(--color-cyber-cyan)]/10 text-[var(--color-cyber-cyan)] border border-[var(--color-cyber-cyan)]/30'
                    : 'cyber-btn text-[var(--color-cyber-bg)] border border-[var(--color-cyber-cyan)]/30'
                }`}
                style={!saved ? { background: 'linear-gradient(135deg, var(--color-cyber-cyan), #0099cc)' } : {}}
              >
                {saved ? t('settings.saved') : t('settings.save')}
              </button>
            </div>
          )}
        </section>

        <div className="p-4 rounded-xl bg-[var(--color-cyber-card)] border border-[var(--color-cyber-purple)]/10 text-center font-mono">
          <p className="text-xs text-[var(--color-cyber-muted)]">
            {t('settings.version')}
          </p>
          <p className="text-xs text-[var(--color-cyber-purple)] mt-1">
            {t('settings.tagline')}
          </p>
        </div>
      </div>
    </div>
  );
}
