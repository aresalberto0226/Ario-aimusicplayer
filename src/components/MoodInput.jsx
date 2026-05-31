import { useState, useRef } from 'react';
import { playHover, playClick } from '../hooks/useSound.js';
import { useLanguage } from '../hooks/LanguageContext.jsx';

export default function MoodInput({ onSend, loading }) {
  const [text, setText] = useState('');
  const inputRef = useRef(null);
  const { t } = useLanguage();

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    playClick();
    onSend(trimmed);
    setText('');
    inputRef.current?.focus();
  };

  return (
    <div className="fixed bottom-16 inset-x-0 z-40 bg-gradient-to-t from-[var(--color-cyber-bg)] via-[var(--color-cyber-bg)]/95 to-transparent pt-6 pb-3 px-4">
      <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-lg mx-auto">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t('mood.placeholder')}
            className="w-full px-5 py-3.5 rounded-xl bg-[var(--color-cyber-surface)] border border-[var(--color-cyber-cyan)]/20 text-[var(--color-cyber-text)] placeholder:text-[var(--color-cyber-muted)]/40 focus:outline-none focus:border-[var(--color-cyber-cyan)]/60 focus:ring-1 focus:ring-[var(--color-cyber-cyan)]/20 transition-all duration-200 text-sm font-mono"
            disabled={loading}
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={!text.trim() || loading}
          onMouseEnter={() => { if (text.trim()) playHover(); }}
          className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--color-cyber-cyan)]/10 disabled:bg-[var(--color-cyber-card)] disabled:opacity-30 border border-[var(--color-cyber-cyan)]/20 text-[var(--color-cyber-cyan)] flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 hover:border-[var(--color-cyber-cyan)]/50"
          style={text.trim() ? { boxShadow: '0 0 12px rgba(0,240,255,0.2)' } : {}}
        >
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-[var(--color-cyber-cyan)]/30 border-t-[var(--color-cyber-cyan)] rounded-full animate-spin" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
