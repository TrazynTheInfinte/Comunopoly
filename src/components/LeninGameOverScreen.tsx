import { useEffect } from 'react';
import { STARTING_PIECES } from '../data/pieces';
import { endGameEntirely, startNewMatch } from '../lib/gameSync';
import { leaveRoom } from '../lib/rooms';
import { playEndgameFanfare } from '../lib/sound';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';
import './EndgameResultsScreen.css';

interface LeninGameOverScreenProps {
  room: Room;
  game: GameState;
  roomCode: string;
  playerId: string;
  /** Navigates this browser back to the landing screen - see RoomView's onLeaveRoom. */
  onLeave: () => void;
}

function pieceName(pieceId: string): string {
  return STARTING_PIECES.find((piece) => piece.id === pieceId)?.name ?? pieceId;
}

/**
 * Lenin mode's version of EndgameResultsScreen - shown once
 * game.leninWinnerId is set (only one non-spectating player left).
 * Reuses that screen's CSS since the shape is close, but there's no
 * Score to break down here - classic Monopoly bankruptcy just has a
 * winner and everyone else eliminated along the way.
 */
function LeninGameOverScreen({ room, game, roomCode, playerId, onLeave }: LeninGameOverScreenProps) {
  useEffect(() => {
    playEndgameFanfare();
  }, []);

  const winnerId = game.leninWinnerId;
  if (!winnerId) return null;

  const isHost = room.hostId === playerId;
  const eliminated = game.turnOrder.filter((id) => id !== winnerId && game.players[id]?.isSpectating);

  async function handleLeaveLobby() {
    await leaveRoom(roomCode, playerId);
    onLeave();
  }

  return (
    <main className="endgame-screen">
      <h1 className="endgame-title">Bankruptcy</h1>
      <ul className="endgame-ranking">
        <li className="is-winner">
          <div className="endgame-ranking-row">
            <span className="endgame-rank">#1</span>
            <span className="endgame-name">
              {room.players[winnerId]?.name} ({pieceName(game.players[winnerId].pieceId)})
            </span>
          </div>
          <p className="endgame-score-explainer">Last comrade standing.</p>
        </li>
      </ul>

      {eliminated.length > 0 && (
        <p className="endgame-spectators">
          Eliminated: {eliminated.map((id) => room.players[id]?.name).join(', ')}.
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

export default LeninGameOverScreen;
