import { useState } from 'react';
import { getTile } from '../data/board';
import { STARTING_PIECES } from '../data/pieces';
import {
  buyPropertyAndSync,
  endTurnAndSync,
  rollDiceAndSync,
  skipPurchaseAndSync,
} from '../lib/gameSync';
import type { Room } from '../types/room';
import DevPanel from './DevPanel';
import './GameBoard.css';

interface GameBoardProps {
  room: Room;
  roomCode: string;
  playerId: string;
}

function pieceName(pieceId: string): string {
  return STARTING_PIECES.find((piece) => piece.id === pieceId)?.name ?? pieceId;
}

// This is deliberately plain - a functional board-state readout, not the
// 2.5D board art. Getting the rules right comes first; the visual board
// is a separate, later pass over just this component.
function GameBoard({ room, roomCode, playerId }: GameBoardProps) {
  const [isRolling, setIsRolling] = useState(false);
  const game = room.game;

  // RoomView only ever renders GameBoard once room.game exists, but
  // TypeScript can't see that from here, so we still need this check to
  // satisfy it (and to bail out safely if it's ever wrong).
  if (!game) return null;

  const currentTurnPlayerId = game.turnOrder[game.currentTurnIndex];
  const isMyTurn = currentTurnPlayerId === playerId;
  const pendingTile = game.pendingDecision
    ? getTile(game.pendingDecision.tileId)
    : null;

  const isDevPanelUnlocked =
    playerId === room.hostId &&
    room.players[playerId]?.name.trim().toLowerCase() === 'comrade stalin';

  async function handleRoll() {
    setIsRolling(true);
    try {
      await rollDiceAndSync(roomCode, game!);
    } finally {
      setIsRolling(false);
    }
  }

  return (
    <main className="game-board">
      <section className="game-status">
        <p className="turn-indicator">
          {isMyTurn
            ? 'Your turn'
            : `${room.players[currentTurnPlayerId]?.name}'s turn`}
        </p>
        {game.lastRoll && (
          <p className="dice-result">
            Rolled {game.lastRoll[0]} + {game.lastRoll[1]}
            {game.lastRollWasDoubles ? ' (doubles!)' : ''}
          </p>
        )}
      </section>

      <ul className="player-summary">
        {game.turnOrder.map((id) => {
          const player = game.players[id];
          return (
            <li key={id} className={id === currentTurnPlayerId ? 'is-current' : ''}>
              <span className="player-name">
                {room.players[id]?.name} ({pieceName(player.pieceId)})
              </span>
              <span className="player-roubles">₽{player.roubles}</span>
              <span className="player-position">{getTile(player.position).name}</span>
            </li>
          );
        })}
      </ul>

      {isMyTurn && !game.pendingDecision && (
        <div className="actions">
          <button onClick={handleRoll} disabled={isRolling}>
            {isRolling ? 'Rolling...' : 'Roll Dice'}
          </button>
          {game.lastRoll && !game.lastRollWasDoubles && (
            <button onClick={() => endTurnAndSync(roomCode, game)}>
              End Turn
            </button>
          )}
          {game.lastRoll && game.lastRollWasDoubles && (
            <p className="hint">Doubles! Roll again.</p>
          )}
        </div>
      )}

      {isMyTurn && pendingTile && (
        <div className="purchase-prompt">
          <p>
            Buy {pendingTile.name}
            {'price' in pendingTile ? ` for ₽${pendingTile.price}` : ''}?
          </p>
          <button onClick={() => buyPropertyAndSync(roomCode, game)}>Buy</button>
          <button onClick={() => skipPurchaseAndSync(roomCode, game)}>Skip</button>
        </div>
      )}

      <ul className="event-log">
        {game.log
          .slice()
          .reverse()
          .map((entry, index) => (
            <li key={index}>{entry}</li>
          ))}
      </ul>

      {isDevPanelUnlocked && (
        <DevPanel room={room} roomCode={roomCode} game={game} />
      )}
    </main>
  );
}

export default GameBoard;
