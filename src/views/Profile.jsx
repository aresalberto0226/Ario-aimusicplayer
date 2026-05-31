import { useState } from 'react';
import GlitchText from '../components/GlitchText.jsx';
import { playHover, playClick } from '../hooks/useSound.js';
import { useLanguage } from '../hooks/LanguageContext.jsx';

export default function Profile() {
  const [taste, setTaste] = useState('');
  const [routines, setRoutines] = useState('');
  const [saved, setSaved] = useState(false);
  const { t } = useLanguage();

  const handleSave = async () => {
    playClick();
    await fetch('/api/prefs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taste, routines }),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-20">
      <div className="px-4 pt-6 space-y-6">
        <div className="text-center mb-2">
          <GlitchText className="text-2xl font-black mb-1 glow-purple" style={{ fontFamily: 'var(--font-display)' }}>
            {t('profile.title')}
          </GlitchText>
          <p className="text-xs text-[var(--color-cyber-muted)] font-mono">
            {'>'} {t('profile.subtitle')}
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--color-cyber-cyan)] font-mono">
            {'>'} {t('profile.taste')}
          </h2>
          <textarea
            value={taste}
            onChange={e => setTaste(e.target.value)}
            placeholder="Genres I love: ...\nArtists: ...\nVibe words: ..."
            rows={7}
            className="w-full px-4 py-3 rounded-xl bg-[var(--color-cyber-surface)] border border-[var(--color-cyber-purple)]/15 text-[var(--color-cyber-text)] placeholder:text-[var(--color-cyber-muted)]/40 focus:outline-none focus:border-[var(--color-cyber-purple)]/50 transition-all duration-200 text-sm resize-none font-mono"
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-[var(--color-cyber-cyan)] font-mono">
            {'>'} {t('profile.routines')}
          </h2>
          <textarea
            value={routines}
            onChange={e => setRoutines(e.target.value)}
            placeholder="Morning (7-9): ...\nWork (9-12): ...\nEvening (18-22): ..."
            rows={5}
            className="w-full px-4 py-3 rounded-xl bg-[var(--color-cyber-surface)] border border-[var(--color-cyber-purple)]/15 text-[var(--color-cyber-text)] placeholder:text-[var(--color-cyber-muted)]/40 focus:outline-none focus:border-[var(--color-cyber-purple)]/50 transition-all duration-200 text-sm resize-none font-mono"
          />
        </section>

        <button
          onClick={handleSave}
          onMouseEnter={playHover}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 font-mono ${
            saved
              ? 'bg-[var(--color-cyber-cyan)]/10 text-[var(--color-cyber-cyan)] border border-[var(--color-cyber-cyan)]/30'
              : 'cyber-btn text-white border border-[var(--color-cyber-purple)]/30'
          }`}
          style={!saved ? { background: 'linear-gradient(135deg, var(--color-cyber-purple), #7b00cc)' } : {}}
        >
          {saved ? t('settings.saved') : t('settings.save')}
        </button>

        <div className="p-4 rounded-xl bg-[var(--color-cyber-card)] border border-[var(--color-cyber-purple)]/10 font-mono text-xs text-[var(--color-cyber-muted)] space-y-2">
          <p>{'>'} {t('profile.editHint')}:</p>
          <ul className="space-y-1 text-[var(--color-cyber-cyan)]">
            <li>{'>'} user/taste.md</li>
            <li>{'>'} user/routines.md</li>
            <li>{'>'} user/playlists.json</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
