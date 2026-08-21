import { BOARD_SIZE, getTile } from '../data/board';
import type { GameState, GamePlayerState, PieceId } from '../types/game';

const STARTING_ROUBLES = 1000;
const STOY_LANDING_BONUS = 200;
const STOY_PASS_FEE = 50;
// Placeholder flat rent - a real price/house-tier rent table is a later
// increment. For now, landing on someone's property costs a flat
// percentage of what they paid for it.
const PROPERTY_RENT_RATE = 0.2;
// Classic Monopoly railroad rent: doubles with each additional railroad
// the same owner has. All 4 of our railroads are priced 200, same as the
// classic board, so we can reuse this table directly.
const RAILROAD_RENT_BY_COUNT = [25, 50, 100, 200];
const JAIL_POSITION = 10;
const JAIL_BRIBE = 100;
const MAX_DOUBLES_BEFORE_JAIL = 3;

/** Sets up a fresh game: every player starts on STOY with 1000 Roubles and the Piece they were assigned. */
export function createInitialGameState(
  playerAssignments: { playerId: string; pieceId: PieceId }[],
): GameState {
  const players: Record<string, GamePlayerState> = {};
  for (const { playerId, pieceId } of playerAssignments) {
    players[playerId] = {
      pieceId,
      position: 0,
      roubles: STARTING_ROUBLES,
      ownedTileIds: [],
      inJail: false,
    };
  }

  return {
    turnOrder: playerAssignments.map((p) => p.playerId),
    currentTurnIndex: 0,
    players,
    lastRoll: null,
    lastRollWasDoubles: false,
    doublesCount: 0,
    pendingDecision: null,
    forcedRoll: null,
    log: ['The game begins.'],
  };
}

function rollTwoDice(rng: () => number): [number, number] {
  const rollOne = () => Math.floor(rng() * 6) + 1;
  return [rollOne(), rollOne()];
}

function currentPlayerId(state: GameState): string {
  return state.turnOrder[state.currentTurnIndex];
}

function findOwner(state: GameState, tileId: number): string | null {
  for (const [playerId, player] of Object.entries(state.players)) {
    if (player.ownedTileIds.includes(tileId)) return playerId;
  }
  return null;
}

function railroadsOwnedBy(state: GameState, playerId: string): number {
  return state.players[playerId].ownedTileIds.filter(
    (tileId) => getTile(tileId).kind === 'railroad',
  ).length;
}

function giveRoubles(
  state: GameState,
  playerId: string,
  amount: number,
): GameState {
  const player = state.players[playerId];
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, roubles: player.roubles + amount },
    },
  };
}

function payRoubles(
  state: GameState,
  playerId: string,
  amount: number,
): GameState {
  return giveRoubles(state, playerId, -amount);
}

function logEvent(state: GameState, message: string): GameState {
  // Cap the log so it doesn't grow forever over a long game - the last 20
  // events is plenty for players to scroll back through.
  return { ...state, log: [...state.log, message].slice(-20) };
}

function sendToJail(state: GameState, playerId: string): GameState {
  const player = state.players[playerId];
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, position: JAIL_POSITION, inJail: true },
    },
  };
}

/**
 * TEMPORARY placeholder for the real Disappear mechanic (seize
 * everything, respawn as a NEW piece drawn from the Piece Pool - see
 * CONTEXT.md). That needs the Piece Pool/multi-piece system, which
 * doesn't exist yet. Until then, "disappearing" just resets this player
 * to a fresh start under their SAME piece, so jail is testable without
 * getting stuck. Replace this once the real respawn system is built.
 */
function disappearStub(
  state: GameState,
  playerId: string,
  reason: string,
): GameState {
  const player = state.players[playerId];
  const next: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        position: 0,
        roubles: STARTING_ROUBLES,
        ownedTileIds: [],
        inJail: false,
      },
    },
  };
  return logEvent(
    next,
    `Disappeared (${reason}). [placeholder reset - full respawn not yet implemented]`,
  );
}

