import { NavLink, useLocation } from 'react-router-dom';
import { playClick } from '../hooks/useSound.js';
import { useLanguage } from '../hooks/LanguageContext.jsx';

export default function NavBar() {
  const location = useLocation();
  const { t } = useLanguage();
  const tabs = [
    { to: '/', icon: '🎧', label: t('nav.fm') },
    { to: '/radio', icon: '📻', label: t('nav.radio') },
    { to: '/profile', icon: '🎵', label: t('nav.profile') },
    { to: '/settings', icon: '⚙️', label: t('nav.settings') },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-[var(--color-cyber-surface)]/90 backdrop-blur-md border-t border-[var(--color-cyber-purple)]/20">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {tabs.map(({ to, icon, label }) => {
          const active = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={() => { if (!active) playClick(); }}
              className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 ${
                active
                  ? 'text-[var(--color-cyber-purple)] scale-110'
                  : 'text-[var(--color-cyber-muted)] hover:text-[var(--color-cyber-cyan)]'
              }`}
              style={active ? { textShadow: '0 0 10px var(--color-cyber-purple)' } : {}}
            >
              <span className="text-lg">{icon}</span>
              <span
                className="text-[10px] font-medium whitespace-nowrap"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
