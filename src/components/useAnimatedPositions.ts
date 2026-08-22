import { useEffect, useRef, useState } from 'react';
import { BOARD_SIZE } from '../data/board';
import type { GameState } from '../types/game';

const STEP_MS = 160;
// A normal roll (up to double sixes) or Thimble's single die. Anything
// further than this between the old and new position is treated as a
// teleport (jail, Disappear, a big forced "advance to") rather than a
// walk, since there's no way to tell the two apart just by comparing
// start/end tiles - so it snaps instead of animating a lap around the
// board.
const MAX_ANIMATED_STEPS = 12;

/**
 * Tracks a purely presentational "where to draw each token right now"
 * position, separate from the real (authoritative) position in `game`,
 * which this never touches. When a player's real position changes by a
 * normal move's worth of tiles, this steps the displayed position
 * through every tile in between instead of snapping straight there.
 */
export function useAnimatedPositions(game: GameState): Record<string, number> {
  const [displayPositions, setDisplayPositions] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const id of game.turnOrder) initial[id] = game.players[id].position;
    return initial;
  });
  const lastKnown = useRef<Record<string, number>>({ ...displayPositions });
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>[]>>({});

  useEffect(() => {
    for (const id of game.turnOrder) {
      const target = game.players[id].position;
      const prev = lastKnown.current[id];
      lastKnown.current[id] = target;

      if (prev === undefined) {
        // A player we haven't seen before (just joined) - place them, no animation.
        setDisplayPositions((current) => ({ ...current, [id]: target }));
        continue;
      }
      if (prev === target) continue;

      (timers.current[id] ?? []).forEach(clearTimeout);
      timers.current[id] = [];

      const backward = game.players[id].movingBackward;
      const distance = backward
        ? (prev - target + BOARD_SIZE) % BOARD_SIZE
        : (target - prev + BOARD_SIZE) % BOARD_SIZE;

      if (distance === 0 || distance > MAX_ANIMATED_STEPS) {
        setDisplayPositions((current) => ({ ...current, [id]: target }));
        continue;
      }

      let pos = prev;
      for (let step = 1; step <= distance; step++) {
        pos = backward ? (pos - 1 + BOARD_SIZE) % BOARD_SIZE : (pos + 1) % BOARD_SIZE;
        const tileId = pos;
        timers.current[id].push(
          setTimeout(() => {
            setDisplayPositions((current) => ({ ...current, [id]: tileId }));
          }, step * STEP_MS),
        );
      }
    }
    // Only position/movingBackward changes should schedule anything new -
    // re-running this for every unrelated field on `game` would be
    // harmless (the prev===target check skips it) but wasteful, so this
    // intentionally keys off the whole object rather than trying to name
    // every relevant field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  useEffect(() => {
    const timersAtUnmount = timers.current;
    return () => {
      Object.values(timersAtUnmount).flat().forEach(clearTimeout);
    };
  }, []);

  return displayPositions;
}
