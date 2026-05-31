import { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import Player from './views/Player.jsx';
import MyRadio from './views/MyRadio.jsx';
import Profile from './views/Profile.jsx';
import Settings from './views/Settings.jsx';
import NavBar from './components/NavBar.jsx';
import ParticleBg from './components/ParticleBg.jsx';
import CursorTrail from './components/CursorTrail.jsx';
import ImmersiveOverlay from './components/ImmersiveOverlay.jsx';
import useIdleTimer from './hooks/useIdleTimer.js';
import { playerState } from './hooks/PlayerContext.jsx';

export default function App() {
  const [isPlaying, setIsPlaying] = useState(playerState.isPlaying);
  const [immersed, setImmersed] = useState(false);
  const { isIdle, reset } = useIdleTimer(60000, isPlaying);
  const idleRef = useRef(isIdle);
  idleRef.current = isIdle;

  // When idle timer fires while playing → enter immersion
  useEffect(() => {
    if (isIdle && isPlaying && !immersed) {
      setImmersed(true);
    }
  }, [isIdle, isPlaying, immersed]);

  // Track playing state
  useEffect(() => {
    const unsub = playerState.subscribe(data => {
      if (data.type === 'play') setIsPlaying(true);
      if (data.type === 'pause' || data.type === 'end' || data.type === 'stop') {
        setIsPlaying(false);
        setImmersed(false);
      }
    });
    return unsub;
  }, []);

  // Exit immersion ONLY on click
  const handleImmersiveDismiss = () => {
    setImmersed(false);
    reset(); // restart the idle timer
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-cyber-bg)] relative">
      <ParticleBg />
      <CursorTrail />
      <ImmersiveOverlay active={immersed && isPlaying} onDismiss={handleImmersiveDismiss} />
      <div className="relative z-10 flex flex-col h-full">
        <div className="flex-1 min-h-0">
          <Routes>
            <Route path="/" element={<Player mode="free" />} />
            <Route path="/radio" element={<MyRadio />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
        <NavBar />
      </div>
    </div>
  );
}
