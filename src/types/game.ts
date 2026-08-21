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
  | 'dog';

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
  /** Tile IDs of properties/railroads this player owns. */
  ownedTileIds: number[];
  inJail: boolean;
}

/**
 * A decision the current player must make before their turn can end.
 * Currently only "buy the property you just landed on or don't" - more
 * variants (e.g. resolving a drawn card) join this union in later
 * increments.
 */
export interface PendingPurchase {
  type: 'purchase';
  tileId: number;
}

export interface GameState {
  /** Player IDs in turn order. */
  turnOrder: string[];
  currentTurnIndex: number;
  players: Record<string, GamePlayerState>;
  lastRoll: [number, number] | null;
  lastRollWasDoubles: boolean;
  /** Consecutive doubles rolled by the current player this turn (outside jail) - 3 in a row sends them to jail instead of moving. Resets whenever the turn actually passes to someone else. */
  doublesCount: number;
  pendingDecision: PendingPurchase | null;
  /** Dev-panel override: if set, the next rollDice() call uses this instead of a random roll, then clears it. */
  forcedRoll: [number, number] | null;
  /** Recent event descriptions, newest last, capped for display. */
  log: string[];
}