function resolveLanding(
  state: GameState,
  playerId: string,
  position: number,
): GameState {
  const tile = getTile(position);

  switch (tile.kind) {
    case 'property':
    case 'railroad': {
      const ownerId = findOwner(state, tile.id);
      if (!ownerId) {
        return {
          ...state,
          pendingDecision: { type: 'purchase', tileId: tile.id },
        };
      }
      if (ownerId === playerId) {
        return state; // already yours, nothing happens
      }

      const rent =
        tile.kind === 'railroad'
          ? RAILROAD_RENT_BY_COUNT[railroadsOwnedBy(state, ownerId) - 1]
          : Math.round(tile.price * PROPERTY_RENT_RATE);

      const next = payRoubles(state, playerId, rent);
      if (state.players[ownerId].inJail) {
        // "When in jail, any rent you collect is seized by the state" -
        // the payer still pays, but the jailed owner never sees it.
        return logEvent(
          next,
          `Paid ${rent} roubles rent on ${tile.name}, seized by the State (owner is in jail).`,
        );
      }
      return logEvent(
        giveRoubles(next, ownerId, rent),
        `Paid ${rent} roubles rent on ${tile.name}.`,
      );
    }
    case 'goToJail':
      return logEvent(sendToJail(state, playerId), 'Sent directly to jail!');
    // Jail (just visiting) and Free Parking have no effect yet -
    // Smuggling isn't implemented in this increment. Utilities, cards,
    // and the special tiles (Kremlin/NKVD HQ) are all deferred entirely
    // for now: the piece lands there and nothing else happens yet.
    default:
      return state;
  }
}

/** Moves a player by `steps`, resolving STOY and whatever they land on. Shared by a normal roll and a jail-escape roll, since both work the same way once you know where movement starts from. */
function moveAndResolve(
  state: GameState,
  playerId: string,
  steps: number,
): GameState {
  const player = state.players[playerId];
  const rawNewPosition = player.position + steps;
  const newPosition = rawNewPosition % BOARD_SIZE;
  // Landing exactly on STOY pays out; merely passing through it (wrapping
  // around to somewhere else) costs a fee instead - the reverse of
  // regular Monopoly's "Go," per the source rules.
  const passedStoy = rawNewPosition >= BOARD_SIZE && newPosition !== 0;
  const landedOnStoy = newPosition === 0;

  let next: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, position: newPosition },
    },
  };

  next = logEvent(next, `Moved to ${getTile(newPosition).name}.`);

  if (passedStoy) {
    next = payRoubles(next, playerId, STOY_PASS_FEE);
    next = logEvent(next, `Paid ${STOY_PASS_FEE} roubles passing STOY.`);
  }
  if (landedOnStoy) {
    next = giveRoubles(next, playerId, STOY_LANDING_BONUS);
    next = logEvent(
      next,
      `Collected ${STOY_LANDING_BONUS} roubles for landing on STOY.`,
    );
  }

  return resolveLanding(next, playerId, newPosition);
}

/**
 * Handles a roll made by a player who's currently in jail: doubles means
 * they escape and move as normal; a 1 on either die means they
 * Disappear; anything else means they stay put for another turn.
 */
function resolveJailRoll(
  state: GameState,
  playerId: string,
  die1: number,
  die2: number,
  isDoubles: boolean,
  steps: number,
): GameState {
  // Being in jail suspends the doubles-roll-again and 3-doubles-to-jail
  // rules entirely - "except while in jail," per the source rules.
  const next: GameState = { ...state, lastRollWasDoubles: false, doublesCount: 0 };

  if (isDoubles) {
    const escaped: GameState = {
      ...next,
      players: {
        ...next.players,
        [playerId]: { ...next.players[playerId], inJail: false },
      },
    };
    return moveAndResolve(
      logEvent(escaped, 'Rolled doubles and escaped jail!'),
      playerId,
      steps,
    );
  }

  if (die1 === 1 || die2 === 1) {
    return disappearStub(next, playerId, 'rolled a 1 in jail');
  }

  return logEvent(next, 'Failed to roll doubles - still in jail.');
}

/**
 * Rolls the dice for the current player and resolves the result: normal
 * movement, an in-jail escape attempt, or - after three doubles in a row
 * - a one-way trip to jail instead of moving further. Returns a
 * brand-new GameState rather than mutating the one it's given - React and
 * Firestore both rely on that to notice something changed.
 */
