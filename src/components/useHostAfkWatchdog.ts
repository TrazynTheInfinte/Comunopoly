import { useEffect, useRef } from 'react';
import { afkSkipTurnAndSync } from '../lib/gameSync';
import { isPlayerAway } from '../lib/presence';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';

// Extra buffer on top of however stale a heartbeat already has to be to
// count as "away" (see lib/presence.ts) - avoids skipping someone the
// instant their heartbeat crosses that threshold on an ordinary hiccup.
// Doubled from the original 15s after early playtest feedback that the
// whole AFK system was too trigger-happy.
const AWAY_GRACE_MS = 30_000;

/**
 * Host-only safety net for a player who's actually disconnected, not
 * just idle at the keyboard - see useAfkSelfCheck for that case, which
 * runs on the idle player's own browser and doesn't need this (a
 * disconnected player's browser obviously can't run anything). Only the
 * host's client runs this watchdog, so there's exactly one writer -
 * no risk of two clients racing to skip the same turn.
 *
 * `game` is GameState | undefined - GameBoard calls this before its own
 * `if (!game) return null` guard (hooks can't be called conditionally),
 * same as useSoundEvents/useGameMusic already do.
 */
export function useHostAfkWatchdog(
  roomCode: string,
  room: Room,
  game: GameState | undefined,
  isHost: boolean,
): void {
  const latestRef = useRef({ roomCode, game });
  latestRef.current = { roomCode, game };

  const currentTurnPlayerId = game?.turnOrder[game.currentTurnIndex];
  const currentPlayer = currentTurnPlayerId ? room.players[currentTurnPlayerId] : undefined;
  const away = !!currentPlayer && isPlayerAway(currentPlayer);

  useEffect(() => {
    if (!isHost || !away) return;
    const timer = setTimeout(() => {
      if (latestRef.current.game) {
        void afkSkipTurnAndSync(latestRef.current.roomCode, latestRef.current.game);
      }
    }, AWAY_GRACE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, away, currentTurnPlayerId]);
}
