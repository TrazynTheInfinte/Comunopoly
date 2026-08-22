import { useEffect, useRef, useState } from 'react';
import { playDiceLand, playDiceTick } from '../lib/sound';
import type { GameState } from '../types/game';
import './DiceRoller.css';

interface DiceRollerProps {
  game: GameState;
  /** Bumped by GameBoard the instant the local player clicks Roll Dice - lets the tumble start immediately for them, without waiting on the Firestore round trip that a plain game.lastRoll diff would need. */
  rollTrigger: number;
}

const ROLL_ANIMATION_MS = 600;
const ROLL_TICK_MS = 70;

const PIP_LAYOUTS: Record<number, [number, number][]> = {
  1: [[2, 2]],
  2: [
    [1, 1],
    [3, 3],
  ],
  3: [
    [1, 1],
    [2, 2],
    [3, 3],
  ],
  4: [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ],
  5: [
    [1, 1],
    [1, 3],
    [2, 2],
    [3, 1],
    [3, 3],
  ],
  6: [
    [1, 1],
    [1, 3],
    [2, 1],
    [2, 3],
    [3, 1],
    [3, 3],
  ],
};

function DieFace({ value }: { value: number }) {
  const pips = PIP_LAYOUTS[value] ?? [];
  return (
    <div className="die-face">
      {pips.map(([row, col]) => (
        <span key={`${row}-${col}`} className="die-pip" style={{ gridRow: row, gridColumn: col }} />
      ))}
    </div>
  );
}

/**
 * Rolls 1 die (Thimble's power) or 2, tumbling through random faces for
 * a beat before settling on the real result - reads `game` live (not
 * the staged/delayed version GameBoard otherwise renders), so the dice
 * start tumbling the instant a roll actually happens rather than
 * waiting for the token's walk to finish revealing everything else.
 *
 * Two separate things can start a tumble: the local player clicking
 * Roll Dice (rollTrigger, immediate) and the roll's actual VALUES
 * changing once Firestore delivers the result (covers every other
 * viewer, and re-confirms the real values for the roller too - whoever
 * triggers it, the settle always uses whatever the latest live roll
 * actually is, read fresh rather than captured in a stale closure).
 *
 * Deliberately keyed off the roll's values (a "3-5" style string), not
 * game.lastRoll's object reference - Firestore reconstructs the entire
 * document from scratch on every single snapshot, so lastRoll gets a
 * brand-new array reference on EVERY update, including ones with
 * nothing to do with rolling (buying a property, paying a mortgage,
 * ending a turn...). Keying off the reference replayed the tumble on
 * every unrelated click; keying off the values only replays it when a
 * roll actually happened.
 */
function DiceRoller({ game, rollTrigger }: DiceRollerProps) {
  const currentPlayerId = game.turnOrder[game.currentTurnIndex];
  const diceCount = game.players[currentPlayerId]?.pieceId === 'thimble' ? 1 : 2;
  const rollSignature = game.lastRoll ? `${game.lastRoll[0]}-${game.lastRoll[1]}` : null;

  const [isRolling, setIsRolling] = useState(false);
  const [displayValues, setDisplayValues] = useState<[number, number] | null>(game.lastRoll);
  const latestRollRef = useRef(game.lastRoll);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hasMountedRef = useRef(false);

  // Always keep the latest live roll on hand, so the settle timeout
  // below can read the real (current) value instead of whatever
  // game.lastRoll happened to be when the tumble started.
  useEffect(() => {
    latestRollRef.current = game.lastRoll;
  }, [game.lastRoll]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      // First render - nothing actually happened yet, just show
      // whatever the game's current roll is (or idle dice).
      hasMountedRef.current = true;
      return;
    }

    if (!rollSignature) {
      // The turn ended (lastRoll cleared) - go idle, no tumble.
      clearInterval(intervalRef.current);
      clearTimeout(timeoutRef.current);
      setIsRolling(false);
      setDisplayValues(null);
      return;
    }

    clearInterval(intervalRef.current);
    clearTimeout(timeoutRef.current);

    setIsRolling(true);
    intervalRef.current = setInterval(() => {
      playDiceTick();
      setDisplayValues([
        Math.floor(Math.random() * 6) + 1,
        diceCount === 2 ? Math.floor(Math.random() * 6) + 1 : 0,
      ]);
    }, ROLL_TICK_MS);

    timeoutRef.current = setTimeout(() => {
      clearInterval(intervalRef.current);
      setIsRolling(false);
      setDisplayValues(latestRollRef.current);
      playDiceLand();
    }, ROLL_ANIMATION_MS);
    // rollTrigger (a local click) and rollSignature (the real result
    // landing, or clearing at end of turn) are two different signals
    // that both mean "something rolling-related just happened" - either
    // should (re)start the tumble.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rollTrigger, rollSignature, diceCount]);

  useEffect(() => {
    return () => {
      clearInterval(intervalRef.current);
      clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div className="dice-roller">
      <div className={`dice-roller-dice ${isRolling ? 'is-rolling' : ''}`}>
        {displayValues ? (
          <>
            <DieFace value={displayValues[0]} />
            {diceCount === 2 && <DieFace value={displayValues[1]} />}
          </>
        ) : (
          Array.from({ length: diceCount }).map((_, i) => <div key={i} className="die-face die-face-idle" />)
        )}
      </div>
    </div>
  );
}

export default DiceRoller;
