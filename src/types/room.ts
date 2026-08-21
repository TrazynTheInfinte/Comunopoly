import type { Timestamp } from 'firebase/firestore';

export interface RoomPlayer {
  name: string;
  // Firestore fills this in on the server once the write lands - it's
  // briefly null in our own optimistic UI state before that happens.
  joinedAt: Timestamp | null;
}

export interface Room {
  code: string;
  createdAt: Timestamp | null;
  players: Record<string, RoomPlayer>;
}
