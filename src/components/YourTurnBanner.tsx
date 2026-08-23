import { useState } from 'react';
import './YourTurnBanner.css';

/**
 * A propaganda-ticker-style banner that slides in from the left, holds
 * fully on-screen for a few seconds, then slides out to the right -
 * once, at the start of your own turn. Separate from the plain "Your
 * turn" text in the sidebar (turn-indicator in GameBoard.css), which
 * stays put and doesn't animate. GameBoard.tsx mounts a fresh one of
 * these (via a key on useTurnStartNonce, which only bumps on a real
 * "it just became my turn" edge - not on isMyTurn directly, which
 * could flicker this back in on an unrelated re-render) every time a
 * new turn actually starts, and this unmounts itself once the
 * animation finishes.
 */
function YourTurnBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="your-turn-banner-track">
      <div className="your-turn-banner" onAnimationEnd={() => setVisible(false)}>
        YOUR TURN
      </div>
    </div>
  );
}

export default YourTurnBanner;
