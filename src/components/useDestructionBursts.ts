import { useEffect, useRef, useState } from 'react';
import { playExplosion } from '../lib/sound';
import type { GameState } from '../types/game';

export interface DestructionBurst {
  key: number;
  tileId: number;
}

const BURST_LIFETIME_MS = 900;
// Beat between each destroyed tile's own explosion sound when several
// go up at once, so it reads as a rolling series of distant booms
// instead of one synchronized (and unrealistically loud) blast.
const EXPLOSION_STAGGER_MS = 220;
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
 * Board.tsx, not part of this hook. Also plays one playExplosion per
 * newly-destroyed tile, staggered - see EXPLOSION_STAGGER_MS.
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
    // Each burst removes itself (and plays its own explosion sound)
    // independently of this effect's own lifecycle, same reasoning as
    // useBoardStamps - a fast-moving game shouldn't cancel an already-
    // scheduled removal just because another unrelated update arrives
    // first.
    fresh.forEach((burst, index) => {
      setTimeout(() => playExplosion(), index * EXPLOSION_STAGGER_MS);
      setTimeout(() => {
        setBursts((current) => current.filter((b) => b.key !== burst.key));
      }, BURST_LIFETIME_MS);
    });
  }, [game]);

  return bursts;
}
