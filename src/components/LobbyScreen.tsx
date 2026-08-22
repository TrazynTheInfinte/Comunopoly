import { useState } from 'react';
import { STARTING_PIECES } from '../data/pieces';
import { startGame } from '../lib/gameSync';
import { isPlayerAway } from '../lib/presence';
import { choosePiece } from '../lib/rooms';
import type { PieceId } from '../types/game';
import type { Room } from '../types/room';
import './LobbyScreen.css';

interface LobbyScreenProps {
  room: Room;
  roomCode: string;
  playerId: string;
}

function pieceName(pieceId: PieceId): string {
  return STARTING_PIECES.find((piece) => piece.id === pieceId)?.name ?? pieceId;
}

function LobbyScreen({ room, roomCode, playerId }: LobbyScreenProps) {
  const [error, setError] = useState('');
  const players = Object.entries(room.players);
  const isHost = room.hostId === playerId;
  const me = room.players[playerId];
  const claimedPieceIds = players.map(([, player]) => player.pieceId);
  const everyoneHasAPiece = players.every(([, player]) => player.pieceId !== null);

  async function handleChoosePiece(pieceId: PieceId) {
    setError('');
    try {
      await choosePiece(roomCode, playerId, pieceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }

  function handleStartGame() {
    const assignments = players
      .filter(([, player]) => player.pieceId !== null)
      .map(([id, player]) => ({ playerId: id, pieceId: player.pieceId! }));
    void startGame(roomCode, assignments);
  }

  return (
    <main className="lobby">
      <p className="lobby-label">Room Code</p>
      <h1 className="lobby-code">{roomCode}</h1>
      <p className="lobby-hint">Send this code to your comrades.</p>

      <ul className="player-list">
        {players.map(([id, player]) => (
          <li key={id} className={id === playerId ? 'is-you' : ''}>
            <span className={`presence-dot ${isPlayerAway(player) ? 'is-away' : ''}`} title={isPlayerAway(player) ? 'Away' : 'Online'} />
            {player.name}
            {id === playerId ? ' (you)' : ''}
            {id === room.hostId ? ' ★' : ''}
            {player.pieceId
              ? ` - ${pieceName(player.pieceId)}`
              : ' - choosing...'}
          </li>
        ))}
        {players.length === 0 && <li>Waiting for players...</li>}
      </ul>

      {room.mode === 'beginner' && me && !me.pieceId && (
        <div className="piece-picker">
          <p className="lobby-hint">
            Choose your Piece - its Special Power and Win Condition stay hidden until the game starts.
          </p>
          <ul className="piece-picker-list">
            {STARTING_PIECES.map((piece) => {
              const taken = claimedPieceIds.includes(piece.id);
              return (
                <li key={piece.id}>
                  <button
                    type="button"
                    disabled={taken}
                    onClick={() => handleChoosePiece(piece.id)}
                  >
                    {piece.name}
                    <span className="piece-picker-title">{piece.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {isHost && (
        <button onClick={handleStartGame} disabled={players.length === 0 || !everyoneHasAPiece}>
          Start Game
        </button>
      )}
      {isHost && players.length > 0 && !everyoneHasAPiece && (
        <p className="lobby-hint">Waiting for everyone to have a Piece.</p>
      )}
    </main>
  );
}

export default LobbyScreen;
