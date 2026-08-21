import type { BoardTile } from '../types/game';

// The full 40-tile board, reconstructed from the source repo's
// boardPrintable.pdf (MaiRiosIPla/communopoly). Order goes clockwise
// starting at STOY, matching the "collect on landing, pay 50 to pass"
// arrow printed next to it on the board sheet.
export const BOARD: BoardTile[] = [
  { id: 0, kind: 'go', name: 'STOY' },
  {
    id: 1,
    kind: 'property',
    name: 'Machine Tractor Station 37',
    price: 50,
    colorGroup: 'purple',
  },
  { id: 2, kind: 'card', name: 'Communist Test', deck: 'communistTest' },
  {
    id: 3,
    kind: 'property',
    name: 'Gulag Archipelago',
    price: 60,
    colorGroup: 'purple',
  },
  { id: 4, kind: 'card', name: 'No Chance', deck: 'noChance' },
  {
    id: 5,
    kind: 'railroad',
    name: 'Komsomolskaya Station',
    price: 200,
  },
  {
    id: 6,
    kind: 'property',
    name: 'Moscow Metro',
    price: 100,
    colorGroup: 'lightBlue',
  },
  { id: 7, kind: 'card', name: 'No Chance', deck: 'noChance' },
  {
    id: 8,
    kind: 'property',
    name: 'Vermont Avenue',
    price: 100,
    colorGroup: 'lightBlue',
  },
  {
    id: 9,
    kind: 'property',
    name: 'Alexander Garden',
    price: 120,
    colorGroup: 'lightBlue',
  },
  { id: 10, kind: 'jail', name: 'Jail' },
  {
    id: 11,
    kind: 'property',
    name: 'Nikolskaya Ulitsa',
    price: 140,
    colorGroup: 'pink',
  },
  { id: 12, kind: 'utility', name: 'Chernobyl Power' },
  {
    id: 13,
    kind: 'property',
    name: 'Poklonnaya Hill',
    price: 140,
    colorGroup: 'pink',
  },
  {
    id: 14,
    kind: 'property',
    name: 'Petersburg (Leningrad)',
    price: 160,
    colorGroup: 'pink',
  },
  {
    id: 15,
    kind: 'railroad',
    name: 'Belorusskiy Station',
    price: 200,
  },
  {
    id: 16,
    kind: 'property',
    name: 'St. James Avenue',
    price: 180,
    colorGroup: 'orange',
  },
  { id: 17, kind: 'card', name: 'Communist Test', deck: 'communistTest' },
  {
    id: 18,
    kind: 'property',
    name: 'Mamayev Kurgan (Stalingrad)',
    price: 180,
    colorGroup: 'orange',
  },
  {
    id: 19,
    kind: 'property',
    name: 'Kazan Cathedral',
    price: 200,
    colorGroup: 'orange',
  },
  { id: 20, kind: 'freeParking', name: 'Free Parking' },
  {
    id: 21,
    kind: 'property',
    name: 'Barmaley Fountain',
    price: 220,
    colorGroup: 'red',
  },
  { id: 22, kind: 'card', name: 'No Chance', deck: 'noChance' },
  {
    id: 23,
    kind: 'property',
    name: 'Red Square',
    price: 220,
    colorGroup: 'red',
  },
  {
    id: 24,
    kind: 'property',
    name: 'Uspenski Cathedral',
    price: 240,
    colorGroup: 'red',
  },
  {
    id: 25,
    kind: 'railroad',
    name: 'Kazansky Station',
    price: 200,
  },
  {
    id: 26,
    kind: 'property',
    name: 'Teatro Bolshoi',
    price: 260,
    colorGroup: 'yellow',
  },
  {
    id: 27,
    kind: 'property',
    name: "Saint Basil's Cathedral",
    price: 260,
    colorGroup: 'yellow',
  },
  { id: 28, kind: 'utility', name: 'The Volga' },
  {
    id: 29,
    kind: 'property',
    name: 'Garibaldi Ulitsa',
    price: 280,
    colorGroup: 'yellow',
  },
  { id: 30, kind: 'goToJail', name: 'Go To Jail' },
  {
    id: 31,
    kind: 'property',
    name: 'Manezh Square',
    price: 300,
    colorGroup: 'green',
  },
  {
    id: 32,
    kind: 'property',
    name: "Lenin's Mausoleum",
    price: 300,
    colorGroup: 'green',
  },
  { id: 33, kind: 'card', name: 'Communist Test', deck: 'communistTest' },
  {
    id: 34,
    kind: 'property',
    name: 'Ulitsa Tverskaya',
    price: 320,
    colorGroup: 'green',
  },
  {
    id: 35,
    kind: 'railroad',
    name: 'Kursky Station',
    price: 200,
  },
  { id: 36, kind: 'card', name: 'No Chance', deck: 'noChance' },
  { id: 37, kind: 'special', name: 'The Kremlin' },
  { id: 38, kind: 'card', name: 'Communist Test', deck: 'communistTest' },
  { id: 39, kind: 'special', name: 'NKVD HQ' },
];

export const BOARD_SIZE = BOARD.length;

/** Looks up a tile by position, wrapping around the board (e.g. -1 -> 39). */
export function getTile(position: number): BoardTile {
  const wrapped = ((position % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  return BOARD[wrapped];
}
