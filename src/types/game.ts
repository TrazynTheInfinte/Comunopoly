// Board tiles come in a few distinct shapes, so this is a "discriminated
// union": every variant has a `kind` field, and TypeScript uses that field
// to figure out which other fields are actually present. E.g. only
// PropertyTile has `colorGroup` - TS will error if you try to read
// `.colorGroup` on a tile without first checking `tile.kind === 'property'`.

export type ColorGroup =
  | 'purple'
  | 'lightBlue'
  | 'pink'
  | 'orange'
  | 'red'
  | 'yellow'
  | 'green';

export type CardDeck = 'communistTest' | 'noChance';

interface BaseTile {
  /** Position on the board, 0 (STOY) through 39, going clockwise. */
  id: number;
  name: string;
}

export interface GoTile extends BaseTile {
  kind: 'go';
}

export interface JailTile extends BaseTile {
  kind: 'jail';
}

export interface FreeParkingTile extends BaseTile {
  kind: 'freeParking';
}

export interface GoToJailTile extends BaseTile {
  kind: 'goToJail';
}

export interface PropertyTile extends BaseTile {
  kind: 'property';
  price: number;
  colorGroup: ColorGroup;
  /** Cost of one house (or the hotel that replaces the 4th). Same real-Monopoly numbers as rentTable - see data/board.ts. */
  houseCost: number;
  /** Rent at 0/1/2/3/4 houses, then a hotel - index 5 = hotel, matching the propertyHouses count on GameState (0-4 houses, 5 = hotel). */
  rentTable: [number, number, number, number, number, number];
}

export interface RailroadTile extends BaseTile {
  kind: 'railroad';
  price: number;
}

/** Chernobyl Power (Electric Company) and The Volga (Water Works) - can't be bought normally, each has its own forced-ownership special rule. */
export interface UtilityTile extends BaseTile {
  kind: 'utility';
}

export interface CardTile extends BaseTile {
  kind: 'card';
  deck: CardDeck;
}

/** The Kremlin and NKVD HQ - not ownable, each has its own escalating special rule. */
export interface SpecialTile extends BaseTile {
  kind: 'special';
}

export type BoardTile =
  | GoTile
  | JailTile
  | FreeParkingTile
  | GoToJailTile
  | PropertyTile
  | RailroadTile
  | UtilityTile
  | CardTile
  | SpecialTile;

export type PieceId =
  | 'boot'
  | 'battleship'
  | 'car'
  | 'iron'
  | 'thimble'
  | 'dog'
  | 'wheelBarrel'
  | 'hat'
  | 'penguin'
  | 'cat'
  | 'rubberDuck'
  | 'trex';

export interface PieceDefinition {
  id: PieceId;
  /** The name printed on the token, e.g. "Boot". */
  name: string;
  /** The in-fiction role, e.g. "Member of the Proletariat". */
  title: string;
  powerDescription: string;
  winConditionDescription: string;
}

