import { useEffect, useRef } from 'react';
import { startFinalRoundMusic, startGameMusic, startMenuMusic, stopGameMusic, stopMenuMusic } from '../lib/sound';
import type { GameState } from '../types/game';

/**
 * Switches from menu music to the shuffling "standard" in-game tracks
 * the moment GameBoard mounts, then to a single looped "final round"
 * track once the Endgame's final lap begins - and switches back to
 * menu music if this ever unmounts (defensive; nothing currently
 * navigates away from an in-progress game, but the sound engine
 * shouldn't be left thinking a game's still running if that changes).
 */
export function useGameMusic(game: GameState | undefined): void {
  const wasFinalRef = useRef(false);

  useEffect(() => {
    stopMenuMusic();
    startGameMusic();
    return () => {
      stopGameMusic();
      startMenuMusic();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const isFinalLap = !!game?.endgame && !game.endgame.results;
    if (isFinalLap && !wasFinalRef.current) {
      startFinalRoundMusic();
    }
    wasFinalRef.current = isFinalLap;
  }, [game?.endgame]);
}
