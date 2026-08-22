import { useEffect, useRef } from 'react';
import { playYourTurn } from '../lib/sound';

/**
 * Plays a chime the moment it becomes this player's own turn - a cue
 * worth having even if you're looking right at the board, but
 * especially useful if you're alt-tabbed. Only fires on a genuine
 * false -> true transition, not on mount (so it doesn't play every
 * time you load into a game that already happens to be your turn, or
 * refresh mid-turn).
 */
export function useYourTurnChime(isMyTurn: boolean): void {
  const wasMyTurnRef = useRef(isMyTurn);

  useEffect(() => {
    const wasMyTurn = wasMyTurnRef.current;
    wasMyTurnRef.current = isMyTurn;
    if (isMyTurn && !wasMyTurn) {
      playYourTurn();
    }
  }, [isMyTurn]);
}