/** One player's state within an in-progress game (as opposed to RoomPlayer, which is just their lobby name). */
export interface GamePlayerState {
  pieceId: PieceId;
  /** Board tile index, 0-39. */
  position: number;
  roubles: number;
  /** Tile IDs of properties/railroads/utilities this player owns. */
  ownedTileIds: number[];
  inJail: boolean;
  /** Times this player has landed on The Kremlin - odd visits pay out, even visits jail them. */
  kremlinVisits: number;
  /** Times this player has landed on NKVD HQ - cycles miss-a-turn / jail / Disappear every 3 visits. */
  nkvdVisits: number;
  /** Turns still left to sit out before this player's turn comes up again (NKVD HQ's 1st-visit penalty, Anti-Revisionist, Go Into Hiding's three-turn version). Decremented, and cleared at 0, whenever advanceTurn walks past this player. */
  turnsToSkip: number;
  /** Extra turns still owed to this player before the turn actually passes to the next player (e.g. from Party Vanguard). */
  extraTurns: number;
  /** True if this player currently moves backward around the board (Counter-Revolutionary!, Cultural Revolution). */
  movingBackward: boolean;
  /** Set by Blacklist - can't buy properties or collect rent until clearing, which happens the next time this player passes or lands on STOY. */
  blacklisted: boolean;
  /** Set by Go Into Hiding: the tile this player was on when they went into hiding. Another player landing exactly there Disappears this player early. Cleared once turnsToSkip runs out or they Disappear. */
  hidingPosition: number | null;
  /** Cards drawn that get held for later voluntary use (Denounce Your Collaborators, Secret Informant, Show Trial) rather than resolving immediately. */
  heldCardIds: string[];
  /**
   * Set by Fourth International - secretly marks this player as Trotsky.
   * NOTE: this is only a "soft" secret. Every client has the full game
   * state (see docs/adr/0001-client-authoritative-sync.md), so this
   * flag is never shown in the UI to anyone but is technically visible
   * to a player who inspects the raw data - there's no way to keep it
   * truly hidden without a validating server.
   */
  isTrotsky: boolean;
  /** Roubles safely Smuggled to the West - protected from being taken by an opponent, but always fully Seized if this Piece Disappears. */
  westRoubles: number;
  /** Roubles Smuggled but still waiting at Free Parking - not yet safe. If ANY other player lands on Free Parking before this player lands there again (or passes/lands on STOY), that player keeps it and this player Disappears. Moves into westRoubles once secured. */
  pendingWestRoubles: number;
  /** Permanently out of the game (Disappeared after the Piece Pool ran dry, so there was no replacement Piece left to take) - keeps their seat and can watch, but is skipped in turn order forever and scores nothing at Endgame. */
  isSpectating: boolean;
}

/**
 * A decision the current player must make before their turn can end:
 * buy the property they just landed on, give away everything to claim
 * an unowned Volga, pick which card to draw (Car on Communist Test,
 * Dog on No Chance - their Special Power), choose to keep a drawn card
 * or hand its whole effect to another player (Cat's Special Power),
 * pick a target for a card that needs one (Siege of Stalingrad, Double
 * Agent, Phone Call from Stalin), answer NKVD's doctrine question, or
 * acknowledge a drawn Communist Test/No Chance card before play
 * continues.
 *
 * cardTarget/nkvdQuiz/cardDrawn carry `forPlayerId` - normally the
 * drawer, but when Cat redirects a card, this is whoever they gave it
 * to instead. UI and resolution both key off this, not just "whoever's
 * turn it is."
 *
 * smuggleOffer is the current player choosing how much (if anything) to
 * Smuggle to the West - opened on landing on Free Parking (everyone), or
 * on landing on any owned property/railroad (Penguin's Special Power).
 */
export type PendingDecision =
  | { type: 'purchase'; tileId: number }
  | { type: 'volgaOffer'; tileId: number }
  | { type: 'cardChoice'; deck: CardDeck }
  | { type: 'catRedirect'; cardId: string }
  | { type: 'cardTarget'; cardId: string; forPlayerId: string }
  | { type: 'nkvdQuiz'; questionIndex: number; forPlayerId: string }
  | { type: 'cardDrawn'; cardId: string; forPlayerId: string }
  | { type: 'smuggleOffer'; maxAmount: number };

