import { useState } from 'react';
import { getTile } from '../data/board';
import { STARTING_PIECES } from '../data/pieces';
import { findCard } from '../data/cards';
import {
  acceptVolgaOfferAndSync,
  acknowledgeCardAndSync,
  buyPropertyAndSync,
  claimTrotskyHidingSpotAndSync,
  declineVolgaOfferAndSync,
  endTurnAndSync,
  rollDiceAndSync,
  skipPurchaseAndSync,
} from '../lib/gameSync';
import type { Room } from '../types/room';
import CardTargetPrompt from './CardTargetPrompt';
import DevPanel from './DevPanel';
import Hand from './Hand';
import NkvdQuizPrompt from './NkvdQuizPrompt';
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
  const pendingTile =
    game.pendingDecision?.type === 'purchase' || game.pendingDecision?.type === 'volgaOffer'
      ? getTile(game.pendingDecision.tileId)
      : null;
  const pendingCard =
    game.pendingDecision?.type === 'cardDrawn' ? findCard(game.pendingDecision.cardId) : null;
  const me = game.players[playerId];
  const canClaimTrotskyHidingSpot =
    isMyTurn && game.trotskyHidingSpot !== null && me?.position === game.trotskyHidingSpot;

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
        {game.trotskyHidingSpot !== null && (
          <p className="trotsky-banner">
            Trotsky is hiding near {getTile(game.trotskyHidingSpot).name} - land there and claim it
            to find out who they are! (Whoever claims it Disappears either way.)
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
              <span className="player-position">
                {getTile(player.position).name}
                {player.inJail ? ' [JAIL]' : ''}
              </span>
            </li>
          );
        })}
      </ul>

      {isMyTurn && !game.pendingDecision && (
        <div className="actions">
          {/* Roll is only available before this turn's first roll, or
              again after doubles ("if you get a double, you get to roll
              again"). Once a non-doubles roll has happened, only End Turn
              shows - otherwise a player could just keep re-rolling
              forever instead of passing the turn. */}
          {(!game.lastRoll || game.lastRollWasDoubles) && (
            <button onClick={handleRoll} disabled={isRolling}>
              {isRolling ? 'Rolling...' : 'Roll Dice'}
            </button>
          )}
          {game.lastRoll && !game.lastRollWasDoubles && (
            <button onClick={() => endTurnAndSync(roomCode, game)}>
              End Turn
            </button>
          )}
          {game.lastRollWasDoubles && (
            <p className="hint">Doubles! Roll again.</p>
          )}
        </div>
      )}

      {isMyTurn && pendingTile && game.pendingDecision?.type === 'purchase' && (
        <div className="purchase-prompt">
          <p>
            Buy {pendingTile.name}
            {'price' in pendingTile ? ` for ₽${pendingTile.price}` : ''}?
          </p>
          <button onClick={() => buyPropertyAndSync(roomCode, game)}>Buy</button>
          <button onClick={() => skipPurchaseAndSync(roomCode, game)}>Skip</button>
        </div>
      )}

      {isMyTurn && pendingTile && game.pendingDecision?.type === 'volgaOffer' && (
        <div className="purchase-prompt">
          <p>
            Give away everything you own to claim {pendingTile.name}? Your
            properties will be split evenly among the other players.
          </p>
          <button onClick={() => acceptVolgaOfferAndSync(roomCode, game)}>
            Give It Up
          </button>
          <button onClick={() => declineVolgaOfferAndSync(roomCode, game)}>
            Decline
          </button>
        </div>
      )}

      {isMyTurn && pendingCard && (
        <div className="purchase-prompt card-prompt">
          <p className="card-title">{pendingCard.title}</p>
          <p>{pendingCard.text}</p>
          <button onClick={() => acknowledgeCardAndSync(roomCode, game)}>
            Continue
          </button>
        </div>
      )}

      {isMyTurn && game.pendingDecision?.type === 'cardTarget' && (
        <CardTargetPrompt
          cardId={game.pendingDecision.cardId}
          room={room}
          roomCode={roomCode}
          playerId={playerId}
          game={game}
        />
      )}

      {isMyTurn && game.pendingDecision?.type === 'nkvdQuiz' && (
        <NkvdQuizPrompt
          questionIndex={game.pendingDecision.questionIndex}
          roomCode={roomCode}
          game={game}
        />
      )}

      {canClaimTrotskyHidingSpot && (
        <div className="purchase-prompt card-prompt">
          <p>Claim to have found Trotsky's hiding place?</p>
          <button onClick={() => claimTrotskyHidingSpotAndSync(roomCode, game)}>
            Claim It
          </button>
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

      <Hand room={room} roomCode={roomCode} playerId={playerId} game={game} />
    </main>
  );
}

export default GameBoard;
