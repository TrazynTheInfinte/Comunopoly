import { useState } from 'react';
import { getTile } from '../data/board';
import { STARTING_PIECES } from '../data/pieces';
import { findCard } from '../data/cards';
import {
  acceptVolgaOfferAndSync,
  accuseOfTrotskyAndSync,
  acknowledgeCardAndSync,
  buyPropertyAndSync,
  declineVolgaOfferAndSync,
  endTurnAndSync,
  rollDiceAndSync,
  skipPurchaseAndSync,
} from '../lib/gameSync';
import type { Room } from '../types/room';
import Board from './Board';
import CardChoicePrompt from './CardChoicePrompt';
import CardTargetPrompt from './CardTargetPrompt';
import CatRedirectPrompt from './CatRedirectPrompt';
import DevPanel from './DevPanel';
import EndgameResultsScreen from './EndgameResultsScreen';
import EndgameTargetPrompt from './EndgameTargetPrompt';
import Hand from './Hand';
import NkvdQuizPrompt from './NkvdQuizPrompt';
import PieceChoicePrompt from './PieceChoicePrompt';
import PieceInfoPanel from './PieceInfoPanel';
import RubberDuckEncounterBanner from './RubberDuckEncounterBanner';
import ShowTrialVoteBanner from './ShowTrialVoteBanner';
import SmuggleOfferPrompt from './SmuggleOfferPrompt';
import './GameBoard.css';

interface GameBoardProps {
  room: Room;
  roomCode: string;
  playerId: string;
}

function pieceName(pieceId: string): string {
  return STARTING_PIECES.find((piece) => piece.id === pieceId)?.name ?? pieceId;
}

