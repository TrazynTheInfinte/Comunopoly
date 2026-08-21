import { useState } from 'react';
import { devSetForcedRollAndSync, devSetRoublesAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';
import './DevPanel.css';

interface DevPanelProps {
  room: Room;
  roomCode: string;
  game: GameState;
}

// Only reachable by naming yourself "Comrade Stalin" while hosting - see
// the gating check in GameBoard.tsx. Lets us jump straight to an
// interesting game state (a specific roll, a player low on money) instead
// of grinding turns to reach it by hand.
function DevPanel({ room, roomCode, game }: DevPanelProps) {
  const [forcedDie1, setForcedDie1] = useState('');
  const [forcedDie2, setForcedDie2] = useState('');

  return (
    <section className="dev-panel">
      <p className="dev-panel-title">Dev Panel</p>

      <div className="dev-panel-section">
        <p>Set player roubles</p>
        {game.turnOrder.map((id) => (
          <div key={id} className="dev-panel-row">
            <label>{room.players[id]?.name}</label>
            <input
              type="number"
              defaultValue={game.players[id].roubles}
              onBlur={(event) =>
                devSetRoublesAndSync(
                  roomCode,
                  game,
                  id,
                  Number(event.target.value),
                )
              }
            />
          </div>
        ))}
      </div>

      <div className="dev-panel-section">
        <p>Force next roll</p>
        <div className="dev-panel-row">
          <input
            type="number"
            min={1}
            max={6}
            placeholder="Die 1"
            value={forcedDie1}
            onChange={(event) => setForcedDie1(event.target.value)}
          />
          <input
            type="number"
            min={1}
            max={6}
            placeholder="Die 2"
            value={forcedDie2}
            onChange={(event) => setForcedDie2(event.target.value)}
          />
          <button
            onClick={() =>
              devSetForcedRollAndSync(roomCode, game, [
                Number(forcedDie1) || 1,
                Number(forcedDie2) || 1,
              ])
            }
          >
            Set
          </button>
          <button onClick={() => devSetForcedRollAndSync(roomCode, game, null)}>
            Clear
          </button>
        </div>
        {game.forcedRoll && (
          <p className="hint">
            Next roll forced to {game.forcedRoll[0]} + {game.forcedRoll[1]}
          </p>
        )}
      </div>
    </section>
  );
}

export default DevPanel;
