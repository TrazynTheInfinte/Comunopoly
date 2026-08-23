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
  /** The literal, flavor-text formula for this Piece's Score, verbatim from the rules. Shown on click in the endgame results - see winConditionSummary for the default, plain-English version. */
  winConditionDescription: string;
  /** A short, plain-English gloss of winConditionDescription - what actually drives the number up, without the in-fiction framing or exact wording. Shown by default in the endgame results, since the literal formula alone wasn't landing for players seeing their Score for the first time. */
  winConditionSummary: string;
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
  /** Times this player has used Rubber duck's power to actually send someone to jail (not other jailing mechanics) - feeds Rubber duck's Win Condition. */
  sentToJailCount: number;
  /** Doubles this player has rolled, cumulative across turns (not necessarily consecutive) - 3 sends them to jail instead of moving. Only resets when that happens, or when this player Disappears; every other route to jail (the Go To Jail tile, cards, NKVD, etc.) leaves it untouched. Meaningless while inJail - see resolveJailRoll, which suspends this rule entirely. */
  doublesRolledCount: number;
  /** Consecutive automatic away-skips (see afkSkipTurn in game/engine.ts) - resets the moment they roll for real (rollDice) or confirm they're still there (confirmStillHere). Reaching the limit inside afkSkipTurn benches them (isAfkSpectating) instead of skipping again. */
  consecutiveAfkSkips: number;
  /** True only while spectating because afkSkipTurn benched them for being away too long - distinct from isSpectating alone, which a real Disappear/kick also sets but permanently (assets seized, no way back). This one can be undone with rejoinFromAfk, since nothing was ever seized. */
  isAfkSpectating: boolean;
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
 *
 * awaitingCardDraw is landing on a Communist Test/No Chance tile itself -
 * the deck doesn't actually get drawn from until the player clicks the
 * matching pile (see drawFromPile in game/engine.ts), which is what
 * turns into cardChoice or cardDrawn next.
 */
export type PendingDecision =
  | { type: 'purchase'; tileId: number }
  | { type: 'volgaOffer'; tileId: number }
  | { type: 'awaitingCardDraw'; deck: CardDeck }
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
  /**
   * Null during normal play. Set the instant the Piece Pool is fully
   * exhausted (every one of the 12 Piece IDs is either retired or held -
   * in practice, almost always the moment a Disappeared player picks the
   * very last available Piece). From then on the game is winding down:
   * everyone still active gets exactly one more turn, then whichever
   * Pieces need a target (Iron, Thimble, Penguin) pick one, then Scores
   * are computed once and for all - see computeEndgameScores.
   */
  endgame: EndgameState | null;
  /** Recent event descriptions, newest last, capped for display. */
  log: string[];
  /** House rule, set once at room creation (see Room.carryWestOnDisappear): when true, Disappearing keeps a player's West stash instead of zeroing it along with everything else. */
  carryWestOnDisappear: boolean;
  /**
   * Set by sendToJail to the tile the player was actually standing on
   * the instant they got redirected to jail - e.g. the Go To Jail tile
   * itself after a normal move landed them there, or wherever they
   * already were for a redirect with no preceding move (three doubles
   * in a row). Purely a UI hint for useStagedGame, which uses it to
   * animate the walk to that tile before revealing the jump to jail,
   * rather than snapping straight there - not read anywhere in engine.ts
   * itself. Cleared once the turn actually ends.
   */
  lastJailRedirect: { playerId: string; fromTileId: number } | null;
  /**
   * Set by disappearPlayer to whoever most recently Disappeared - a UI
   * hint for useStagedGame, same idea as lastJailRedirect: a Disappear
   * always resets position to 0 (STOY), which can coincidentally be a
   * *short* distance from wherever the player actually was (e.g.
   * position 38), and without this, that reset gets misread as a
   * normal short walk instead of the teleport it actually is. Not read
   * anywhere in engine.ts itself.
   */
  lastDisappearedPlayerId: string | null;
}

export interface ShowTrialVote {
  /** The player who called the vote - their vote counts double. */
  callerId: string;
  targetPlayerId: string;
  votes: Record<string, 'release' | 'disappear'>;
}

export interface EndgameState {
  /** Active (non-spectating) player IDs who still owe their "one more turn" before Scores can be computed. Popped as each one completes endTurn; a player who Disappears mid-final-lap (always into spectating, since the Pool is already exhausted by definition here) is pulled out instead of ever finishing theirs. */
  finalLapRemaining: string[];
  /** Iron/Thimble/Penguin players (whichever are in this game and still active) who need to pick a target before Scores can be computed - queued the instant finalLapRemaining empties. Empty (and skipped straight to results) if none of those three Pieces are in play. */
  pendingTargetChoices: string[];
  /** Resolved target choices, keyed by the choosing player's ID. */
  targetChoices: Record<string, string>;
  /** Final computed Scores once every needed target choice is in, keyed by player ID. Null until then - its presence is what actually ends the game (see GameBoard/EndgameResultsScreen). */
  results: Record<string, number> | null;
  /** The actual numbers plugged into each player's Score formula (e.g. "₽1,200 cash × 3 properties ÷ 5 = 720"), keyed the same as results - computed alongside it, since some of those numbers (T-Rex's redistributed cash, another player's Score before Iron/Thimble/Penguin/Cat touched it) aren't otherwise reconstructable from the final GameState alone. Null until results is. */
  scoreBreakdowns: Record<string, string> | null;
}
