import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../types/game';

export interface DestructionBurst {
  key: number;
  tileId: number;
}

const BURST_LIFETIME_MS = 900;
let nextBurstKey = 0;

/**
 * Detects tiles newly added to destroyedTileIds by diffing consecutive
 * (already-staged) game snapshots - same technique as useBoardStamps'
 * jail/Disappear detection, since destroyedTileIds only ever grows
 * (Chernobyl exploding), never shrinks, so a length increase always
 * means "these specific tiles just got destroyed." Returns the
 * currently-active one-time explosion bursts to render on the board;
 * the permanent radiation-hazard marker that's left behind afterward
 * is a plain `game.destroyedTileIds.includes(tile.id)` check in
 * Board.tsx, not part of this hook.
 */
export function useDestructionBursts(game: GameState | undefined): DestructionBurst[] {
  const previousRef = useRef<GameState | undefined>(undefined);
  const [bursts, setBursts] = useState<DestructionBurst[]>([]);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = game;
    if (!previous || !game) return;
    if (game.destroyedTileIds.length <= previous.destroyedTileIds.length) return;

    const fresh = game.destroyedTileIds
      .slice(previous.destroyedTileIds.length)
      .map((tileId) => ({ key: nextBurstKey++, tileId }));

    setBursts((current) => [...current, ...fresh]);
    // Each burst removes itself independently of this effect's own
    // lifecycle, same reasoning as useBoardStamps - a fast-moving game
    // shouldn't cancel an already-scheduled removal just because
    // another unrelated update arrives first.
    for (const burst of fresh) {
      setTimeout(() => {
        setBursts((current) => current.filter((b) => b.key !== burst.key));
      }, BURST_LIFETIME_MS);
    }
  }, [game]);

  return bursts;
}