export interface GameState {
  /** Player IDs in turn order. */
  turnOrder: string[];
  currentTurnIndex: number;
  players: Record<string, GamePlayerState>;
  lastRoll: [number, number] | null;
  lastRollWasDoubles: boolean;
  /** Consecutive doubles rolled by the current player this turn (outside jail) - 3 in a row sends them to jail instead of moving. Resets whenever the turn actually passes to someone else. */
  doublesCount: number;
  pendingDecision: PendingDecision | null;
  /** Dev-panel override: if set, the next rollDice() call uses this instead of a random roll, then clears it. */
  forcedRoll: [number, number] | null;
  /** Turns left before Chernobyl Power explodes on its current owner - null if unowned, or if the owner also holds The Volga (safe, no countdown). */
  chernobylCountdown: number | null;
  /** Tile IDs destroyed by a Chernobyl explosion - permanently unownable for the rest of the game. */
  destroyedTileIds: number[];
  /** Tile IDs seized by Siege of Stalingrad - locked to their new owner, exempt from every other ownership-transferring mechanic (Volga, hot potatoes, etc.) until that owner Disappears. */
  lockedTileIds: number[];
  /** Card IDs remaining to be drawn, and already-drawn IDs to reshuffle in once a pile runs out. */
  communistTestDrawPile: string[];
  communistTestDiscardPile: string[];
  noChanceDrawPile: string[];
  noChanceDiscardPile: string[];
  /** Dev-panel override: if set, the next card-tile landing draws this specific card instead of the pile's next one, without disturbing either pile. */
  forcedCardId: string | null;
  /** Telegraph Union: the player currently acting as Commissar for Public Works, and which railroad/utility tiles they've closed. Cleared if the Commissar Disappears. */
  commissarPlayerId: string | null;
  closedTileIds: number[];
  /** Phone Call from Stalin: properties a player was given for free that Disappear them if they ever land back on it. */
  phoneCallTraps: { playerId: string; tileId: number }[];
  /** Fourth International: the board position "Stalin" secretly chose as Trotsky's hiding place - null when no Fourth International is currently active. Public knowledge per the rules - shown in the UI, unlike who's actually Trotsky. */
  trotskyHidingSpot: number | null;
  /** Show Trial: a vote in progress on whether to release or Disappear a jailed player. Runs independently of turns - any player can cast a vote at any time, not just the current one. Null when no vote is active. */
  activeVote: ShowTrialVote | null;
  /**
   * Rubber duck's power: set when Rubber duck's own move lands them on a
   * tile another player already occupies. Runs independently of
   * pendingDecision (like activeVote) rather than blocking the turn,
   * since the tile they landed on might already have its own pending
   * decision (e.g. an unowned property's purchase prompt) - jailing is
   * optional and shouldn't compete for that one slot. Lapses (implicitly
   * "no") if Rubber duck ends their turn without acting on it.
   */
  rubberDuckEncounter: { rubberDuckPlayerId: string; targetPlayerId: string } | null;
  /**
   * Houses built on each property tile: 0-4 is a house count, 5 means a
   * hotel (which replaced the 4 houses - see buildHouse/sellHouse in
   * game/engine.ts). Keyed by tile ID rather than by owner, so a
   * property's houses simply travel with it whenever a forced-transfer
   * mechanic (Wheel Barrel, T-Rex, Siege of Stalingrad, The Volga, etc.)
   * changes who owns it - no special-casing needed there. Missing/absent
   * entries mean 0 (no houses).
   */
  propertyHouses: Record<number, number>;
  /** Bank supply, standard Monopoly counts (32 houses, 12 hotels) - building is blocked once these run out, since there's no auction system to resolve a shortage. */
  housesRemaining: number;
  hotelsRemaining: number;
  /** Color groups Hat has already been granted a free house for (Hat's Special Power) - prevents re-granting every time ownership of an already-rewarded group churns. Cleared for a group if Hat later loses that group (e.g. Disappearing), so completing it again re-triggers the reward. */
  hatFreeHouseGroups: ColorGroup[];
  /** Tile IDs (properties/railroads only - our utilities have no price to mortgage against) currently mortgaged: the owner already collected half its price and can't collect rent on it until they pay the mortgage off. Keyed by tile ID like propertyHouses, so it travels with the tile through forced-transfer mechanics. */
  mortgagedTileIds: number[];
  /** Piece IDs permanently retired by a Disappear - "the old Piece is gone for good," never rejoins the Piece Pool for anyone, ever again. */
  retiredPieceIds: PieceId[];
  /**
   * Player IDs who just Disappeared and need to pick their next Piece,
   * in the order they Disappeared. A queue rather than a single slot
   * because more than one player can be caught smuggling by the same
   * Free Parking landing. Resolved via chooseNewPiece - independent of
   * pendingDecision/turn order (the rest of the table keeps playing
   * while someone here picks), except rollDice refuses to run for
   * whoever's turn it is while they're still in this list, per Q10 -
   * their "turn" just waits on the picker instead of silently skipping.
   */
  pendingPieceChoices: string[];
  /** Recent event descriptions, newest last, capped for display. */
  log: string[];
}

export interface ShowTrialVote {
  /** The player who called the vote - their vote counts double. */
  callerId: string;
  targetPlayerId: string;
  votes: Record<string, 'release' | 'disappear'>;
}