export function rollDice(
  state: GameState,
  rng: () => number = Math.random,
): GameState {
  const playerId = currentPlayerId(state);
  const player = state.players[playerId];

  const roll = state.forcedRoll ?? rollTwoDice(rng);
  const [die1, die2] = roll;
  const isDoubles = die1 === die2;
  const steps = die1 + die2;

  let next: GameState = { ...state, forcedRoll: null, lastRoll: roll };
  next = logEvent(
    next,
    `Rolled ${die1} + ${die2}${isDoubles ? ' (doubles!)' : ''}.`,
  );

  if (player.inJail) {
    return resolveJailRoll(next, playerId, die1, die2, isDoubles, steps);
  }

  const doublesCount = isDoubles ? state.doublesCount + 1 : 0;
  if (isDoubles && doublesCount >= MAX_DOUBLES_BEFORE_JAIL) {
    next = { ...next, doublesCount: 0, lastRollWasDoubles: false };
    next = sendToJail(next, playerId);
    return logEvent(
      next,
      'Rolled doubles three times in a row - sent to jail!',
    );
  }

  next = { ...next, doublesCount, lastRollWasDoubles: isDoubles };
  return moveAndResolve(next, playerId, steps);
}

/** The current player buys the property/railroad they just landed on. */
export function buyProperty(state: GameState): GameState {
  const playerId = currentPlayerId(state);
  if (state.pendingDecision?.type !== 'purchase') return state;

  const tile = getTile(state.pendingDecision.tileId);
  if (tile.kind !== 'property' && tile.kind !== 'railroad') return state;

  const player = state.players[playerId];
  if (player.roubles < tile.price) return state; // can't afford it - use Skip instead

  let next = payRoubles(state, playerId, tile.price);
  next = {
    ...next,
    pendingDecision: null,
    players: {
      ...next.players,
      [playerId]: {
        ...next.players[playerId],
        ownedTileIds: [...next.players[playerId].ownedTileIds, tile.id],
      },
    },
  };
  return logEvent(next, `Bought ${tile.name} for ${tile.price} roubles.`);
}

/** The current player declines to buy - the property stays unowned. */
export function skipPurchase(state: GameState): GameState {
  if (state.pendingDecision?.type !== 'purchase') return state;
  return logEvent({ ...state, pendingDecision: null }, 'Declined to buy.');
}

/**
 * Ends the current player's turn - unless they rolled doubles, in which
 * case they go again instead of passing the turn ("if you get a double,
 * you get to roll again"). Refuses to do anything while a purchase
 * decision is still pending; the UI should only show an "End Turn"
 * button once that's resolved.
 *
 * If the player is still in jail as their turn ends, this also charges
 * the mandatory 100 rouble bribe (or Disappears them if they can't
 * afford it) - "you must bribe the guards... at the end of your turn or
 * you will disappear."
 */
export function endTurn(state: GameState): GameState {
  if (state.pendingDecision) return state;

  if (state.lastRollWasDoubles) {
    return { ...state, lastRoll: null, lastRollWasDoubles: false };
  }

  const endingPlayerId = currentPlayerId(state);
  let next = state.players[endingPlayerId].inJail
    ? chargeJailBribe(state, endingPlayerId)
    : state;

  const nextIndex = (next.currentTurnIndex + 1) % next.turnOrder.length;
  return {
    ...next,
    currentTurnIndex: nextIndex,
    lastRoll: null,
    lastRollWasDoubles: false,
    doublesCount: 0,
  };
}

function chargeJailBribe(state: GameState, playerId: string): GameState {
  const player = state.players[playerId];
  if (player.roubles < JAIL_BRIBE) {
    return disappearStub(state, playerId, 'could not afford the jail bribe');
  }
  return logEvent(
    payRoubles(state, playerId, JAIL_BRIBE),
    `Paid the ${JAIL_BRIBE} rouble jail bribe.`,
  );
}

// --- Dev panel helpers -------------------------------------------------
// These exist purely to make manual testing fast (jump straight to an
// interesting state instead of grinding turns to reach it). This module
// doesn't know about "Comrade Stalin" or who's allowed to call these -
// that gating lives in the UI layer, not here.

export function devSetRoubles(
  state: GameState,
  playerId: string,
  roubles: number,
): GameState {
  const player = state.players[playerId];
  if (!player) return state;
  return {
    ...state,
    players: { ...state.players, [playerId]: { ...player, roubles } },
  };
}

export function devSetForcedRoll(
  state: GameState,
  roll: [number, number] | null,
): GameState {
  return { ...state, forcedRoll: roll };
}
