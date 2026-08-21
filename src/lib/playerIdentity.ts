const PLAYER_ID_KEY = 'comunopoly:playerId';
const PLAYER_NAME_KEY = 'comunopoly:playerName';

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
