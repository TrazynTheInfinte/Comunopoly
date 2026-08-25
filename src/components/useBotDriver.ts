import { useEffect, useRef } from 'react';
import { botDecisionFingerprint, runBotStep } from '../lib/botAi';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';

// A short pause before each bot action so a bot's turn visibly unfolds
// (roll, then buy, then end turn) instead of resolving in one instant
// Firestore write - "a short thinking delay," per the approved plan.
const BOT_THINKING_DELAY_MS = 1500;

/** Which single bot (if any) currently has something to do - mirrors runBotStep's own priority order, so at most one bot ever acts per tick and two bot writes can never race against the same stale game snapshot. */
function pickActiveBotId(room: Room, game: GameState): string | null {
  const bots = Object.entries(room.players)
    .filter(([, player]) => player.isBot)
    .map(([id]) => id);
  if (bots.length === 0) return null;

  const withPieceChoice = bots.find((id) => game.pendingPieceChoices.includes(id));
  if (withPieceChoice) return withPieceChoice;

  const withEndgameChoice = bots.find((id) => game.endgame?.pendingTargetChoices.includes(id));
  if (withEndgameChoice) return withEndgameChoice;

  const currentTurnPlayerId = game.turnOrder[game.currentTurnIndex];
  const decision = game.pendingDecision;
  if (decision) {
    const forId = 'forPlayerId' in decision ? decision.forPlayerId : currentTurnPlayerId;
    return bots.includes(forId) ? forId : null;
  }

  return bots.includes(currentTurnPlayerId) ? currentTurnPlayerId : null;
}

/**
 * Host-only driver for every bot in the room - one real browser (the
 * host's) has to actually make bots' moves, same single-writer reasoning
 * as useHostAfkWatchdog. `game` is GameState | undefined - GameBoard
 * calls this before its own `if (!game) return null` guard, same as
 * useHostAfkWatchdog/useSoundEvents already do.
 *
 * Stuck-action safety net: tracks the (botId, decision fingerprint,
 * game.log.length) of the last attempt. Every real engine action logs at
 * least one event on success, so if the next tick would repeat the exact
 * same attempt against an unchanged log length, the previous write must
 * have no-op'd (a mismatched guard versus game/engine.ts) - runBotStep is
 * then told to force its guaranteed-effective fallback instead, so a
 * hand-mirrored guard doesn't need to be flawless to avoid ever freezing
 * the game.
 */
export function useBotDriver(
  roomCode: string,
  room: Room,
  game: GameState | undefined,
  isHost: boolean,
): void {
  const latestRef = useRef({ roomCode, room, game });
  latestRef.current = { roomCode, room, game };

  const lastAttemptRef = useRef<{ botId: string; fingerprint: string; logLength: number } | null>(null);

  const activeBotId = game ? pickActiveBotId(room, game) : null;

  useEffect(() => {
    if (!isHost || !activeBotId || !game) return;
    const timer = setTimeout(() => {
      const { roomCode: latestRoomCode, room: latestRoom, game: latestGame } = latestRef.current;
      if (!latestGame) return;
      const botId = pickActiveBotId(latestRoom, latestGame);
      if (!botId) return;

      const fingerprint = botDecisionFingerprint(latestGame, botId);
      const last = lastAttemptRef.current;
      const forceFallback =
        !!last &&
        last.botId === botId &&
        last.fingerprint === fingerprint &&
        last.logLength === latestGame.log.length;
      lastAttemptRef.current = { botId, fingerprint, logLength: latestGame.log.length };

      const difficulty = latestRoom.players[botId]?.botDifficulty ?? 'normal';
      void runBotStep(latestRoomCode, latestGame, botId, difficulty, forceFallback);
    }, BOT_THINKING_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, activeBotId, game?.log.length]);
}
