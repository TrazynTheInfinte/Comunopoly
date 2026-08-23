import { useState } from 'react';
import './NowPlayingBanner.css';

interface NowPlayingBannerProps {
  trackName: string;
}

/**
 * A ticker banner that sweeps across the bottom of the screen, left to
 * right, once, whenever a new in-game track actually starts (standard
 * shuffle advancing, or the switch into LMS/final-round music) - see
 * useCurrentGameTrackName. GameBoard.tsx mounts a fresh one of these
 * (via a key on the track name) every time the track changes, and this
 * unmounts itself once the sweep finishes. Same sweep idea as
 * YourTurnBanner, but anchored to the bottom and visually distinct
 * (inverted colors) so the two are never confused for each other.
 */
function NowPlayingBanner({ trackName }: NowPlayingBannerProps) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="now-playing-banner-track">
      <div className="now-playing-banner" onAnimationEnd={() => setVisible(false)}>
        NOW PLAYING: {trackName}
      </div>
    </div>
  );
}

export default NowPlayingBanner;
