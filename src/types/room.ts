import type { Timestamp } from 'firebase/firestore';
import type { GameState } from './game';

export interface RoomPlayer {
  name: string;
  // Firestore fills this in on the server once the write lands - it's
  // briefly null in our own optimistic UI state before that happens.
  joinedAt: Timestamp | null;
}

export interface Room {
  code: string;
  createdAt: Timestamp | null;
  /** The player who created the room - the only one who can start the game or use the dev panel. */
  hostId: string;
  players: Record<string, RoomPlayer>;
  /** Absent while the room is still in its lobby; present once the host starts the game. */
  game?: GameState;
}
