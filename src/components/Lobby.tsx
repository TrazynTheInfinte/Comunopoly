import { useEffect, useState } from 'react';
import { subscribeToRoom } from '../lib/rooms';
import type { Room } from '../types/room';
import './Lobby.css';

interface LobbyProps {
  roomCode: string;
  playerId: string;
}

function Lobby({ roomCode, playerId }: LobbyProps) {
  const [room, setRoom] = useState<Room | null>(null);

  // useEffect runs side effects (things that reach outside this
  // component, like a network subscription) after React renders. It runs
  // once here because `[roomCode]` is its dependency list - React only
  // re-runs the effect if roomCode changes between renders. The function
  // we return is React's "cleanup" - it runs before the effect re-runs,
  // and when the component is removed from the screen. That's where we
  // unsubscribe, so leaving the lobby actually stops listening.
  useEffect(() => {
    const unsubscribe = subscribeToRoom(roomCode, setRoom);
    return unsubscribe;
  }, [roomCode]);

  const players = room ? Object.entries(room.players) : [];

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
          </li>
        ))}
        {players.length === 0 && <li>Waiting for players...</li>}
      </ul>
    </main>
  );
}

export default Lobby;
