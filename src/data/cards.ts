export interface CardDefinition {
  id: string;
  deck: 'communistTest' | 'noChance';
  title: string;
  text: string;
}

// Canonical card text from the source repo's CommunistTest.pdf,
// CommunistTest2.pdf, and NoChance1.pdf (see CONTEXT.md). Every card is
// always in play, whether or not its effect is automated below - the
// ones without an automated effect just get shown to the table for
// players to resolve themselves, same as reading a physical card aloud.
export const NO_CHANCE_CARDS: CardDefinition[] = [
  {
    id: 'siegeOfStalingrad',
    deck: 'noChance',
    title: 'Siege of Stalingrad',
    text: "The Nazis have been encircled and outmaneuvered. Take one of your opponent's properties permanently. It cannot be bought, sold, or developed unless you Disappear.",
  },
  {
    id: 'denounceCollaborators',
    deck: 'noChance',
    title: 'Denounce Your Collaborators',
    text: 'If you are in prison, you can use this card to swap your place with someone else.',
  },
  {
    id: 'telegraphUnion',
    deck: 'noChance',
    title: 'Telegraph Union',
    text: 'You have been appointed Commissar for Public Works. Every train station or utility you land on is closed until you Disappear. Other players who land on closed properties have to pay you and the State 10 roubles each.',
  },
  {
    id: 'partyVanguard',
    deck: 'noChance',
    title: 'Party Vanguard',
    text: 'Take three turns in quick succession.',
  },
  {
    id: 'bestseller',
    deck: 'noChance',
    title: 'Bestseller!',
    text: "Your book is popular. Receive 500 roubles and go to prison until you roll a 6 while rolling both dice as normal on your turn (you still Disappear on a 1). OR roll one die: on a 6, you burn your book and deny all knowledge; on a 1, all your assets are seized and you Disappear; anything else and you keep the money but surrender all your property - if you have none, go to jail and leave your money in trust with another player.",
  },
  {
    id: 'doubleAgent',
    deck: 'noChance',
    title: 'Double Agent',
    text: 'Swap Pieces with another player of your choice (including their Special Power and Win Condition).',
  },
  {
    id: 'accident',
    deck: 'noChance',
    title: '"Accident"',
    text: 'You Disappear after violently falling out of a window onto some bullets.',
  },
  {
    id: 'nomenklatura',
    deck: 'noChance',
    title: 'Nomenklatura',
    text: 'Advance to The Kremlin. If you pass STOY, you do not have to pay the bribe.',
  },
  {
    id: 'politicalCorrectness',
    deck: 'noChance',
    title: 'Political Correctness',
    text: 'You can only communicate non-verbally, except with Stalin, until you Disappear.',
  },
  {
    id: 'antiRevisionist',
    deck: 'noChance',
    title: 'Anti-Revisionist',
    text: 'Miss your next turn. Finish your turn if you just rolled doubles.',
  },
];

export const COMMUNIST_TEST_CARDS: CardDefinition[] = [
  {
    id: 'goIntoHiding',
    deck: 'communistTest',
    title: 'Go Into Hiding!',
    text: 'Miss your next three turns. If another player lands on the space you are currently on, you Disappear.',
  },
  {
    id: 'bankError',
    deck: 'communistTest',
    title: 'Bank Error in Your Favour',
    text: 'Collect 1000 roubles.',
  },
  {
    id: 'nkvd',
    deck: 'communistTest',
    title: 'NKVD',
    text: 'Prepare to be quizzed on doctrine. Wrong answers send you to jail.',
  },
  {
    id: 'collectivizationDrive',
    deck: 'communistTest',
    title: 'Collectivization Drive!',
    text: "Combine everyone's assets (money and property) and redistribute them evenly. If they cannot be divided equally, you simply have to agree who gets the excess. Failure to agree lands everyone in jail.",
  },
  {
    id: 'secretInformant',
    deck: 'communistTest',
    title: 'Secret Informant!',
    text: "You are working for the NKVD while you have this card. If you land on the same square as another player, you can send them to jail and put this card at the bottom of the Communist Test deck.",
  },
  {
    id: 'phoneCallFromStalin',
    deck: 'communistTest',
    title: 'Phone Call from Stalin!',
    text: 'Roll a die. On a 1, you Disappear. On any other number, you can have a free property of your choosing, even from another player - but if you ever land on that property (as that piece), you Disappear.',
  },
  {
    id: 'counterRevolutionary',
    deck: 'communistTest',
    title: 'Counter-Revolutionary!',
    text: 'You have been indoctrinated by radical Bukharinists. Reverse your direction on the board (only you).',
  },
  {
    id: 'greatPurge',
    deck: 'communistTest',
    title: 'The Great Purge',
    text: 'Everyone loses all their buildings and half their properties (round up). Rock, paper, scissors to decide which of you Disappears.',
  },
  {
    id: 'showTrial',
    deck: 'communistTest',
    title: 'Show Trial',
    text: 'At any point you can call a vote to have someone in prison released or Disappeared. As the holder of this card, your vote counts for double. Stalin breaks ties.',
  },
  {
    id: 'fourthInternational',
    deck: 'communistTest',
    title: 'Fourth International',
    // House-ruled per the user's request, replacing the source text's
    // literal "the claimant Disappears either way" (which read as
    // self-defeating/likely a typo): the hiding spot is public, and
    // landing on it lets you accuse a specific player. Guess right and
    // the accused is exposed and Disappears; guess wrong and you're
    // sent to jail instead.
    text: "One player is secretly Trotsky. Stalin has marked a public location on the board. Land on it to accuse another player of being Trotsky: guess right and the accused is exposed and Disappears; guess wrong and you're sent to jail instead.",
  },
  {
    id: 'culturalRevolution',
    deck: 'communistTest',
    title: 'Cultural Revolution',
    text: 'All players now go around the board the opposite way they were currently going.',
  },
  {
    id: 'blacklist',
    deck: 'communistTest',
    title: 'Blacklist',
    text: 'You cannot buy properties or collect rent until you have made a full circle around the board from your current location.',
  },
];

export const ALL_CARDS: CardDefinition[] = [...COMMUNIST_TEST_CARDS, ...NO_CHANCE_CARDS];

export function findCard(cardId: string): CardDefinition {
  const card = ALL_CARDS.find((c) => c.id === cardId);
  if (!card) throw new Error(`Unknown card id: ${cardId}`);
  return card;
}
