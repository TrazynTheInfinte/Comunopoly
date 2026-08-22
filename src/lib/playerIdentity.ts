const PLAYER_ID_KEY = 'comunopoly:playerId';
const PLAYER_NAME_KEY = 'comunopoly:playerName';
const ACTIVE_ROOM_CODE_KEY = 'comunopoly:activeRoomCode';

/**
 * Every browser gets a random ID the first time it's used, stashed in
 * localStorage - that's the entire "account system." No login, no
 * server-side signup, just a private ID this browser remembers. If you
 * clear site data or switch browsers, you show up as a new player.
 */
export function getOrCreatePlayerId(): string {
  const existing = localStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(PLAYER_ID_KEY, id);
  return id;
}

/** Jackbox-style convenience: remember the last name typed, so re-joining doesn't require retyping it. */
export function getStoredName(): string {
  return localStorage.getItem(PLAYER_NAME_KEY) ?? '';
}

export function storeName(name: string): void {
  localStorage.setItem(PLAYER_NAME_KEY, name);
}

/**
 * Remembers whatever room this player last joined/created, so a page
 * refresh (or just reopening the tab later) can drop them straight back
 * in instead of dumping them on the landing screen with no way back but
 * re-typing the room code. See App.tsx's mount effect and
 * RoomView's onRoomNotFound for the other half of this - a stored code
 * for a room that's since been abandoned gets cleared automatically.
 */
export function getStoredActiveRoomCode(): string | null {
  return localStorage.getItem(ACTIVE_ROOM_CODE_KEY);
}

export function storeActiveRoomCode(code: string): void {
  localStorage.setItem(ACTIVE_ROOM_CODE_KEY, code);
}

export function clearActiveRoomCode(): void {
  localStorage.removeItem(ACTIVE_ROOM_CODE_KEY);
}