// The actual board visual lives in <Board> below; everything in this
// file past that is still the plain functional readout (status, actions,
// decision prompts, event log) - that part isn't a placeholder, it's
// just not meant to be pretty, since decisions need to stay legible.
function GameBoard({ room, roomCode, playerId }: GameBoardProps) {
  const [isRolling, setIsRolling] = useState(false);
  const [accusedId, setAccusedId] = useState('');
  const game = room.game;

  // RoomView only ever renders GameBoard once room.game exists, but
  // TypeScript can't see that from here, so we still need this check to
  // satisfy it (and to bail out safely if it's ever wrong).
  if (!game) return null;

  if (game.endgame?.results) {
    return <EndgameResultsScreen room={room} game={game} />;
  }

  const currentTurnPlayerId = game.turnOrder[game.currentTurnIndex];
  const isMyTurn = currentTurnPlayerId === playerId;
  const pendingTile =
    game.pendingDecision?.type === 'purchase' || game.pendingDecision?.type === 'volgaOffer'
      ? getTile(game.pendingDecision.tileId)
      : null;
  const pendingCard =
    game.pendingDecision?.type === 'cardDrawn' && game.pendingDecision.forPlayerId === playerId
      ? findCard(game.pendingDecision.cardId)
      : null;
  const me = game.players[playerId];
  const myPendingPieceChoice = game.pendingPieceChoices.includes(playerId);
  const myPendingEndgameTarget = game.endgame?.pendingTargetChoices.includes(playerId) ?? false;
  const canAccuseOfTrotsky =
    isMyTurn && game.trotskyHidingSpot !== null && me?.position === game.trotskyHidingSpot;
  const accusableOthers = game.turnOrder.filter((id) => id !== playerId);
  const effectiveAccusedId = accusableOthers.includes(accusedId) ? accusedId : (accusableOthers[0] ?? '');

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
      {me && <PieceInfoPanel pieceId={me.pieceId} />}

      <Board room={room} game={game} />

      <section className="game-status">
        <p className="turn-indicator">
          {isMyTurn
            ? 'Your turn'
            : `${room.players[currentTurnPlayerId]?.name}'s turn`}
        </p>
        {game.lastRoll && (
          <p className="dice-result">
            {game.lastRoll[1] === 0
              ? `Rolled ${game.lastRoll[0]} (one die)`
              : `Rolled ${game.lastRoll[0]} + ${game.lastRoll[1]}${game.lastRollWasDoubles ? ' (doubles!)' : ''}`}
          </p>
        )}
        {game.trotskyHidingSpot !== null && (
          <p className="trotsky-banner">
            Stalin has marked {getTile(game.trotskyHidingSpot).name} - land there to accuse someone
            of being Trotsky. Guess right and they're exposed and Disappear; guess wrong and you go
            to jail instead.
          </p>
        )}
        {game.endgame && !game.endgame.results && (
          <p className="trotsky-banner">
            {game.endgame.pendingTargetChoices.length > 0
              ? "The Piece Pool is empty - everyone's had their final turn. Waiting on Endgame targets."
              : 'The Piece Pool is empty - everyone gets one more turn before the Endgame.'}
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
              <span className="player-roubles">
                ₽{player.roubles}
                {(player.westRoubles > 0 || player.pendingWestRoubles > 0) &&
                  ` (West: ₽${player.westRoubles}${player.pendingWestRoubles > 0 ? ` + ₽${player.pendingWestRoubles} waiting` : ''})`}
              </span>
              <span className="player-position">
                {player.isSpectating ? 'Spectating' : getTile(player.position).name}
                {player.inJail ? ' [JAIL]' : ''}
                {game.pendingPieceChoices.includes(id) ? ' [choosing a new Piece]' : ''}
              </span>
            </li>
          );
        })}
      </ul>

      {myPendingPieceChoice && (
        <PieceChoicePrompt playerId={playerId} roomCode={roomCode} game={game} />
      )}

      {myPendingEndgameTarget && (
        <EndgameTargetPrompt playerId={playerId} room={room} roomCode={roomCode} game={game} />
      )}

      {isMyTurn && !myPendingPieceChoice && !game.pendingDecision && (
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

      {pendingCard && (
        <div className="purchase-prompt card-prompt">
          <p className="card-title">{pendingCard.title}</p>
          <p>{pendingCard.text}</p>
          <button onClick={() => acknowledgeCardAndSync(roomCode, game)}>
            Continue
          </button>
        </div>
      )}

      {isMyTurn && game.pendingDecision?.type === 'cardChoice' && (
        <CardChoicePrompt deck={game.pendingDecision.deck} roomCode={roomCode} game={game} />
      )}

      {isMyTurn && game.pendingDecision?.type === 'smuggleOffer' && (
        <SmuggleOfferPrompt maxAmount={game.pendingDecision.maxAmount} roomCode={roomCode} game={game} />
      )}

      {isMyTurn && game.pendingDecision?.type === 'catRedirect' && (
        <CatRedirectPrompt
          cardId={game.pendingDecision.cardId}
          room={room}
          roomCode={roomCode}
          playerId={playerId}
          game={game}
        />
      )}

      {game.pendingDecision?.type === 'cardTarget' &&
        game.pendingDecision.forPlayerId === playerId && (
          <CardTargetPrompt
            cardId={game.pendingDecision.cardId}
            room={room}
            roomCode={roomCode}
            playerId={playerId}
            game={game}
          />
        )}

      {game.pendingDecision?.type === 'nkvdQuiz' &&
        game.pendingDecision.forPlayerId === playerId && (
          <NkvdQuizPrompt
            questionIndex={game.pendingDecision.questionIndex}
            roomCode={roomCode}
            game={game}
          />
        )}

      <RubberDuckEncounterBanner room={room} roomCode={roomCode} playerId={playerId} game={game} />

      {canAccuseOfTrotsky && (
        <div className="purchase-prompt card-prompt">
          <p>Accuse someone of being Trotsky:</p>
          <select value={effectiveAccusedId} onChange={(event) => setAccusedId(event.target.value)}>
            {accusableOthers.map((id) => (
              <option key={id} value={id}>
                {room.players[id]?.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => accuseOfTrotskyAndSync(roomCode, game, effectiveAccusedId)}
            disabled={!effectiveAccusedId}
          >
            Accuse
          </button>
        </div>
      )}

      <ShowTrialVoteBanner room={room} roomCode={roomCode} playerId={playerId} game={game} />

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
