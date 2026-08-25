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

/** A random "Communist <word>" name for a bot added in the lobby. Not guaranteed unique - same as human display names, which also aren't. */
export function randomBotName(): string {
  const word = BOT_NAME_WORDS[Math.floor(Math.random() * BOT_NAME_WORDS.length)];
  return `Communist ${word}`;
}
