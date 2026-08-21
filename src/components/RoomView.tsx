import { useEffect, useState } from 'react';
import { subscribeToRoom } from '../lib/rooms';
import type { Room } from '../types/room';
import LobbyScreen from './LobbyScreen';
import GameBoard from './GameBoard';

interface RoomViewProps {
  roomCode: string;
  playerId: string;
}

/**
 * Subscribes to the Room once and decides which screen to show: the
 * pre-game Lobby, or the GameBoard once the host has started the game
 * (i.e. once room.game exists). Both screens are "dumb" - they just
 * render whatever Room data they're handed.
 */
function RoomView({ roomCode, playerId }: RoomViewProps) {
  const [room, setRoom] = useState<Room | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToRoom(roomCode, setRoom);
    return unsubscribe;
  }, [roomCode]);

  if (!room) {
    return <p className="loading">Loading room...</p>;
  }

  return room.game ? (
    <GameBoard room={room} roomCode={roomCode} playerId={playerId} />
  ) : (
    <LobbyScreen room={room} roomCode={roomCode} playerId={playerId} />
  );
}

export default RoomView;
