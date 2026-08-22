import { useState } from 'react';
import { initAudio, isMuted, toggleMuted } from '../lib/sound';
import './SoundToggle.css';

// A persistent mute toggle, rendered on every screen (landing, lobby,
// in-game) - the click that turns sound on doubles as the "real user
// gesture" browsers require before audio is allowed to play at all.
// toggleMuted/setMuted already know whether to resume menu music or an
// in-progress game's music, so this doesn't need to pick.
function SoundToggle() {
  const [muted, setMutedState] = useState(() => isMuted());

  function handleClick() {
    initAudio();
    setMutedState(toggleMuted());
  }

  return (
    <button type="button" className="sound-toggle" onClick={handleClick}>
      {muted ? '🔇 Sound Off' : '🔊 Sound On'}
    </button>
  );
}

export default SoundToggle;
