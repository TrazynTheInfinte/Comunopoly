import { useEffect, type CSSProperties } from 'react';
import type { CardDeck } from '../types/game';
import './FlyingCard.css';

const FLIGHT_DURATION_MS = 500;

interface FlyingCardProps {
  deck: CardDeck;
  from: DOMRect;
  to: DOMRect;
  onDone: () => void;
}

/**
 * A purely cosmetic overlay: a small card-shaped rectangle animating
 * from a deck pile's on-screen position (captured the instant it was
 * clicked - see Board.tsx's onDeckClick) to wherever the real reveal
 * panel appears (GameBoard.tsx's layoutActionsRef), landing at roughly
 * the same time the real panel's own flip-in animation takes over.
 * Deliberately not synced to the actual Firestore round-trip that
 * reveals the drawn card - this plays immediately on click, optimistic-
 * UI style, since waiting for the network would make the click feel
 * laggy instead of responsive.
 *
 * `from`/`to` are plain DOMRects (numbers captured once), not element
 * refs - this overlay is `position: fixed` and animates purely via CSS
 * custom properties, so it keeps flying correctly across the full
 * viewport even if the source (the board) scrolls out of view or a
 * mobile tab switch hides it mid-flight.
 */
function FlyingCard({ deck, from, to, onDone }: FlyingCardProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, FLIGHT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  const style = {
    '--flying-card-start-x': `${from.left + from.width / 2}px`,
    '--flying-card-start-y': `${from.top + from.height / 2}px`,
    '--flying-card-end-x': `${to.left + to.width / 2}px`,
    '--flying-card-end-y': `${to.top + to.height / 2}px`,
  } as CSSProperties;

  return (
    <div className={`flying-card flying-card-${deck}`} style={style}>
      {deck === 'communistTest' ? 'Communist Test' : 'No Chance'}
    </div>
  );
}

export default FlyingCard;
