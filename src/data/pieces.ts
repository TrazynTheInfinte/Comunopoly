import type { PieceDefinition } from '../types/game';

// The first 6 of an eventual 15 Pieces - picked in the domain-modeling
// session for having the simplest, most self-contained Special Powers,
// so we can get the respawn/Piece Pool mechanic and the core loop working
// before tackling gnarlier interactions (forced trades, secret roles,
// etc.) on the rest of the roster.
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
];
