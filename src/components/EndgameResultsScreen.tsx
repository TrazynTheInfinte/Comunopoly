import { useEffect, useState } from 'react';
import { STARTING_PIECES } from '../data/pieces';
import { endGameEntirely, startNewMatch } from '../lib/gameSync';
import { leaveRoom } from '../lib/rooms';
import { playEndgameFanfare } from '../lib/sound';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';
import './EndgameResultsScreen.css';

interface EndgameResultsScreenProps {
  room: Room;
  game: GameState;
  roomCode: string;
  playerId: string;
  /** Navigates this browser back to the landing screen - see RoomView's onLeaveRoom. Back to Lobby/New Match don't need to call this directly; both just write a change to the Room that every connected client (host included) already picks up reactively. */
  onLeave: () => void;
}

function pieceOf(pieceId: string) {
  return STARTING_PIECES.find((piece) => piece.id === pieceId);
}

// Shown once every Score is in (game.endgame.results is set) - replaces
// the board entirely, since the game is genuinely over at this point.
function EndgameResultsScreen({ room, game, roomCode, playerId, onLeave }: EndgameResultsScreenProps) {
  // GameBoard only ever mounts this component once results already
  // exist (it's the condition that renders it in the first place), so
  // this only ever needs to fire once, on mount.
  useEffect(() => {
    playEndgameFanfare();
  }, []);

  const results = game.endgame?.results;
  // Which ranked entries have been clicked to reveal the literal Score
  // formula, in place of the plain-English summary shown by default -
  // players wanted to know what actually drove the number up first,
  // and could dig into the exact (often deliberately wordy/in-fiction)
  // wording after, rather than the other way around.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (!results) return null;

  const isHost = room.hostId === playerId;
  const ranked = Object.entries(results).sort(([, a], [, b]) => b - a);
  const spectators = game.turnOrder.filter((id) => game.players[id]?.isSpectating);

  function toggleExpanded(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleLeaveLobby() {
    await leaveRoom(roomCode, playerId);
    onLeave();
  }

  return (
    <main className="endgame-screen">
      <h1 className="endgame-title">Endgame</h1>
      <ul className="endgame-ranking">
        {ranked.map(([id, score], index) => {
          const piece = pieceOf(game.players[id].pieceId);
          const isExpanded = expandedIds.has(id);
          return (
            <li key={id} className={index === 0 ? 'is-winner' : ''}>
              <div className="endgame-ranking-row">
                <span className="endgame-rank">#{index + 1}</span>
                <span className="endgame-name">
                  {room.players[id]?.name} ({piece?.name ?? game.players[id].pieceId})
                </span>
                <button
                  type="button"
                  className="endgame-score"
                  onClick={() => toggleExpanded(id)}
                  aria-expanded={isExpanded}
                >
                  {score}
                </button>
              </div>
              {piece && (
                <p className="endgame-score-explainer">
                  {isExpanded ? piece.winConditionDescription : piece.winConditionSummary}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {spectators.length > 0 && (
        <p className="endgame-spectators">
          Disappeared with no Piece left to take: {spectators.map((id) => room.players[id]?.name).join(', ')}.
          No Score - out of the running.
        </p>
      )}

      <div className="endgame-actions">
        {isHost && (
          <>
            <button onClick={() => endGameEntirely(roomCode)}>Back to Lobby</button>
            <button onClick={() => startNewMatch(roomCode, room)}>New Match</button>
          </>
        )}
        <button onClick={handleLeaveLobby}>Leave Lobby</button>
      </div>
    </main>
  );
}

export default EndgameResultsScreen;
