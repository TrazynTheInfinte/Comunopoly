import type { PieceDefinition } from '../types/game';

// All 12 Pieces from the source rules table (rulesPrintable.pdf) - not
// 15 as an earlier note here claimed; that was a miscount corrected once
// the full roster was actually implemented. The first 6 (Boot through
// Dog) were picked first for having the simplest, most self-contained
// Special Powers, to get the respawn/Piece Pool mechanic and the core
// loop working before tackling the gnarlier interactions below.
export const STARTING_PIECES: PieceDefinition[] = [
  {
    id: 'boot',
    name: 'Boot',
    title: 'Member of the Proletariat',
    powerDescription: 'Utilities are half price.',
    winConditionDescription:
      "You're conscripted. Final score is money in hand times number of properties, divided by the number of players and the state.",
  },
  {
    id: 'battleship',
    name: 'Battleship',
    title: 'Member of the Red Army',
    powerDescription: 'Rail stations are half price.',
    winConditionDescription:
      "You've defected. Final score is money in hand times number of houses owned.",
  },
  {
    id: 'car',
    name: 'Car',
    title: 'Member of the Politburo',
    powerDescription: 'Can choose a card when landing on Communist Test.',
    winConditionDescription:
      "You're sidelined. Final score is money in the West times number of hotels.",
  },
  {
    id: 'iron',
    name: 'Iron',
    title: 'Widowed Babushka',
    powerDescription: 'Never has to pay the bribe to pass STOY.',
    winConditionDescription:
      "You're dying. Give the total money in hand as Score to another player, replacing their Score. You get half of their Score.",
  },
  {
    id: 'thimble',
    name: 'Thimble',
    title: 'Collectivized Peasant',
    powerDescription: 'Only rolls 1 die.',
    winConditionDescription:
      "You've starved. Deduct the money in your hand from another player's Score. If it goes negative, your Score is the negative of theirs; otherwise your Score is zero.",
  },
  {
    id: 'dog',
    name: 'Dog',
    title: 'Bourgeois Lapdog',
    powerDescription: 'Can choose a card when landing on No Chance.',
    winConditionDescription:
      "You're denounced. Final score is half of your money in the West.",
  },
  {
    id: 'wheelBarrel',
    name: 'Wheel Barrel',
    title: 'Kulak (Traditional Farmer)',
    powerDescription:
      'Automatically takes any purple-group property you land on - free if unowned, seized (no rent) if someone else owns it.',
    winConditionDescription:
      "You've been sent to a gulag. Final score is money in the West times number of properties.",
  },
  {
    id: 'hat',
    name: 'Hat',
    title: 'Nepman',
    powerDescription: 'When you complete a collection, get a free house.',
    winConditionDescription: "You're shot. You score nothing. That's your score.",
  },
  {
    id: 'penguin',
    name: 'Penguin',
    title: 'Spy',
    // TODO(smuggling): "smuggle money to the West when landing on any
    // owned property" extends the base Smuggling/"the West" mechanic
    // from CONTEXT.md, which was deferred at the very start of the
    // project and still doesn't exist. Build base Smuggling first, then
    // extend it here: Penguin should be able to smuggle on ANY owned
    // property (not just their own + Free Parking).
    powerDescription:
      'Can smuggle money to the West when landing on any owned property. [Not yet implemented - the base Smuggling mechanic does not exist yet.]',
    winConditionDescription:
      "You've been double-crossed. Before any scores are calculated, choose another player. You get their Score, and they get 0.",
  },
  {
    id: 'cat',
    name: 'Cat',
    title: 'Spetsnaz GRU',
    powerDescription:
      'After reading a drawn Communist Test/No Chance card, choose to keep it or hand its entire effect to another player instead.',
    winConditionDescription:
      "You've been captured. Your Score is calculated last. Your Score is 0, but then everyone moves their Score around clockwise by one place.",
  },
  {
    id: 'rubberDuck',
    name: 'Rubber Duck',
    title: "Stalin's Body-Double",
    powerDescription:
      'Any time your own move lands you on the same square as another player, you can choose to send them to jail.',
    winConditionDescription:
      "You've been forgotten. Final score is how many people you sent to jail times your number of properties.",
  },
  {
    id: 'trex',
    name: 'T-Rex',
    title: 'Unreformed Old Bolshevik',
    // The source text's second clause ("any money you make is divided
    // equally among yourself and all players, with excess going to the
    // state") is intentionally omitted from both this description and
    // the implementation, per explicit request - it isn't built.
    powerDescription:
      "Can't buy properties. Landing on one owned by someone else seizes it automatically (no rent paid). Chernobyl Power and The Volga still follow their own normal rules.",
    winConditionDescription:
      "You've become irrelevant to the ongoing liberation of the Global Proletariat. Your Score is calculated first: divide the money in your hand among the other players evenly (any remainder is deducted from your Score), then count your seized properties. Final score is the number of people you shared money with times that count.",
  },
];
