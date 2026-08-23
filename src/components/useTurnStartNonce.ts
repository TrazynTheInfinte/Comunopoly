import { useEffect, useRef, useState } from 'react';

/**
 * Returns a counter that bumps once each time isMyTurn transitions from
 * false to true - a real rising edge, not just React re-rendering with
 * the same true value it already had. GameBoard keys YourTurnBanner on
 * this instead of on isMyTurn (or currentTurnPlayerId) directly: gating
 * the banner's mount on a live boolean meant any spurious re-render
 * that briefly re-evaluated the same "still my turn" state could
 * flicker the banner back in after it had already finished and
 * vanished. A nonce that only moves on a genuine edge can't do that -
 * once bumped, nothing short of an actual new turn starting bumps it
 * again.
 */
export function useTurnStartNonce(isMyTurn: boolean): number {
  const wasMyTurnRef = useRef(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (isMyTurn && !wasMyTurnRef.current) {
      setNonce((n) => n + 1);
    }
    wasMyTurnRef.current = isMyTurn;
  }, [isMyTurn]);

  return nonce;
}
