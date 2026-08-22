import { useEffect, useState } from 'react';
import { subscribeToRoom } from '../lib/rooms';
import type { Room } from '../types/room';
import LobbyScreen from './LobbyScreen';
import GameBoard from './GameBoard';
import { usePresenceHeartbeat } from './usePresenceHeartbeat';

interface RoomViewProps {
  roomCode: string;
  playerId: string;
  /** Called once we're sure this room genuinely doesn't exist (as opposed to just not having loaded yet) - e.g. a stale room code restored from a previous session. Lets App.tsx fall back to the landing screen instead of leaving this stuck on "Loading room...". */
  onRoomNotFound: () => void;
}

/**
 * Subscribes to the Room once and decides which screen to show: the
 * pre-game Lobby, or the GameBoard once the host has started the game
 * (i.e. once room.game exists). Both screens are "dumb" - they just
 * render whatever Room data they're handed.
 */
function RoomView({ roomCode, playerId, onRoomNotFound }: RoomViewProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToRoom(roomCode, (nextRoom) => {
      setRoom(nextRoom);
      setHasLoaded(true);
    });
    return unsubscribe;
  }, [roomCode]);

  // Runs whenever the room genuinely turns out to be missing (not just
  // "still loading") - most commonly a room code restored from a
  // previous session that's since been abandoned/never existed.
  useEffect(() => {
    if (hasLoaded && !room) onRoomNotFound();
  }, [hasLoaded, room, onRoomNotFound]);

  // Stays mounted across the lobby -> game transition (only the child
  // below changes), so this keeps running for as long as this player is
  // anywhere in the room - see lib/presence.ts.
  usePresenceHeartbeat(roomCode, playerId);

  if (!hasLoaded) {
    return <p className="loading">Loading room...</p>;
  }

  if (!room) {
    // onRoomNotFound (above) is about to swap this component out for
    // the landing screen - this is just what shows in the instant
    // before that state update lands.
    return <p className="loading">Room not found - returning to the menu...</p>;
  }

  return room.game ? (
    <GameBoard room={room} roomCode={roomCode} playerId={playerId} />
  ) : (
    <LobbyScreen room={room} roomCode={roomCode} playerId={playerId} />
  );
}

export default RoomView;
