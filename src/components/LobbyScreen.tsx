import { STARTING_PIECES } from '../data/pieces';
import { startGame } from '../lib/gameSync';
import type { Room } from '../types/room';
import './LobbyScreen.css';

interface LobbyScreenProps {
  room: Room;
  roomCode: string;
  playerId: string;
}

function LobbyScreen({ room, roomCode, playerId }: LobbyScreenProps) {
  const players = Object.entries(room.players);
  const isHost = room.hostId === playerId;

  function handleStartGame() {
    // Deal out the starting Pieces in join order. Once all 15 exist,
    // this is where a real piece-picking screen replaces the auto-deal.
    const assignments = players.map(([id], index) => ({
      playerId: id,
      pieceId: STARTING_PIECES[index % STARTING_PIECES.length].id,
    }));
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
            {player.name}
            {id === playerId ? ' (you)' : ''}
            {id === room.hostId ? ' ★' : ''}
          </li>
        ))}
        {players.length === 0 && <li>Waiting for players...</li>}
      </ul>

      {isHost && (
        <button onClick={handleStartGame} disabled={players.length === 0}>
          Start Game
        </button>
      )}
    </main>
  );
}

export default LobbyScreen;
