import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../types/game';

export interface BoardStamp {
  key: number;
  playerId: string;
  kind: 'jail' | 'disappear';
  tileId: number;
}

const STAMP_LIFETIME_MS = 1400;
let nextStampKey = 0;

/**
 * Detects the moment a player gets jailed or Disappears by diffing
 * consecutive (already-staged) game snapshots, and returns the
 * currently-active poster-stamp overlays to render on the board.
 *
 * Diffs actual state transitions rather than parsing game.log text -
 * unlike useSoundEvents, which can get away with log-text matching
 * because a sound effect doesn't need to be positioned over anyone,
 * most jail/Disappear log lines don't actually name who it happened
 * to (they're written from "the acting player's" perspective, e.g.
 * "Rolled doubles three times - sent to jail!").
 *
 * A Disappear is detected via retiredPieceIds growing rather than a
 * player's own fields changing, since disappearPlayer resets position/
 * roubles/etc. but deliberately leaves pieceId alone until the player
 * actually picks a replacement - the newly-retired piece ID still
 * belongs to whoever just Disappeared at the moment this runs.
 */
export function useBoardStamps(game: GameState | undefined): BoardStamp[] {
  const previousRef = useRef<GameState | undefined>(undefined);
  const [stamps, setStamps] = useState<BoardStamp[]>([]);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = game;
    if (!previous || !game) return;

    const fresh: BoardStamp[] = [];

    for (const playerId of game.turnOrder) {
      const prevPlayer = previous.players[playerId];
      const nextPlayer = game.players[playerId];
      if (prevPlayer && nextPlayer && !prevPlayer.inJail && nextPlayer.inJail) {
        fresh.push({ key: nextStampKey++, playerId, kind: 'jail', tileId: nextPlayer.position });
      }
    }

    if (game.retiredPieceIds.length > previous.retiredPieceIds.length) {
      for (const pieceId of game.retiredPieceIds.slice(previous.retiredPieceIds.length)) {
        const playerId = game.turnOrder.find((id) => game.players[id].pieceId === pieceId);
        if (!playerId) continue;
        fresh.push({
          key: nextStampKey++,
          playerId,
          kind: 'disappear',
          tileId: previous.players[playerId]?.position ?? 0,
        });
      }
    }

    if (fresh.length === 0) return;

    setStamps((current) => [...current, ...fresh]);
    // Each stamp removes itself independently of this effect's own
    // lifecycle - a fast-moving multiplayer game triggers this effect
    // constantly, and cancelling an already-scheduled removal just
    // because another update arrived would leave old stamps stuck.
    for (const stamp of fresh) {
      setTimeout(() => {
        setStamps((current) => current.filter((s) => s.key !== stamp.key));
      }, STAMP_LIFETIME_MS);
    }
  }, [game]);

  return stamps;
}
