import { useState } from 'react';
import { getMusicVolume, initAudio, isMuted, setMusicVolume, toggleMuted } from '../lib/sound';
import './SoundToggle.css';

// A persistent mute toggle plus a music volume slider, rendered on
// every screen (landing, lobby, in-game) - the click that turns sound
// on doubles as the "real user gesture" browsers require before audio
// is allowed to play at all. toggleMuted/setMuted already know whether
// to resume menu music or an in-progress game's music, so this doesn't
// need to pick. The slider only affects music (menu or in-game) - sound
// effects stay at their own fixed level.
function SoundToggle() {
  const [muted, setMutedState] = useState(() => isMuted());
  const [volume, setVolume] = useState(() => getMusicVolume());

  function handleToggleClick() {
    initAudio();
    setMutedState(toggleMuted());
  }

  function handleVolumeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = Number(event.target.value) / 100;
    setVolume(next);
    setMusicVolume(next);
  }

  return (
    <div className="sound-toggle">
      <button type="button" onClick={handleToggleClick}>
        {muted ? '🔇 Sound Off' : '🔊 Sound On'}
      </button>
      <label className="sound-volume">
        Music
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={handleVolumeChange}
        />
      </label>
    </div>
  );
}

export default SoundToggle;
