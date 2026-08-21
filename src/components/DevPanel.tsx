import { useState } from 'react';
import { BOARD } from '../data/board';
import { ALL_CARDS, findCard } from '../data/cards';
import {
  devDrawCardAndSync,
  devJumpToTileAndSync,
  devSetForcedCardAndSync,
  devSetForcedRollAndSync,
  devSetRoublesAndSync,
} from '../lib/gameSync';
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
  const [jumpTileId, setJumpTileId] = useState(0);

  return (
    <section className="dev-panel">
      <p className="dev-panel-title">Dev Panel</p>

      <div className="dev-panel-section">
        <p>Set player roubles</p>
        {game.turnOrder.map((id) => (
          <div key={id} className="dev-panel-row">
            <label>
              {room.players[id]?.name}
              {/* Only meaningful while a Fourth International is active -
                  isTrotsky is stale/irrelevant once it resolves. */}
              {game.trotskyHidingSpot !== null &&
                ` (${game.players[id].isTrotsky ? 'Trotsky' : 'Notsky'})`}
            </label>
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

      <div className="dev-panel-section">
        <p>Force next card draw</p>
        <div className="dev-panel-row">
          <select
            value={game.forcedCardId ?? ''}
            onChange={(event) =>
              devSetForcedCardAndSync(roomCode, game, event.target.value || null)
            }
          >
            <option value="">(none - draw normally)</option>
            {ALL_CARDS.map((card) => (
              <option key={card.id} value={card.id}>
                [{card.deck === 'communistTest' ? 'CT' : 'NC'}] {card.title}
              </option>
            ))}
          </select>
        </div>
        {game.forcedCardId && (
          <p className="hint">Next card draw forced to "{findCard(game.forcedCardId).title}"</p>
        )}
      </div>

      <div className="dev-panel-section">
        <p>Jump to a space (resolves landing on it, no rolling)</p>
        <div className="dev-panel-row">
          <select value={jumpTileId} onChange={(event) => setJumpTileId(Number(event.target.value))}>
            {BOARD.map((tile) => (
              <option key={tile.id} value={tile.id}>
                {tile.id}: {tile.name}
              </option>
            ))}
          </select>
          <button onClick={() => devJumpToTileAndSync(roomCode, game, jumpTileId)}>Jump</button>
        </div>
      </div>

      <div className="dev-panel-section">
        <p>Force draw a card right now (any space)</p>
        <div className="dev-panel-row">
          <button onClick={() => devDrawCardAndSync(roomCode, game, 'communistTest')}>
            Draw Communist Test
          </button>
          <button onClick={() => devDrawCardAndSync(roomCode, game, 'noChance')}>
            Draw No Chance
          </button>
        </div>
        <p className="hint">Uses the forced card above if one's set, otherwise a real draw.</p>
      </div>
    </section>
  );
}

export default DevPanel;
