import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Room } from '../types/room';

// Room Codes are typed by hand, so we stick to unambiguous uppercase
// letters (no 0/O or 1/I mixups).
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 4;
const MAX_CREATE_ATTEMPTS = 5;

function randomRoomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/**
 * Creates a brand-new Room under a freshly generated Room Code, retrying
 * with a different code on the rare collision. The Firestore security
 * rules - not this function - are what actually stop us from overwriting
 * someone else's room: a write to an existing room's path is rejected as
 * an "update," which our rules only allow if you already knew the code.
 */
export async function createRoom(
  playerId: string,
  playerName: string,
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    const code = randomRoomCode();
    try {
      await setDoc(doc(db, 'rooms', code), {
        code,
        createdAt: serverTimestamp(),
        hostId: playerId,
        players: {
          [playerId]: { name: playerName, joinedAt: serverTimestamp() },
        },
      });
      return code;
    } catch (error) {
      // A permission-denied error here means the security rules rejected
      // the write because a room with this code already exists - try a
      // different code instead of giving up immediately.
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Could not create a room, please try again.');
}

/** Joins an existing Room. Throws if no room has that code. */
export async function joinRoom(
  roomCode: string,
  playerId: string,
  playerName: string,
): Promise<void> {
  const roomRef = doc(db, 'rooms', roomCode);
  const snapshot = await getDoc(roomRef);
  if (!snapshot.exists()) {
    throw new Error(`No room found with code "${roomCode}".`);
  }

  await updateDoc(roomRef, {
    [`players.${playerId}`]: {
      name: playerName,
      joinedAt: serverTimestamp(),
    },
  });
}

/**
 * Subscribes to live updates for a Room. Calls `onChange` immediately
 * with the current data, then again every time anyone's browser writes a
 * change - this is what makes the lobby (and later, the whole game)
 * update on every player's screen at once, with no polling.
 *
 * Returns an `unsubscribe` function. It MUST be called when the caller no
 * longer needs updates (e.g. when a component unmounts), or the
 * subscription keeps running forever and leaks memory/network requests.
 */
export function subscribeToRoom(
  roomCode: string,
  onChange: (room: Room | null) => void,
): () => void {
  const roomRef = doc(db, 'rooms', roomCode);
  return onSnapshot(roomRef, (snapshot) => {
    onChange(snapshot.exists() ? (snapshot.data() as Room) : null);
  });
}
