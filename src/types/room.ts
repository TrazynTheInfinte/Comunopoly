import type { Timestamp } from 'firebase/firestore';
import type { GameState, PieceId } from './game';

/**
 * Set once by the host at room creation, controlling how Pieces get
 * assigned as players join: "beginner" lets each player pick their own
 * (without seeing its Special Power or Win Condition), "experienced"
 * assigns a random unclaimed Piece automatically.
 */
export type RoomMode = 'beginner' | 'experienced';

export interface RoomPlayer {
  name: string;
  // Firestore fills this in on the server once the write lands - it's
  // briefly null in our own optimistic UI state before that happens.
  joinedAt: Timestamp | null;
  /** Null until chosen (beginner mode) or auto-assigned (experienced mode, immediately on joining). */
  pieceId: PieceId | null;
  /** Client epoch-ms timestamp from this player's own last heartbeat (see lib/presence.ts) - absent for a player who joined before this existed, or hasn't sent one yet. Used to show an "away" indicator, not for anything the game logic depends on. */
  lastSeenAt?: number;
}

export interface Room {
  code: string;
  createdAt: Timestamp | null;
  /** The player who created the room - the only one who can start the game or use the dev panel. */
  hostId: string;
  mode: RoomMode;
  players: Record<string, RoomPlayer>;
  /** Set once by the host at room creation. When true, Disappearing keeps the player's West stash (money smuggled to the West) instead of zeroing it along with everything else - see disappearPlayer in game/engine.ts. Absent (falsy) means the normal rules: a Disappear always fully seizes the West stash too. */
  carryWestOnDisappear?: boolean;
  /** Absent while the room is still in its lobby; present once the host starts the game. */
  game?: GameState;
}
