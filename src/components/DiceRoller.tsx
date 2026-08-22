import { useEffect, useRef, useState } from 'react';
import type { GameState } from '../types/game';
import './DiceRoller.css';

interface DiceRollerProps {
  game: GameState;
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
 */
function DiceRoller({ game }: DiceRollerProps) {
  const currentPlayerId = game.turnOrder[game.currentTurnIndex];
  const diceCount = game.players[currentPlayerId]?.pieceId === 'thimble' ? 1 : 2;

  const [isRolling, setIsRolling] = useState(false);
  const [displayValues, setDisplayValues] = useState<[number, number] | null>(game.lastRoll);
  const prevRollRef = useRef(game.lastRoll);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const prevRoll = prevRollRef.current;
    prevRollRef.current = game.lastRoll;

    clearInterval(intervalRef.current);
    clearTimeout(timeoutRef.current);

    if (game.lastRoll === prevRoll) return;

    if (!game.lastRoll) {
      setIsRolling(false);
      setDisplayValues(null);
      return;
    }

    setIsRolling(true);
    intervalRef.current = setInterval(() => {
      setDisplayValues([
        Math.floor(Math.random() * 6) + 1,
        diceCount === 2 ? Math.floor(Math.random() * 6) + 1 : 0,
      ]);
    }, ROLL_TICK_MS);

    const finalRoll = game.lastRoll;
    timeoutRef.current = setTimeout(() => {
      clearInterval(intervalRef.current);
      setIsRolling(false);
      setDisplayValues(finalRoll);
    }, ROLL_ANIMATION_MS);
  }, [game.lastRoll, diceCount]);

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
