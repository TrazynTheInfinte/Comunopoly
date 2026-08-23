import { useEffect, useState } from 'react';
import { getCurrentGameTrackName, onGameTrackChange } from '../lib/sound';

/** The display name of whichever in-game background track is currently playing (standard or LMS) - null once no game music is active (menu, muted before ever starting, etc.). Drives NowPlayingBanner. */
export function useCurrentGameTrackName(): string | null {
  const [name, setName] = useState(getCurrentGameTrackName());

  useEffect(() => onGameTrackChange(setName), []);

  return name;
}
