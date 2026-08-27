// Word list for randomly-generated bot display names ("Communist <word>") -
// added in the lobby by addBotToLobby (rooms.ts). Deliberately apolitical
// nouns/roles rather than anything targeting a real person or group.
const BOT_NAME_WORDS = [
  'Tractor',
  'Beet',
  'Cadre',
  'Comrade',
  'Bureaucrat',
  'Steelworker',
  'Farmer',
  'Engineer',
  'Sailor',
  'Miner',
  'Commissar',
  'Delegate',
  'Inspector',
  'Machinist',
  'Chairman',
  'Vanguard',
  'Collective',
  'Wolf',
  'Bear',
  'Pigeon',
];

/** A random "Communist <word>" name for a bot added in the lobby - unique within `takenNames` (the room's other bots) as long as the word list has an unused entry left; falls back to a repeat once every word is already taken. */
export function randomBotName(takenNames: string[] = []): string {
  const available = BOT_NAME_WORDS.filter((word) => !takenNames.includes(`Communist ${word}`));
  const pool = available.length > 0 ? available : BOT_NAME_WORDS;
  const word = pool[Math.floor(Math.random() * pool.length)];
  return `Communist ${word}`;
}
