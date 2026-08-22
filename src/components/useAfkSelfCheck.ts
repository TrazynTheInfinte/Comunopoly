import { useEffect, useRef, useState } from 'react';
import { afkSkipTurnAndSync, confirmStillHereAndSync } from '../lib/gameSync';
import { playAfkAlert } from '../lib/sound';
import type { GameState } from '../types/game';

// Doubled from the original 30s/10s after early playtest feedback that
// this was too trigger-happy.
const IDLE_BEFORE_PROMPT_MS = 60_000;
const RESPONSE_WINDOW_MS = 20_000;

export interface AfkPrompt {
  /** Whether the "are you still there?" prompt should currently be shown. */
  visible: boolean;
  /** Seconds left to respond before this player's own turn gets auto-skipped. */
  secondsLeft: number;
  /** Dismisses the prompt and clears the away-skip streak - call from the prompt's "Yes, I'm here" button. */
  confirmStillHere: () => void;
}

/**
 * Watches whether it's actually this player's turn and, if 30s pass
 * with nothing happening, shows a "still there?" prompt with a 10s
 * response window - not answering skips this player's own turn
 * automatically (afkSkipTurn). Deliberately entirely client-side and
 * self-driven: this player's own browser runs the timer and (if
 * unanswered) writes the skip, so there's no risk of two different
 * clients racing to skip the same turn - see useHostAfkWatchdog for
 * the complementary case of a player who's actually disconnected
 * rather than just idle at the keyboard.
 *
 * `game` is GameState | undefined - GameBoard calls this before its own
 * `if (!game) return null` guard (hooks can't be called conditionally),
 * same as useSoundEvents/useGameMusic already do. Just treats "no game
 * yet" the same as "not this player's turn."
 */
export function useAfkSelfCheck(
  roomCode: string,
  game: GameState | undefined,
  playerId: string,
  isMyTurn: boolean,
): AfkPrompt {
  const [visible, setVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(RESPONSE_WINDOW_MS / 1000));
  // Always holds the latest game/roomCode, so the timers below (which
  // deliberately don't restart on every unrelated game update, only on
  // a real "fresh turn" signal) still act on current data when they
  // eventually fire, not a stale snapshot from whenever they were set.
  const latestRef = useRef({ roomCode, game });
  latestRef.current = { roomCode, game };

  // Resets whenever it's freshly this player's turn, or they roll again
  // mid-turn (doubles) - both are "something just happened" signals
  // that a genuinely idle/away player wouldn't produce.
  const turnKey = `${isMyTurn}:${game?.lastRoll?.join(',') ?? 'none'}`;

  useEffect(() => {
    setVisible(false);
    if (!isMyTurn || !game) return;
    const timer = setTimeout(() => {
      setVisible(true);
      playAfkAlert();
    }, IDLE_BEFORE_PROMPT_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnKey]);

  useEffect(() => {
    if (!visible) {
      setSecondsLeft(Math.ceil(RESPONSE_WINDOW_MS / 1000));
      return;
    }
    const deadline = Date.now() + RESPONSE_WINDOW_MS;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        setVisible(false);
        if (latestRef.current.game) {
          void afkSkipTurnAndSync(latestRef.current.roomCode, latestRef.current.game);
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, [visible]);

  function confirmStillHere() {
    setVisible(false);
    if (latestRef.current.game) {
      void confirmStillHereAndSync(latestRef.current.roomCode, latestRef.current.game, playerId);
    }
  }

  return { visible, secondsLeft, confirmStillHere };
}
