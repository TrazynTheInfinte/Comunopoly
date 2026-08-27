import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { LENIN_PIECE_IDS, STARTING_PIECES } from '../data/pieces';
import { randomBotName } from './botNames';
import type { PieceId } from '../types/game';
import type { Room, RoomMode, RulesetMode } from '../types/room';

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

/** Picks a random Piece not already claimed by anyone in the room - null if none are left. `allowedPieceIds` narrows the Pool (Lenin mode's curated subset, LENIN_PIECE_IDS - see data/pieces.ts for why); omit for the full 12. Exported for startNewMatch (gameSync.ts), which assigns one to every current player the same way experienced-mode joining already does. */
export function pickAvailablePiece(
  claimedPieceIds: (PieceId | null)[],
  allowedPieceIds: PieceId[] = STARTING_PIECES.map((piece) => piece.id),
): PieceId | null {
  const available = allowedPieceIds.filter((id) => !claimedPieceIds.includes(id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
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
  mode: RoomMode,
  carryWestOnDisappear: boolean = false,
  rulesetMode: RulesetMode = 'stalin',
): Promise<string> {
  let lastError: unknown;

  // In experienced mode the host (the only player who exists yet) gets a
  // random Piece immediately, same as anyone else joining an experienced
  // room. In beginner mode nobody has a Piece until they pick one.
  const pieceId =
    mode === 'experienced' ? pickAvailablePiece([], rulesetMode === 'lenin' ? LENIN_PIECE_IDS : undefined) : null;

  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    const code = randomRoomCode();
    try {
      await setDoc(doc(db, 'rooms', code), {
        code,
        createdAt: serverTimestamp(),
        hostId: playerId,
        mode,
        rulesetMode,
        carryWestOnDisappear,
        players: {
          [playerId]: { name: playerName, joinedAt: serverTimestamp(), pieceId },
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

/** Joins an existing Room. Throws if no room has that code. In experienced mode this also assigns a random unclaimed Piece; in beginner mode the player picks their own later (see choosePiece). */
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

  const room = snapshot.data() as Room;
  const claimedPieceIds = Object.values(room.players).map((player) => player.pieceId);
  const pieceId =
    room.mode === 'experienced'
      ? pickAvailablePiece(claimedPieceIds, room.rulesetMode === 'lenin' ? LENIN_PIECE_IDS : undefined)
      : null;

  await updateDoc(roomRef, {
    [`players.${playerId}`]: {
      name: playerName,
      joinedAt: serverTimestamp(),
      pieceId,
    },
  });
}

/** Beginner mode: the player picks their own Piece (its name/title only - GameBoard.tsx/LobbyScreen.tsx never show the power or win condition before the game starts). Throws if someone else already claimed it. */
export async function choosePiece(
  roomCode: string,
  playerId: string,
  pieceId: PieceId,
): Promise<void> {
  const roomRef = doc(db, 'rooms', roomCode);
  const snapshot = await getDoc(roomRef);
  if (!snapshot.exists()) {
    throw new Error(`No room found with code "${roomCode}".`);
  }

  const room = snapshot.data() as Room;
  if (room.rulesetMode === 'lenin' && !LENIN_PIECE_IDS.includes(pieceId)) {
    throw new Error("That Piece isn't in Lenin mode's Pool.");
  }
  const alreadyClaimed = Object.entries(room.players).some(
    ([id, player]) => id !== playerId && player.pieceId === pieceId,
  );
  if (alreadyClaimed) {
    throw new Error('Someone already picked that Piece.');
  }

  await updateDoc(roomRef, {
    [`players.${playerId}.pieceId`]: pieceId,
  });
}

/**
 * Host-only lobby action: adds a bot with an immediately-assigned random
 * Piece and a random "Communist <word>" name (see lib/botNames.ts).
 * Modeled directly on joinRoom above, minus the beginner-mode blind-pick
 * path - bots always get a Piece right away regardless of Room Mode, so
 * they never block LobbyScreen's everyoneHasAPiece check. Throws if the
 * Piece Pool (or, in Lenin mode, its curated LENIN_PIECE_IDS subset) is
 * already fully claimed. Removal reuses the existing leaveRoom - a bot's
 * ID is just another entry in `players`, nothing bot-specific to unwind.
 */
export async function addBotToLobby(
  roomCode: string,
  difficulty: 'easy' | 'normal' | 'hard',
): Promise<void> {
  const roomRef = doc(db, 'rooms', roomCode);
  const snapshot = await getDoc(roomRef);
  if (!snapshot.exists()) {
    throw new Error(`No room found with code "${roomCode}".`);
  }

  const room = snapshot.data() as Room;
  const claimedPieceIds = Object.values(room.players).map((player) => player.pieceId);
  const pieceId = pickAvailablePiece(
    claimedPieceIds,
    room.rulesetMode === 'lenin' ? LENIN_PIECE_IDS : undefined,
  );
  if (pieceId === null) {
    throw new Error('No Pieces left in the Pool for a bot to use.');
  }

  const takenBotNames = Object.values(room.players)
    .filter((player) => player.isBot)
    .map((player) => player.name);

  const botId = `bot-${crypto.randomUUID()}`;
  await updateDoc(roomRef, {
    [`players.${botId}`]: {
      name: randomBotName(takenBotNames),
      joinedAt: serverTimestamp(),
      pieceId,
      isBot: true,
      botDifficulty: difficulty,
    },
  });
}

/**
 * A non-host player leaving a Room that keeps existing for everyone
 * else - removes just this player's own entry from `players`. The
 * caller (LobbyScreen/EndgameResultsScreen) is responsible for also
 * navigating this player back to the landing screen afterward (see
 * App.tsx's onLeaveRoom) - this only touches the shared Firestore
 * state, not anything local to this browser.
 */
export async function leaveRoom(roomCode: string, playerId: string): Promise<void> {
  await updateDoc(doc(db, 'rooms', roomCode), {
    [`players.${playerId}`]: deleteField(),
  });
}

/**
 * The host closing a Room entirely - deletes the Room document outright
 * (not just its `game` field, unlike gameSync.ts's endGameEntirely).
 * Every connected client (host included) picks this up automatically
 * through their own live subscription: RoomView already treats "the
 * room I'm subscribed to no longer exists" as a signal to leave (see
 * onLeaveRoom/onRoomNotFound), originally built for a stale rejoin-
 * after-refresh, but it's exactly the right reaction here too.
 */
export async function closeLobby(roomCode: string): Promise<void> {
  await deleteDoc(doc(db, 'rooms', roomCode));
}

/**
 * Records "this player is still here" for the presence/away indicator
 * (see lib/presence.ts) - called on an interval by usePresenceHeartbeat
 * for as long as a player is in a room, lobby or game. Failures (a brief
 * network hiccup) are swallowed rather than surfaced anywhere - a missed
 * heartbeat just means this player looks briefly "away" to everyone
 * else until the next one lands, not a real error.
 */
export async function sendHeartbeat(roomCode: string, playerId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'rooms', roomCode), {
      [`players.${playerId}.lastSeenAt`]: Date.now(),
    });
  } catch {
    // Swallowed - see doc comment above.
  }
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
