import { useState } from 'react';
import './YourTurnBanner.css';

/**
 * A propaganda-ticker-style banner that sweeps all the way across the
 * screen, left to right, once, at the start of your own turn -
 * separate from the plain "Your turn" text in the sidebar (turn-
 * indicator in GameBoard.css), which stays put and doesn't animate.
 * GameBoard.tsx mounts a fresh one of these (via a key on
 * currentTurnPlayerId) every time it becomes your turn again, and this
 * unmounts itself once the sweep finishes.
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
