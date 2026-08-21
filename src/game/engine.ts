import { BOARD, BOARD_SIZE, getTile } from '../data/board';
import {
  COMMUNIST_TEST_CARDS,
  NO_CHANCE_CARDS,
  findCard,
} from '../data/cards';
import { NKVD_QUESTIONS } from '../data/nkvdQuestions';
import type { CardDeck, ColorGroup, GameState, GamePlayerState, PieceId } from '../types/game';

const STARTING_ROUBLES = 1000;
const STOY_LANDING_BONUS = 200;
const STOY_PASS_FEE = 50;
// Classic Monopoly railroad rent: doubles with each additional railroad
// the same owner has. All 4 of our railroads are priced 200, same as the
// classic board, so we can reuse this table directly.
const RAILROAD_RENT_BY_COUNT = [25, 50, 100, 200];
const JAIL_POSITION = 10;
const JAIL_BRIBE = 100;
const MAX_DOUBLES_BEFORE_JAIL = 3;
const CHERNOBYL_TILE_ID = 12;
const VOLGA_TILE_ID = 28;
const KREMLIN_TILE_ID = 37;
const NKVD_TILE_ID = 39;
const KREMLIN_BONUS = 200;
const CHERNOBYL_COUNTDOWN_TURNS = 3;
const TELEGRAPH_UNION_TOLL = 20; // split 10 to the Commissar, 10 to the State
const PROPERTY_TILE_IDS = BOARD.filter((t) => t.kind === 'property').map((t) => t.id);
// Standard Monopoly bank supply. Real Monopoly resolves a shortage with
// an auction between players - we don't have one, so running dry just
// blocks further building until someone sells houses back.
const STARTING_HOUSES = 32;
const STARTING_HOTELS = 12;
// Standard Monopoly mortgage rules: mortgaging pays out half the tile's
// price; paying it back off costs that same amount plus 10% interest.
const MORTGAGE_PAYOFF_MULTIPLIER = 1.1;
const COLOR_GROUPS: ColorGroup[] = ['purple', 'lightBlue', 'pink', 'orange', 'red', 'yellow', 'green'];

function tileIdsInGroup(group: ColorGroup): number[] {
  return BOARD.filter((t) => t.kind === 'property' && t.colorGroup === group).map((t) => t.id);
}

function ownsFullGroup(state: GameState, playerId: string, group: ColorGroup): boolean {
  return tileIdsInGroup(group).every((id) => state.players[playerId].ownedTileIds.includes(id));
}

/** Sets up a fresh game: every player starts on STOY with 1000 Roubles and the Piece they were assigned, and both card decks get shuffled. */
export function createInitialGameState(
  playerAssignments: { playerId: string; pieceId: PieceId }[],
  rng: () => number = Math.random,
): GameState {
  const players: Record<string, GamePlayerState> = {};
  for (const { playerId, pieceId } of playerAssignments) {
    players[playerId] = {
      pieceId,
      position: 0,
      roubles: STARTING_ROUBLES,
      ownedTileIds: [],
      inJail: false,
      kremlinVisits: 0,
      nkvdVisits: 0,
      turnsToSkip: 0,
      extraTurns: 0,
      movingBackward: false,
      blacklisted: false,
      hidingPosition: null,
      heldCardIds: [],
      isTrotsky: false,
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
    chernobylCountdown: null,
    destroyedTileIds: [],
    lockedTileIds: [],
    communistTestDrawPile: shuffle(COMMUNIST_TEST_CARDS.map((c) => c.id), rng),
    communistTestDiscardPile: [],
    noChanceDrawPile: shuffle(NO_CHANCE_CARDS.map((c) => c.id), rng),
    noChanceDiscardPile: [],
    forcedCardId: null,
    commissarPlayerId: null,
    closedTileIds: [],
    phoneCallTraps: [],
    trotskyHidingSpot: null,
    activeVote: null,
    rubberDuckEncounter: null,
    propertyHouses: {},
    housesRemaining: STARTING_HOUSES,
    hotelsRemaining: STARTING_HOTELS,
    hatFreeHouseGroups: [],
    mortgagedTileIds: [],
    log: ['The game begins.'],
  };
}

function rollTwoDice(rng: () => number): [number, number] {
  const rollOne = () => Math.floor(rng() * 6) + 1;
  return [rollOne(), rollOne()];
}

function rollOneDie(rng: () => number): number {
  return Math.floor(rng() * 6) + 1;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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

/** Chernobyl Power (a forced burden, not a real asset) and anything seized by Siege of Stalingrad (locked to its owner) are exempt from every mechanic that moves properties around - Volga, hot potatoes, Collectivization Drive, the Great Purge, all of it. */
function isTradeable(state: GameState, tileId: number): boolean {
  return tileId !== CHERNOBYL_TILE_ID && !state.lockedTileIds.includes(tileId);
}

function tradeableTileIds(state: GameState, tileIds: number[]): number[] {
  return tileIds.filter((id) => isTradeable(state, id));
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

  // Bankrupt-to-the-bank: any houses/hotels on this player's properties
  // return to the bank's supply (the tiles themselves just go back to
  // being unowned, same simplification as everything else in this
  // TEMPORARY placeholder).
  let propertyHouses = state.propertyHouses;
  let housesRemaining = state.housesRemaining;
  let hotelsRemaining = state.hotelsRemaining;
  for (const tileId of player.ownedTileIds) {
    const count = propertyHouses[tileId] ?? 0;
    if (count === 0) continue;
    if (count === 5) {
      hotelsRemaining += 1;
    } else {
      housesRemaining += count;
    }
    propertyHouses = { ...propertyHouses, [tileId]: 0 };
  }

  // Foreclosed properties go back to the bank clean - any mortgage on
  // them is wiped rather than sticking around on a now-unowned tile.
  const mortgagedTileIds = state.mortgagedTileIds.filter((id) => !player.ownedTileIds.includes(id));

  let next: GameState = {
    ...state,
    propertyHouses,
    housesRemaining,
    hotelsRemaining,
    mortgagedTileIds,
    // Hat's piece stays with this player through Disappear (see the
    // placeholder note above), so any groups already rewarded no longer
    // apply - they've lost every property. Clearing this lets completing
    // the same group again later re-trigger the free house.
    hatFreeHouseGroups: player.pieceId === 'hat' ? [] : state.hatFreeHouseGroups,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        position: 0,
        roubles: STARTING_ROUBLES,
        ownedTileIds: [],
        inJail: false,
        turnsToSkip: 0,
        blacklisted: false,
        hidingPosition: null,
        heldCardIds: [],
        isTrotsky: false,
      },
    },
  };
  if (next.commissarPlayerId === playerId) {
    next = { ...next, commissarPlayerId: null, closedTileIds: [] };
  }
  if (next.activeVote && (next.activeVote.callerId === playerId || next.activeVote.targetPlayerId === playerId)) {
    // The caller or the person on trial Disappeared some other way mid-vote - abort it rather than leave a dangling reference.
    next = { ...next, activeVote: null };
  }
  if (
    next.rubberDuckEncounter &&
    (next.rubberDuckEncounter.rubberDuckPlayerId === playerId ||
      next.rubberDuckEncounter.targetPlayerId === playerId)
  ) {
    next = { ...next, rubberDuckEncounter: null };
  }
  if (
    next.pendingDecision &&
    'forPlayerId' in next.pendingDecision &&
    next.pendingDecision.forPlayerId === playerId
  ) {
    // Whoever the pending card decision was for Disappeared some other
    // way (e.g. Cat redirected it to them, then they got caught hiding)
    // before resolving it - clear it rather than leave the game stuck
    // waiting on a player who no longer has anything to decide.
    next = { ...next, pendingDecision: null };
  }
  return logEvent(
    next,
    `Disappeared (${reason}). [placeholder reset - full respawn not yet implemented]`,
  );
}

function giveTileTo(
  state: GameState,
  tileId: number,
  playerId: string,
): GameState {
  const player = state.players[playerId];
  const next: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, ownedTileIds: [...player.ownedTileIds, tileId] },
    },
  };
  // Every mechanic that hands a player a tile - buying, Wheel Barrel/
  // T-Rex's auto-seize, The Volga, Siege of Stalingrad, Collectivization
  // Drive, Phone Call from Stalin - routes through here, so this is the
  // one place that needs to check Hat's power.
  return maybeGrantHatFreeHouse(next, playerId);
}

/**
 * Hat's power: the moment Hat completes a full color-group collection
 * (by any means), they get one free house on whichever property in that
 * group currently has the fewest houses (ties broken by lowest tile ID).
 * Tracked per color group via hatFreeHouseGroups so it only fires once
 * per completion, not every subsequent tile shuffle within an
 * already-complete group.
 */
function maybeGrantHatFreeHouse(state: GameState, playerId: string): GameState {
  if (state.players[playerId].pieceId !== 'hat') return state;

  let next = state;
  for (const group of COLOR_GROUPS) {
    if (next.hatFreeHouseGroups.includes(group)) continue;
    if (!ownsFullGroup(next, playerId, group)) continue;

    const target = tileIdsInGroup(group)
      .map((id) => ({ id, houses: next.propertyHouses[id] ?? 0 }))
      .sort((a, b) => a.houses - b.houses || a.id - b.id)[0];

    next = { ...next, hatFreeHouseGroups: [...next.hatFreeHouseGroups, group] };

    if (target.houses >= 5) continue; // already maxed out, nothing to grant
    if (target.houses === 4) {
      if (next.hotelsRemaining <= 0) continue; // no hotel in the bank - skip the reward
      next = {
        ...next,
        propertyHouses: { ...next.propertyHouses, [target.id]: 5 },
        hotelsRemaining: next.hotelsRemaining - 1,
        housesRemaining: next.housesRemaining + 4,
      };
    } else {
      if (next.housesRemaining <= 0) continue; // no houses in the bank - skip the reward
      next = {
        ...next,
        propertyHouses: { ...next.propertyHouses, [target.id]: target.houses + 1 },
        housesRemaining: next.housesRemaining - 1,
      };
    }
    next = logEvent(
      next,
      `Completed the collection - Nepman gets a free house on ${getTile(target.id).name}.`,
    );
  }
  return next;
}

function transferTileOwnership(
  state: GameState,
  tileId: number,
  fromPlayerId: string,
  toPlayerId: string,
): GameState {
  const from = state.players[fromPlayerId];
  const withoutTile: GameState = {
    ...state,
    players: {
      ...state.players,
      [fromPlayerId]: {
        ...from,
        ownedTileIds: from.ownedTileIds.filter((id) => id !== tileId),
      },
    },
  };
  return giveTileTo(withoutTile, tileId, toPlayerId);
}

/**
 * Chernobyl Power: forced free ownership if unowned ("entrusted to you
 * for free... you have to take it"). If someone already owns it, it gets
 * forcibly handed to whoever just landed on it instead - a hot potato
 * that carries the explosion countdown along with it. The countdown
 * itself is ticked once per turn in tickChernobyl(), not here.
 */
function resolveChernobylLanding(state: GameState, playerId: string): GameState {
  const ownerId = findOwner(state, CHERNOBYL_TILE_ID);

  if (!ownerId) {
    return logEvent(
      giveTileTo(state, CHERNOBYL_TILE_ID, playerId),
      'Forced to take ownership of Chernobyl Power (free) - watch that countdown.',
    );
  }
  if (ownerId === playerId) {
    return state; // revisiting your own doom, nothing new happens
  }

  const transferred: GameState = {
    ...transferTileOwnership(state, CHERNOBYL_TILE_ID, ownerId, playerId),
    // A fresh victim gets a fresh countdown, not whatever was left of the
    // previous owner's.
    chernobylCountdown: null,
  };
  return logEvent(
    transferred,
    'Chernobyl Power was forcibly handed to you - the countdown resets.',
  );
}

/**
 * The Volga: landing on someone else's Volga forces you to hand over
 * everything you own - unless you own nothing, in which case you steal
 * the Volga instead. Landing on an unowned Volga while you own at least
 * one property offers a decision (see acceptVolgaOffer/declineVolgaOffer);
 * owning nothing at all means there's nothing to "distribute," so you
 * just claim it.
 */
function resolveVolgaLanding(state: GameState, playerId: string): GameState {
  const ownerId = findOwner(state, VOLGA_TILE_ID);
  const landerProperties = tradeableTileIds(state, state.players[playerId].ownedTileIds);

  if (ownerId === playerId) return state; // landing on your own Volga

  if (ownerId) {
    if (landerProperties.length === 0) {
      return logEvent(
        transferTileOwnership(state, VOLGA_TILE_ID, ownerId, playerId),
        'You had nothing to give up, so you claimed The Volga instead!',
      );
    }
    let next = state;
    for (const tileId of landerProperties) {
      next = transferTileOwnership(next, tileId, playerId, ownerId);
    }
    return logEvent(
      next,
      "Forced to surrender everything you own to The Volga's owner.",
    );
  }

  if (landerProperties.length === 0) {
    return logEvent(
      giveTileTo(state, VOLGA_TILE_ID, playerId),
      'You owned nothing to give up, so you claimed The Volga for free.',
    );
  }
  return { ...state, pendingDecision: { type: 'volgaOffer', tileId: VOLGA_TILE_ID } };
}

/** The Kremlin: "Visit Stalin!" - collect on odd visits, jailed on even ones. The rules only spell out visits 1 and 2; we extend that as an alternating pattern for anything past that. */
function resolveKremlinLanding(state: GameState, playerId: string): GameState {
  const player = state.players[playerId];
  const visits = player.kremlinVisits + 1;
  let next: GameState = {
    ...state,
    players: { ...state.players, [playerId]: { ...player, kremlinVisits: visits } },
  };

  if (visits % 2 === 1) {
    next = giveRoubles(next, playerId, KREMLIN_BONUS);
    return logEvent(
      next,
      `Visited Stalin at the Kremlin - collected ${KREMLIN_BONUS} roubles.`,
    );
  }
  next = sendToJail(next, playerId);
  return logEvent(next, 'Stalin had enough of your visits - sent to jail!');
}

/** NKVD HQ: cycles through miss-a-turn, jail, and Disappear every 3 visits, per the rules' 1st/2nd/3rd-visit escalation. */
function resolveNkvdLanding(state: GameState, playerId: string): GameState {
  const player = state.players[playerId];
  const visits = player.nkvdVisits + 1;
  let next: GameState = {
    ...state,
    players: { ...state.players, [playerId]: { ...player, nkvdVisits: visits } },
  };

  const cycle = visits % 3;
  if (cycle === 1) {
    next = {
      ...next,
      players: {
        ...next.players,
        [playerId]: { ...next.players[playerId], turnsToSkip: 1 },
      },
    };
    return logEvent(
      next,
      'Stopped for questioning at NKVD HQ - you will miss your next turn.',
    );
  }
  if (cycle === 2) {
    return logEvent(sendToJail(next, playerId), 'NKVD HQ sent you to jail.');
  }
  return disappearStub(next, playerId, 'disappeared at NKVD HQ after repeated visits');
}

// --- Card effect helpers -------------------------------------------------

function addToHand(state: GameState, playerId: string, cardId: string): GameState {
  const player = state.players[playerId];
  return {
    ...state,
    players: { ...state.players, [playerId]: { ...player, heldCardIds: [...player.heldCardIds, cardId] } },
  };
}

function setExtraTurns(state: GameState, playerId: string, delta: number): GameState {
  const player = state.players[playerId];
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, extraTurns: player.extraTurns + delta },
    },
  };
}

function toggleDirection(state: GameState, playerId: string): GameState {
  const player = state.players[playerId];
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, movingBackward: !player.movingBackward },
    },
  };
}

function toggleDirectionForAll(state: GameState): GameState {
  const players = { ...state.players };
  for (const id of Object.keys(players)) {
    players[id] = { ...players[id], movingBackward: !players[id].movingBackward };
  }
  return { ...state, players };
}

function setBlacklisted(state: GameState, playerId: string): GameState {
  const player = state.players[playerId];
  return {
    ...state,
    players: { ...state.players, [playerId]: { ...player, blacklisted: true } },
  };
}

/** Nomenklatura: force-advance to The Kremlin, always moving forward regardless of the player's current direction, waiving the STOY pass fee along the way. */
function nomenklaturaEffect(
  state: GameState,
  playerId: string,
  rng: () => number,
): GameState {
  const player = state.players[playerId];
  const forwardSteps = (KREMLIN_TILE_ID - player.position + BOARD_SIZE) % BOARD_SIZE;
  if (forwardSteps === 0) return state; // already there

  const forcedForward: GameState = {
    ...state,
    players: { ...state.players, [playerId]: { ...player, movingBackward: false } },
  };
  return moveAndResolve(forcedForward, playerId, forwardSteps, rng, {
    waiveStoyFee: true,
  });
}

/**
 * Go Into Hiding: miss 3 turns, and mark the current tile as a hiding
 * spot - another player landing there exactly Disappears this player
 * early (see the check in moveAndResolve). Also ends the turn outright,
 * even if the roll that landed here was doubles - otherwise "miss your
 * next 3 turns" would perversely let them keep moving right now.
 */
function goIntoHidingEffect(state: GameState, playerId: string): GameState {
  const player = state.players[playerId];
  return {
    ...state,
    lastRollWasDoubles: false,
    players: { ...state.players, [playerId]: { ...player, turnsToSkip: 3, hidingPosition: player.position } },
  };
}

function normalizeAnswer(text: string): string {
  return text.trim().toLowerCase().replace(/[.,!?]/g, '');
}

/**
 * Collectivization Drive: redistributes all money and tradeable property
 * evenly. The card's own text acknowledges an even split isn't always
 * possible ("if they cannot be divided equally, you agree who gets the
 * excess... failure to agree lands everyone in jail") - we can't run a
 * real negotiation, so any leftover roubles go to the drawer and
 * properties are dealt out round-robin, standing in for "everyone agreed."
 */
function collectivizationDriveEffect(state: GameState, playerId: string, rng: () => number): GameState {
  const playerIds = state.turnOrder;
  const totalRoubles = playerIds.reduce((sum, id) => sum + state.players[id].roubles, 0);
  const share = Math.floor(totalRoubles / playerIds.length);
  const remainder = totalRoubles - share * playerIds.length;

  let next = state;
  for (const id of playerIds) {
    next = {
      ...next,
      players: {
        ...next.players,
        [id]: { ...next.players[id], roubles: share + (id === playerId ? remainder : 0) },
      },
    };
  }

  const pooledTiles = playerIds.flatMap((id) =>
    next.players[id].ownedTileIds.filter((t) => isTradeable(next, t)),
  );
  for (const id of playerIds) {
    const kept = next.players[id].ownedTileIds.filter((t) => !isTradeable(next, t));
    next = { ...next, players: { ...next.players, [id]: { ...next.players[id], ownedTileIds: kept } } };
  }
  shuffle(pooledTiles, rng).forEach((tileId, index) => {
    next = giveTileTo(next, tileId, playerIds[index % playerIds.length]);
  });

  return logEvent(next, 'Collectivization Drive: money and property redistributed evenly among everyone.');
}

/**
 * The Great Purge: everyone loses half their tradeable properties
 * (rounded up, chosen randomly - there's no buildings system yet, so
 * "loses all buildings" has nothing to apply to), and one random player
 * Disappears, standing in for the rock-paper-scissors decider (there's
 * no way to run a real multiplayer RPS from here).
 */
function greatPurgeEffect(state: GameState, _playerId: string, rng: () => number): GameState {
  let next = state;
  for (const id of next.turnOrder) {
    const tradeable = next.players[id].ownedTileIds.filter((t) => isTradeable(next, t));
    const loseCount = Math.ceil(tradeable.length / 2);
    const toLose = new Set(shuffle(tradeable, rng).slice(0, loseCount));
    const remaining = next.players[id].ownedTileIds.filter((t) => !toLose.has(t));
    next = { ...next, players: { ...next.players, [id]: { ...next.players[id], ownedTileIds: remaining } } };
  }
  next = logEvent(next, 'The Great Purge: everyone loses half their tradeable properties.');

  const loserId = next.turnOrder[Math.floor(rng() * next.turnOrder.length)];
  return disappearStub(next, loserId, 'lost the Great Purge (randomly chosen in place of rock-paper-scissors)');
}

/**
 * Bestseller!: the card offers two alternative resolutions ("go to
 * prison until you roll a 6... OR roll one die..."). We only automate
 * the second, simpler branch - the first would need a whole separate
 * jail-like sub-state machine for an already-optional path.
 */
function bestsellerEffect(state: GameState, playerId: string, rng: () => number): GameState {
  let next = giveRoubles(state, playerId, 500);
  const roll = rollOneDie(rng);

  if (roll === 6) {
    return logEvent(next, `Rolled a ${roll} - burned the evidence and denied everything. Kept the 500 roubles.`);
  }
  if (roll === 1) {
    return disappearStub(next, playerId, 'rolled a 1 trying to cover up the bestseller');
  }

  const tradeable = next.players[playerId].ownedTileIds.filter((t) => isTradeable(next, t));
  if (tradeable.length === 0) {
    return logEvent(sendToJail(next, playerId), `Rolled a ${roll} with no property to surrender - sent to jail instead.`);
  }
  const remaining = next.players[playerId].ownedTileIds.filter((t) => !tradeable.includes(t));
  next = { ...next, players: { ...next.players, [playerId]: { ...next.players[playerId], ownedTileIds: remaining } } };
  return logEvent(next, `Rolled a ${roll} - kept the 500 roubles but surrendered all property.`);
}

/**
 * Fourth International: secretly picks one player to be Trotsky, and
 * one property tile as "the hiding place" - standing in for a human
 * Stalin choosing it. Per the rules, the location IS meant to be public
 * ("Stalin will determine a location on the board"); only WHO is
 * Trotsky stays secret, so this logs the location but never the
 * identity - see the NOTE on GamePlayerState.isTrotsky for why even
 * that is only a "soft" secret.
 */
function fourthInternationalEffect(state: GameState, _playerId: string, rng: () => number): GameState {
  const trotskyId = state.turnOrder[Math.floor(rng() * state.turnOrder.length)];
  const players = { ...state.players };
  for (const id of state.turnOrder) {
    players[id] = { ...players[id], isTrotsky: id === trotskyId };
  }
  const trotskyHidingSpot = PROPERTY_TILE_IDS[Math.floor(rng() * PROPERTY_TILE_IDS.length)];
  return logEvent(
    { ...state, players, trotskyHidingSpot },
    `Fourth International: the marked location is ${getTile(trotskyHidingSpot).name}. Land there to accuse someone of being Trotsky.`,
  );
}

// Cards that need the player to pick a target (an opponent, a property,
// or both) before they can be resolved - see resolveCardTarget.
const CARDS_NEEDING_TARGET = new Set(['siegeOfStalingrad', 'doubleAgent']);

// Effects for the cards that can be automated. Any card ID not listed
// here has no automatic effect - its full text still gets shown to the
// table, and players resolve it themselves, same as a physical card.
const CARD_EFFECTS: Record<
  string,
  (state: GameState, playerId: string, rng: () => number) => GameState
> = {
  bankError: (state, playerId) => giveRoubles(state, playerId, 1000),
  accident: (state, playerId) => disappearStub(state, playerId, 'an "accident"'),
  antiRevisionist: (state, playerId) => {
    const player = state.players[playerId];
    return { ...state, players: { ...state.players, [playerId]: { ...player, turnsToSkip: 1 } } };
  },
  partyVanguard: (state, playerId) => setExtraTurns(state, playerId, 2),
  counterRevolutionary: (state, playerId) => toggleDirection(state, playerId),
  culturalRevolution: (state) => toggleDirectionForAll(state),
  blacklist: (state, playerId) => setBlacklisted(state, playerId),
  nomenklatura: (state, playerId, rng) => nomenklaturaEffect(state, playerId, rng),
  goIntoHiding: (state, playerId) => goIntoHidingEffect(state, playerId),
  collectivizationDrive: (state, playerId, rng) => collectivizationDriveEffect(state, playerId, rng),
  greatPurge: (state, playerId, rng) => greatPurgeEffect(state, playerId, rng),
  telegraphUnion: (state, playerId) => ({ ...state, commissarPlayerId: playerId }),
  bestseller: (state, playerId, rng) => bestsellerEffect(state, playerId, rng),
  fourthInternational: (state, playerId, rng) => fourthInternationalEffect(state, playerId, rng),
  denounceCollaborators: (state, playerId) => addToHand(state, playerId, 'denounceCollaborators'),
  secretInformant: (state, playerId) => addToHand(state, playerId, 'secretInformant'),
  showTrial: (state, playerId) => addToHand(state, playerId, 'showTrial'),
};

/**
 * Draws a card (or uses a dev-panel forced one) for a normal landing,
 * or - for Car on Communist Test / Dog on No Chance, their Special
 * Power - opens a cardChoice decision instead, letting the player pick
 * which card to take rather than getting the top one.
 */
function resolveCardLanding(
  state: GameState,
  playerId: string,
  deck: CardDeck,
  rng: () => number,
): GameState {
  const pieceId = state.players[playerId].pieceId;
  const canChoose =
    (pieceId === 'car' && deck === 'communistTest') || (pieceId === 'dog' && deck === 'noChance');
  if (canChoose && !state.forcedCardId) {
    return { ...state, pendingDecision: { type: 'cardChoice', deck } };
  }

  let next: GameState;
  let cardId: string;
  if (state.forcedCardId) {
    cardId = state.forcedCardId;
    next = { ...state, forcedCardId: null };
  } else {
    const drawn = drawCard(state, deck, rng);
    next = drawn.state;
    cardId = drawn.cardId;
  }
  return applyDrawnCard(next, playerId, cardId, rng);
}

/**
 * The current player picks a specific card still in the deck's draw
 * pile (Car/Dog's choose-a-card power), instead of drawing blind. If
 * `cardId` isn't actually in that pile, this is a no-op.
 */
export function chooseCard(
  state: GameState,
  cardId: string,
  rng: () => number = Math.random,
): GameState {
  if (state.pendingDecision?.type !== 'cardChoice') return state;
  const playerId = currentPlayerId(state);
  const { deck } = state.pendingDecision;
  const drawKey = deck === 'communistTest' ? 'communistTestDrawPile' : 'noChanceDrawPile';
  const discardKey = deck === 'communistTest' ? 'communistTestDiscardPile' : 'noChanceDiscardPile';

  if (!state[drawKey].includes(cardId)) return state;

  const next: GameState = {
    ...state,
    [drawKey]: state[drawKey].filter((id) => id !== cardId),
    [discardKey]: [...state[discardKey], cardId],
  };
  return applyDrawnCard(next, playerId, cardId, rng);
}

/**
 * Applies whatever a drawn card ID does. Just reads the card aloud (logs
 * it) and, for Cat, opens a catRedirect decision so they can choose to
 * keep it or hand the whole effect to someone else; every other Piece
 * goes straight into applyCardEffectsFor for themselves. Shared by both
 * a normal draw and Car/Dog's chosen one.
 */
function applyDrawnCard(
  state: GameState,
  playerId: string,
  cardId: string,
  rng: () => number,
): GameState {
  const card = findCard(cardId);
  const next = logEvent(state, `Drew "${card.title}": ${card.text}`);

  // Cat's power: after reading the card, choose to keep it or hand its
  // entire effect (including any follow-up target-selection/quiz) to
  // another player instead.
  if (state.players[playerId].pieceId === 'cat') {
    return { ...next, pendingDecision: { type: 'catRedirect', cardId } };
  }

  return applyCardEffectsFor(next, playerId, cardId, rng);
}

/**
 * Actually applies a card's effect to whichever player it ends up
 * affecting - normally the drawer, but Cat's power can redirect this to
 * someone else. Resolves immediately (see CARD_EFFECTS) or, for cards
 * needing a target, opens a cardTarget decision first. Phone Call from
 * Stalin and NKVD get their own inline handling since a die roll (or a
 * quiz) decides what happens next. Every pendingDecision this opens
 * carries `forPlayerId: affectedPlayerId`, since that player - not
 * necessarily the current turn player - is the one who resolves it.
 */
function applyCardEffectsFor(
  state: GameState,
  affectedPlayerId: string,
  cardId: string,
  rng: () => number,
): GameState {
  let next = state;

  if (cardId === 'phoneCallFromStalin') {
    const roll = rollOneDie(rng);
    if (roll === 1) {
      next = disappearStub(next, affectedPlayerId, `rolled a 1 on the Phone Call from Stalin`);
      return { ...next, pendingDecision: { type: 'cardDrawn', cardId, forPlayerId: affectedPlayerId } };
    }
    next = logEvent(next, `Rolled a ${roll} - choose a free property.`);
    return { ...next, pendingDecision: { type: 'cardTarget', cardId, forPlayerId: affectedPlayerId } };
  }

  if (cardId === 'nkvd') {
    const questionIndex = Math.floor(rng() * NKVD_QUESTIONS.length);
    return { ...next, pendingDecision: { type: 'nkvdQuiz', questionIndex, forPlayerId: affectedPlayerId } };
  }

  if (CARDS_NEEDING_TARGET.has(cardId)) {
    return { ...next, pendingDecision: { type: 'cardTarget', cardId, forPlayerId: affectedPlayerId } };
  }

  const effect = CARD_EFFECTS[cardId];
  if (effect) {
    next = effect(next, affectedPlayerId, rng);
  }
  return { ...next, pendingDecision: { type: 'cardDrawn', cardId, forPlayerId: affectedPlayerId } };
}

/**
 * Resolves Cat's catRedirect decision: `targetPlayerId` of null means
 * "keep it" (effects apply to Cat); otherwise the whole effect - and any
 * follow-up decision it opens - applies to that other player instead.
 */
export function resolveCatRedirect(
  state: GameState,
  targetPlayerId: string | null,
  rng: () => number = Math.random,
): GameState {
  if (state.pendingDecision?.type !== 'catRedirect') return state;
  const catId = currentPlayerId(state);
  if (targetPlayerId !== null && (!state.players[targetPlayerId] || targetPlayerId === catId)) {
    return state; // invalid target
  }

  const affectedPlayerId = targetPlayerId ?? catId;
  const { cardId } = state.pendingDecision;
  const next = logEvent(
    state,
    targetPlayerId === null ? 'Kept the card.' : "Handed the card's effects to another player.",
  );
  return applyCardEffectsFor(next, affectedPlayerId, cardId, rng);
}

/**
 * Draws the top card from a deck, moving it into that deck's discard
 * pile. Reshuffles the discard pile back into the draw pile first if the
 * draw pile has run dry.
 */
function drawCard(
  state: GameState,
  deck: CardDeck,
  rng: () => number,
): { state: GameState; cardId: string } {
  const drawKey = deck === 'communistTest' ? 'communistTestDrawPile' : 'noChanceDrawPile';
  const discardKey =
    deck === 'communistTest' ? 'communistTestDiscardPile' : 'noChanceDiscardPile';

  let drawPile = state[drawKey];
  let discardPile = state[discardKey];
  if (drawPile.length === 0) {
    drawPile = shuffle(discardPile, rng);
    discardPile = [];
  }

  const [cardId, ...remaining] = drawPile;
  return {
    state: { ...state, [drawKey]: remaining, [discardKey]: [...discardPile, cardId] },
    cardId,
  };
}

function resolveLanding(
  state: GameState,
  playerId: string,
  position: number,
  rng: () => number,
): GameState {
  const tile = getTile(position);

  // Telegraph Union: a closed railroad/utility charges anyone but the
  // Commissar a toll instead of its normal effect; the Commissar closes
  // an unclosed one just by landing on it, instead of its normal effect.
  if (state.closedTileIds.includes(position) && playerId !== state.commissarPlayerId) {
    let next = payRoubles(state, playerId, TELEGRAPH_UNION_TOLL);
    if (state.commissarPlayerId) {
      next = giveRoubles(next, state.commissarPlayerId, TELEGRAPH_UNION_TOLL / 2);
    }
    return logEvent(
      next,
      `Paid a ${TELEGRAPH_UNION_TOLL} rouble toll on ${tile.name} (half to the Commissar, half to the State).`,
    );
  }
  if (
    (tile.kind === 'railroad' || tile.kind === 'utility') &&
    playerId === state.commissarPlayerId &&
    !state.closedTileIds.includes(position)
  ) {
    return logEvent(
      { ...state, closedTileIds: [...state.closedTileIds, position] },
      `Closed ${tile.name} as Commissar for Public Works.`,
    );
  }

  switch (tile.kind) {
    case 'property':
    case 'railroad': {
      if (state.destroyedTileIds.includes(tile.id)) {
        return logEvent(
          state,
          `${tile.name} was destroyed in the Chernobyl disaster - it can never be owned again.`,
        );
      }

      const actingPieceId = state.players[playerId].pieceId;
      const ownerId = findOwner(state, tile.id);

      // Wheel Barrel's power: automatically takes any purple-group
      // property - free if unowned, seized with no rent if someone else
      // owns it. Locked tiles (Siege of Stalingrad) stay immune, same as
      // every other forced-transfer mechanic.
      if (
        actingPieceId === 'wheelBarrel' &&
        tile.kind === 'property' &&
        tile.colorGroup === 'purple' &&
        isTradeable(state, tile.id)
      ) {
        if (!ownerId) {
          return logEvent(
            giveTileTo(state, tile.id, playerId),
            `Automatically took ${tile.name} for free (Kulak's power).`,
          );
        }
        if (ownerId !== playerId) {
          return logEvent(
            transferTileOwnership(state, tile.id, ownerId, playerId),
            `Seized ${tile.name} for free - no rent paid (Kulak's power).`,
          );
        }
        return state; // already theirs
      }

      // T-Rex's power: can never buy, but automatically seizes any
      // property/railroad owned by someone else, paying no rent.
      // Chernobyl Power/The Volga are utilities, handled by their own
      // case below, so this never touches "energy and water."
      if (actingPieceId === 'trex' && isTradeable(state, tile.id)) {
        if (!ownerId) {
          return logEvent(state, `${tile.name} is unowned, but T-Rex can't buy properties.`);
        }
        if (ownerId !== playerId) {
          return logEvent(
            transferTileOwnership(state, tile.id, ownerId, playerId),
            `Seized ${tile.name} - no rent paid (T-Rex's power).`,
          );
        }
        return state; // already theirs
      }

      if (!ownerId) {
        if (state.players[playerId].blacklisted) {
          return logEvent(state, `Blacklisted - can't buy ${tile.name}.`);
        }
        return {
          ...state,
          pendingDecision: { type: 'purchase', tileId: tile.id },
        };
      }
      if (ownerId === playerId) {
        return state; // already yours, nothing happens
      }
      if (state.mortgagedTileIds.includes(tile.id)) {
        return logEvent(state, `${tile.name} is mortgaged - no rent owed.`);
      }

      const rent =
        tile.kind === 'railroad'
          ? RAILROAD_RENT_BY_COUNT[railroadsOwnedBy(state, ownerId) - 1]
          : tile.rentTable[state.propertyHouses[tile.id] ?? 0];

      const next = payRoubles(state, playerId, rent);
      const owner = state.players[ownerId];
      if (owner.inJail || owner.blacklisted) {
        // "When in jail, any rent you collect is seized by the state" -
        // Blacklist's "cannot... collect rent" gets the same treatment:
        // the payer still pays, but the owner never sees it.
        return logEvent(
          next,
          `Paid ${rent} roubles rent on ${tile.name}, seized by the State (owner is ${owner.inJail ? 'in jail' : 'blacklisted'}).`,
        );
      }
      return logEvent(
        giveRoubles(next, ownerId, rent),
        `Paid ${rent} roubles rent on ${tile.name}.`,
      );
    }
    case 'goToJail':
      return logEvent(sendToJail(state, playerId), 'Sent directly to jail!');
    case 'utility':
      if (tile.id === CHERNOBYL_TILE_ID) return resolveChernobylLanding(state, playerId);
      if (tile.id === VOLGA_TILE_ID) return resolveVolgaLanding(state, playerId);
      return state;
    case 'special':
      if (tile.id === KREMLIN_TILE_ID) return resolveKremlinLanding(state, playerId);
      if (tile.id === NKVD_TILE_ID) return resolveNkvdLanding(state, playerId);
      return state;
    case 'card':
      return resolveCardLanding(state, playerId, tile.deck, rng);
    // Jail (just visiting) and Free Parking have no effect yet -
    // Smuggling isn't implemented in this increment.
    default:
      return state;
  }
}

/**
 * Moves a player by `steps`, resolving STOY and whatever they land on.
 * Shared by a normal roll, a jail-escape roll, and a forced "advance to"
 * card effect (Nomenklatura), since all three work the same way once you
 * know where movement starts from and which direction it runs.
 */
function moveAndResolve(
  state: GameState,
  playerId: string,
  steps: number,
  rng: () => number,
  options: { waiveStoyFee?: boolean } = {},
): GameState {
  const player = state.players[playerId];
  const rawNewPosition = player.movingBackward
    ? player.position - steps
    : player.position + steps;
  const newPosition = ((rawNewPosition % BOARD_SIZE) + BOARD_SIZE) % BOARD_SIZE;
  // Landing exactly on STOY pays out; merely passing through it (wrapping
  // past it in either direction) costs a fee instead - the reverse of
  // regular Monopoly's "Go," per the source rules.
  const wrapped = rawNewPosition >= BOARD_SIZE || rawNewPosition < 0;
  const passedStoy = wrapped && newPosition !== 0;
  const landedOnStoy = newPosition === 0;

  let next: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, position: newPosition },
    },
  };

  next = logEvent(next, `Moved to ${getTile(newPosition).name}.`);

  // Iron's power: never has to pay the bribe to pass STOY.
  if (passedStoy && !options.waiveStoyFee && player.pieceId !== 'iron') {
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

  // Blacklist clears once you've made it back around to (or through)
  // STOY - an approximation of "a full circle from your current
  // location," which would otherwise need tracking an arbitrary
  // per-player start tile rather than reusing the STOY-crossing check
  // every move already computes.
  if ((passedStoy || landedOnStoy) && next.players[playerId].blacklisted) {
    next = {
      ...next,
      players: { ...next.players, [playerId]: { ...next.players[playerId], blacklisted: false } },
    };
    next = logEvent(next, 'No longer blacklisted - you can buy and collect rent again.');
  }

  // Go Into Hiding: landing exactly on someone else's hiding spot finds
  // them out - they Disappear early.
  for (const [otherId, otherPlayer] of Object.entries(next.players)) {
    if (otherId !== playerId && otherPlayer.hidingPosition === newPosition) {
      next = disappearStub(next, otherId, 'found while hiding');
    }
  }

  // Rubber duck's power: their own move landing on an occupied square
  // offers the option to jail whoever's there. This runs independently
  // of pendingDecision (see rubberDuckEncounter's type comment) rather
  // than competing with whatever else this landing might trigger (e.g.
  // an unowned property's purchase prompt).
  if (next.players[playerId].pieceId === 'rubberDuck') {
    const coOccupant = Object.entries(next.players).find(
      ([id, p]) => id !== playerId && p.position === newPosition,
    );
    if (coOccupant) {
      next = {
        ...next,
        rubberDuckEncounter: { rubberDuckPlayerId: playerId, targetPlayerId: coOccupant[0] },
      };
    }
  }

  // Phone Call from Stalin: landing back on a property this player was
  // given for free Disappears them, before any other landing effect.
  const trap = next.phoneCallTraps.find((t) => t.tileId === newPosition && t.playerId === playerId);
  if (trap) {
    next = { ...next, phoneCallTraps: next.phoneCallTraps.filter((t) => t !== trap) };
    return disappearStub(next, playerId, 'landed back on a Phone Call from Stalin property');
  }

  return resolveLanding(next, playerId, newPosition, rng);
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
  rng: () => number,
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
      rng,
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

  // Thimble's power: only rolls 1 die. Representing that as [n, 0]
  // (rather than changing the roll's shape everywhere) makes the
  // existing math work out for free: steps = n + 0 = n, and isDoubles =
  // (n === 0) is always false, since a die never shows 0 - exactly
  // right, since a single die can't roll doubles.
  const roll =
    state.forcedRoll ??
    (player.pieceId === 'thimble' ? ([rollOneDie(rng), 0] as [number, number]) : rollTwoDice(rng));
  const [die1, die2] = roll;
  const isDoubles = die1 === die2;
  const steps = die1 + die2;

  let next: GameState = { ...state, forcedRoll: null, lastRoll: roll };
  next = logEvent(
    next,
    player.pieceId === 'thimble'
      ? `Rolled ${die1} (one die).`
      : `Rolled ${die1} + ${die2}${isDoubles ? ' (doubles!)' : ''}.`,
  );

  if (player.inJail) {
    return resolveJailRoll(next, playerId, die1, die2, isDoubles, steps, rng);
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
  return moveAndResolve(next, playerId, steps, rng);
}

/** The current player buys the property/railroad they just landed on. */
export function buyProperty(state: GameState): GameState {
  const playerId = currentPlayerId(state);
  if (state.pendingDecision?.type !== 'purchase') return state;

  const tile = getTile(state.pendingDecision.tileId);
  if (tile.kind !== 'property' && tile.kind !== 'railroad') return state;

  const player = state.players[playerId];
  // Battleship's power: rail stations are half price.
  const price =
    tile.kind === 'railroad' && player.pieceId === 'battleship'
      ? Math.floor(tile.price / 2)
      : tile.price;
  if (player.roubles < price) return state; // can't afford it - use Skip instead

  let next = payRoubles(state, playerId, price);
  next = { ...giveTileTo(next, tile.id, playerId), pendingDecision: null };
  return logEvent(next, `Bought ${tile.name} for ${price} roubles.`);
}

/** The current player declines to buy - the property stays unowned. */
export function skipPurchase(state: GameState): GameState {
  if (state.pendingDecision?.type !== 'purchase') return state;
  return logEvent({ ...state, pendingDecision: null }, 'Declined to buy.');
}

/** The current player gives away everything they own (split evenly among the other players) to claim The Volga. */
export function acceptVolgaOffer(state: GameState): GameState {
  const playerId = currentPlayerId(state);
  if (state.pendingDecision?.type !== 'volgaOffer') return state;

  const otherPlayers = state.turnOrder.filter((id) => id !== playerId);
  const propertiesToGive = tradeableTileIds(state, state.players[playerId].ownedTileIds);

  let next = state;
  propertiesToGive.forEach((tileId, index) => {
    const recipient = otherPlayers[index % otherPlayers.length];
    next = transferTileOwnership(next, tileId, playerId, recipient);
  });
  next = giveTileTo(next, VOLGA_TILE_ID, playerId);
  next = { ...next, pendingDecision: null };
  return logEvent(
    next,
    'Distributed all your properties evenly among the others and claimed The Volga.',
  );
}

/** The current player declines the Volga offer - keeps their properties, doesn't get the Volga. */
export function declineVolgaOffer(state: GameState): GameState {
  if (state.pendingDecision?.type !== 'volgaOffer') return state;
  return logEvent(
    { ...state, pendingDecision: null },
    'Declined to give up your properties for The Volga.',
  );
}

/**
 * Resolves a card that needed a target: Siege of Stalingrad (an
 * opponent's property to seize permanently), Double Agent (a player to
 * swap Pieces with), or Phone Call from Stalin (any property to claim
 * for free, which then traps that piece - see moveAndResolve).
 */
export function resolveCardTarget(
  state: GameState,
  selection: { targetPlayerId?: string; targetTileId?: number },
): GameState {
  if (state.pendingDecision?.type !== 'cardTarget') return state;
  const { cardId, forPlayerId: playerId } = state.pendingDecision;
  let next = state;

  if (cardId === 'siegeOfStalingrad' && selection.targetTileId !== undefined) {
    const tileId = selection.targetTileId;
    const ownerId = findOwner(state, tileId);
    if (ownerId && ownerId !== playerId && isTradeable(state, tileId)) {
      next = transferTileOwnership(state, tileId, ownerId, playerId);
      next = { ...next, lockedTileIds: [...next.lockedTileIds, tileId] };
      next = logEvent(next, `Seized ${getTile(tileId).name} permanently.`);
    }
  } else if (cardId === 'doubleAgent' && selection.targetPlayerId) {
    const targetId = selection.targetPlayerId;
    if (targetId !== playerId && state.players[targetId]) {
      const a = state.players[playerId];
      const b = state.players[targetId];
      next = {
        ...state,
        players: {
          ...state.players,
          [playerId]: { ...a, pieceId: b.pieceId },
          [targetId]: { ...b, pieceId: a.pieceId },
        },
      };
      next = logEvent(next, 'Swapped Pieces with another player.');
    }
  } else if (cardId === 'phoneCallFromStalin' && selection.targetTileId !== undefined) {
    const tileId = selection.targetTileId;
    const ownerId = findOwner(state, tileId);
    next = ownerId
      ? transferTileOwnership(state, tileId, ownerId, playerId)
      : giveTileTo(state, tileId, playerId);
    next = { ...next, phoneCallTraps: [...next.phoneCallTraps, { playerId, tileId }] };
    next = logEvent(next, `Claimed ${getTile(tileId).name} for free - but landing there again means Disappearing.`);
  }

  return { ...next, pendingDecision: { type: 'cardDrawn', cardId, forPlayerId: playerId } };
}

/** Uses a held Denounce Your Collaborators card: only while in jail, swaps places with the chosen player (who goes to jail instead). Consumes the card. */
export function useDenounceCollaborators(
  state: GameState,
  playerId: string,
  targetPlayerId: string,
): GameState {
  const player = state.players[playerId];
  const target = state.players[targetPlayerId];
  if (!player.heldCardIds.includes('denounceCollaborators')) return state;
  if (!player.inJail || !target || targetPlayerId === playerId) return state;

  const next: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...player,
        inJail: false,
        position: target.position,
        heldCardIds: player.heldCardIds.filter((id) => id !== 'denounceCollaborators'),
      },
      [targetPlayerId]: { ...target, inJail: true, position: JAIL_POSITION },
    },
  };
  return logEvent(next, 'Used Denounce Your Collaborators to swap places out of jail.');
}

/** Uses a held Secret Informant card: only when standing on the same tile as the target, sends them to jail. Consumes the card, returning it to the bottom of the Communist Test deck per its own text. */
export function useSecretInformant(
  state: GameState,
  playerId: string,
  targetPlayerId: string,
): GameState {
  const player = state.players[playerId];
  const target = state.players[targetPlayerId];
  if (!player.heldCardIds.includes('secretInformant')) return state;
  if (!target || targetPlayerId === playerId || target.position !== player.position) return state;

  let next: GameState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, heldCardIds: player.heldCardIds.filter((id) => id !== 'secretInformant') },
    },
  };
  next = sendToJail(next, targetPlayerId);
  next = { ...next, communistTestDrawPile: [...next.communistTestDrawPile, 'secretInformant'] };
  return logEvent(next, 'Used Secret Informant to send someone to jail.');
}

/**
 * Uses a held Show Trial card to call a vote on a jailed player (who can
 * be the caller themselves - being in jail is exactly when you'd want
 * to call this). Consumes the card immediately, since calling the vote
 * IS "using" it - it's a one-shot card, not a reusable one. Every
 * player then votes release/disappear via castShowTrialVote(); the
 * caller's own vote counts double, per the card's text.
 */
export function callShowTrial(
  state: GameState,
  playerId: string,
  targetPlayerId: string,
): GameState {
  const player = state.players[playerId];
  const target = state.players[targetPlayerId];
  if (!player.heldCardIds.includes('showTrial')) return state;
  if (!target || !target.inJail) return state;
  if (state.activeVote) return state; // one trial at a time

  const next: GameState = {
    ...state,
    activeVote: { callerId: playerId, targetPlayerId, votes: {} },
    players: {
      ...state.players,
      [playerId]: { ...player, heldCardIds: player.heldCardIds.filter((id) => id !== 'showTrial') },
    },
  };
  return logEvent(next, 'A Show Trial has been called - everyone gets a vote.');
}

/**
 * Casts (or changes) one player's vote in the active Show Trial. Once
 * everyone has voted, tallies them (the caller's vote counts double) and
 * resolves immediately. A tie falls back to a coin flip, standing in for
 * "Stalin breaks ties" since there's no human Stalin to ask.
 */
export function castShowTrialVote(
  state: GameState,
  playerId: string,
  vote: 'release' | 'disappear',
  rng: () => number = Math.random,
): GameState {
  if (!state.activeVote || !state.players[playerId]) return state;

  let next: GameState = {
    ...state,
    activeVote: { ...state.activeVote, votes: { ...state.activeVote.votes, [playerId]: vote } },
  };

  if (Object.keys(next.activeVote!.votes).length === next.turnOrder.length) {
    next = resolveShowTrialVote(next, rng);
  }
  return next;
}

function resolveShowTrialVote(state: GameState, rng: () => number): GameState {
  const activeVote = state.activeVote;
  if (!activeVote) return state;

  let releaseWeight = 0;
  let disappearWeight = 0;
  for (const [voterId, choice] of Object.entries(activeVote.votes)) {
    const weight = voterId === activeVote.callerId ? 2 : 1;
    if (choice === 'release') releaseWeight += weight;
    else disappearWeight += weight;
  }

  const verdict: 'release' | 'disappear' =
    releaseWeight === disappearWeight
      ? rng() < 0.5
        ? 'release'
        : 'disappear' // tie - "Stalin breaks ties," standing in with a coin flip
      : releaseWeight > disappearWeight
        ? 'release'
        : 'disappear';

  const next: GameState = { ...state, activeVote: null };
  if (verdict === 'disappear') {
    return disappearStub(next, activeVote.targetPlayerId, 'Disappeared by a Show Trial vote');
  }
  const target = next.players[activeVote.targetPlayerId];
  return logEvent(
    { ...next, players: { ...next.players, [activeVote.targetPlayerId]: { ...target, inJail: false } } },
    'Released from jail by a Show Trial vote.',
  );
}

/** Answers NKVD's doctrine question. A (loosely normalized) correct match just moves on; anything else sends the current player to jail. */
export function answerNkvdQuiz(state: GameState, answerText: string): GameState {
  if (state.pendingDecision?.type !== 'nkvdQuiz') return state;
  const playerId = state.pendingDecision.forPlayerId;
  const question = NKVD_QUESTIONS[state.pendingDecision.questionIndex];

  const next: GameState = { ...state, pendingDecision: null };
  if (normalizeAnswer(answerText) === normalizeAnswer(question.answer)) {
    return logEvent(next, `Answered the doctrine question correctly.`);
  }
  return logEvent(
    sendToJail(next, playerId),
    `Answered "${answerText}" - wrong (the answer was "${question.answer}") - sent to jail.`,
  );
}

/** Resolves Rubber duck's jail-offer: sends the co-located player to jail if `sendToJailChoice` is true, otherwise just dismisses it. */
export function resolveRubberDuckEncounter(state: GameState, sendToJailChoice: boolean): GameState {
  if (!state.rubberDuckEncounter) return state;
  const { targetPlayerId } = state.rubberDuckEncounter;
  const next: GameState = { ...state, rubberDuckEncounter: null };
  if (!sendToJailChoice) {
    return logEvent(next, 'Chose not to send them to jail.');
  }
  return logEvent(sendToJail(next, targetPlayerId), "Sent them to jail (Stalin's body-double).");
}

/**
 * Builds one house on a property (or, from 4 houses, the hotel that
 * replaces them) - same rules as base Monopoly: the player must own
 * every property in that color group, and the bank's house/hotel supply
 * must have one available. A hotel purchase returns its 4 houses to the
 * bank's supply. No even-building requirement across the group - any
 * owned property in a completed group can be built on independently.
 */
export function buildHouse(state: GameState, playerId: string, tileId: number): GameState {
  const tile = getTile(tileId);
  if (tile.kind !== 'property') return state;
  const player = state.players[playerId];
  if (!player.ownedTileIds.includes(tileId)) return state;
  if (!ownsFullGroup(state, playerId, tile.colorGroup)) return state;
  if (state.mortgagedTileIds.includes(tileId)) return state;

  const current = state.propertyHouses[tileId] ?? 0;
  if (current >= 5) return state; // already a hotel
  if (player.roubles < tile.houseCost) return state;

  if (current === 4) {
    if (state.hotelsRemaining <= 0) {
      return logEvent(state, `No hotels left in the bank - can't build on ${tile.name}.`);
    }
    const next: GameState = {
      ...payRoubles(state, playerId, tile.houseCost),
      propertyHouses: { ...state.propertyHouses, [tileId]: 5 },
      hotelsRemaining: state.hotelsRemaining - 1,
      housesRemaining: state.housesRemaining + 4,
    };
    return logEvent(next, `Built a hotel on ${tile.name} for ${tile.houseCost} roubles.`);
  }

  if (state.housesRemaining <= 0) {
    return logEvent(state, `No houses left in the bank - can't build on ${tile.name}.`);
  }
  const next: GameState = {
    ...payRoubles(state, playerId, tile.houseCost),
    propertyHouses: { ...state.propertyHouses, [tileId]: current + 1 },
    housesRemaining: state.housesRemaining - 1,
  };
  return logEvent(next, `Built a house on ${tile.name} for ${tile.houseCost} roubles.`);
}

/** Sells one house (or, from a hotel, converts it back to 4 houses) back to the bank for half its cost - standard Monopoly rule. */
export function sellHouse(state: GameState, playerId: string, tileId: number): GameState {
  const tile = getTile(tileId);
  if (tile.kind !== 'property') return state;
  const player = state.players[playerId];
  if (!player.ownedTileIds.includes(tileId)) return state;

  const current = state.propertyHouses[tileId] ?? 0;
  if (current === 0) return state;
  const refund = Math.floor(tile.houseCost / 2);

  if (current === 5) {
    if (state.housesRemaining < 4) {
      return logEvent(state, `Not enough houses left in the bank to break down the hotel on ${tile.name}.`);
    }
    const next: GameState = {
      ...giveRoubles(state, playerId, refund),
      propertyHouses: { ...state.propertyHouses, [tileId]: 4 },
      hotelsRemaining: state.hotelsRemaining + 1,
      housesRemaining: state.housesRemaining - 4,
    };
    return logEvent(next, `Sold the hotel on ${tile.name} back to the bank for ${refund} roubles (returns as 4 houses).`);
  }

  const next: GameState = {
    ...giveRoubles(state, playerId, refund),
    propertyHouses: { ...state.propertyHouses, [tileId]: current - 1 },
    housesRemaining: state.housesRemaining + 1,
  };
  return logEvent(next, `Sold a house on ${tile.name} back to the bank for ${refund} roubles.`);
}

/**
 * Mortgages a property or railroad: the owner collects half its price
 * from the bank, and stops collecting rent on it until they pay the
 * mortgage off. Standard Monopoly rule: blocked while there are still
 * houses anywhere in that property's color group (sell them all first).
 * Utilities aren't mortgageable here - Chernobyl Power/The Volga have no
 * price, being forced-ownership special tiles with their own rules.
 */
export function mortgageProperty(state: GameState, playerId: string, tileId: number): GameState {
  const tile = getTile(tileId);
  if (tile.kind !== 'property' && tile.kind !== 'railroad') return state;
  const player = state.players[playerId];
  if (!player.ownedTileIds.includes(tileId)) return state;
  if (state.mortgagedTileIds.includes(tileId)) return state;

  if (tile.kind === 'property') {
    const groupHasHouses = tileIdsInGroup(tile.colorGroup).some(
      (id) => (state.propertyHouses[id] ?? 0) > 0,
    );
    if (groupHasHouses) {
      return logEvent(state, `Can't mortgage ${tile.name} - sell all houses in the collection first.`);
    }
  }

  const mortgageValue = Math.floor(tile.price / 2);
  const next: GameState = {
    ...giveRoubles(state, playerId, mortgageValue),
    mortgagedTileIds: [...state.mortgagedTileIds, tileId],
  };
  return logEvent(next, `Mortgaged ${tile.name} for ${mortgageValue} roubles.`);
}

/** Pays off a mortgaged property or railroad: the mortgage value plus 10% interest, standard Monopoly rule. Rent can be collected on it again afterward. */
export function unmortgageProperty(state: GameState, playerId: string, tileId: number): GameState {
  const tile = getTile(tileId);
  if (tile.kind !== 'property' && tile.kind !== 'railroad') return state;
  const player = state.players[playerId];
  if (!player.ownedTileIds.includes(tileId)) return state;
  if (!state.mortgagedTileIds.includes(tileId)) return state;

  const payoff = Math.round((tile.price / 2) * MORTGAGE_PAYOFF_MULTIPLIER);
  if (player.roubles < payoff) {
    return logEvent(state, `Not enough roubles to pay off the mortgage on ${tile.name} (need ${payoff}).`);
  }

  const next: GameState = {
    ...payRoubles(state, playerId, payoff),
    mortgagedTileIds: state.mortgagedTileIds.filter((id) => id !== tileId),
  };
  return logEvent(next, `Paid off the mortgage on ${tile.name} for ${payoff} roubles.`);
}

/**
 * Accuses a player of being Trotsky (Fourth International) - a house
 * rule variant requested in place of the source card's literal (and
 * oddly self-defeating) "the claimant Disappears either way" text. Only
 * works if the current player is standing exactly on the public hiding
 * spot. Guessing right exposes and Disappears the accused; guessing
 * wrong sends the accuser to jail instead.
 */
export function accuseOfTrotsky(state: GameState, accusedId: string): GameState {
  const playerId = currentPlayerId(state);
  const player = state.players[playerId];
  const accused = state.players[accusedId];
  if (state.trotskyHidingSpot === null || player.position !== state.trotskyHidingSpot) {
    return state;
  }
  if (!accused || accusedId === playerId) return state;

  const wasTrotsky = accused.isTrotsky;
  let next: GameState = { ...state, trotskyHidingSpot: null };
  for (const id of next.turnOrder) {
    next = { ...next, players: { ...next.players, [id]: { ...next.players[id], isTrotsky: false } } };
  }

  if (wasTrotsky) {
    return disappearStub(next, accusedId, 'was correctly accused of being Trotsky');
  }
  return logEvent(sendToJail(next, playerId), 'The accusation was wrong - sent to jail.');
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
 * you will disappear." It also ticks the Chernobyl Power countdown once
 * (see tickChernobyl) and skips over any player whose next turn(s) were
 * cancelled (see advanceTurn).
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

  // Rubber duck's jail-offer lapses (implicitly "no") if their turn ends
  // without acting on it.
  if (next.rubberDuckEncounter?.rubberDuckPlayerId === endingPlayerId) {
    next = { ...next, rubberDuckEncounter: null };
  }

  next = tickChernobyl(next, endingPlayerId);

  // Party Vanguard grants extra turns "in quick succession" - work
  // through those before the turn actually passes to anyone else.
  const endingPlayer = next.players[endingPlayerId];
  if (endingPlayer.extraTurns > 0) {
    next = {
      ...next,
      players: {
        ...next.players,
        [endingPlayerId]: { ...endingPlayer, extraTurns: endingPlayer.extraTurns - 1 },
      },
    };
    return { ...next, lastRoll: null, lastRollWasDoubles: false, doublesCount: 0 };
  }

  next = advanceTurn(next);

  return {
    ...next,
    lastRoll: null,
    lastRollWasDoubles: false,
    doublesCount: 0,
  };
}

/** Acknowledges a drawn card, letting the turn continue. Any automatic effect already applied at draw time - this just dismisses the card banner. */
export function acknowledgeCard(state: GameState): GameState {
  if (state.pendingDecision?.type !== 'cardDrawn') return state;
  return { ...state, pendingDecision: null };
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

/**
 * Ticks the Chernobyl Power countdown once, called at the end of a
 * turn - but only counts down on the OWNER's own turns ending, not
 * everyone else's ("explode in 3 turns" means 3 of their turns). Safe
 * (no countdown) whenever it's unowned or the owner also holds The
 * Volga; otherwise the countdown starts (or keeps counting down) toward
 * 0, at which point it explodes.
 */
function tickChernobyl(state: GameState, endingPlayerId: string): GameState {
  const ownerId = findOwner(state, CHERNOBYL_TILE_ID);
  if (!ownerId || state.players[ownerId].ownedTileIds.includes(VOLGA_TILE_ID)) {
    return { ...state, chernobylCountdown: null };
  }
  if (ownerId !== endingPlayerId) {
    return state; // not the owner's turn - the countdown doesn't move
  }

  const remaining = (state.chernobylCountdown ?? CHERNOBYL_COUNTDOWN_TURNS) - 1;
  if (remaining <= 0) {
    return explodeChernobyl(state, ownerId);
  }
  return logEvent(
    { ...state, chernobylCountdown: remaining },
    `Chernobyl Power will explode in ${remaining} of its owner's turn${remaining === 1 ? '' : 's'} unless they get The Volga.`,
  );
}

function explodeChernobyl(state: GameState, ownerId: string): GameState {
  const owner = state.players[ownerId];
  const destroyedNow = owner.ownedTileIds.filter((id) => id !== CHERNOBYL_TILE_ID);

  const next: GameState = {
    ...state,
    chernobylCountdown: null,
    destroyedTileIds: [...state.destroyedTileIds, ...destroyedNow],
    players: { ...state.players, [ownerId]: { ...owner, ownedTileIds: [] } },
  };
  return logEvent(
    next,
    "Chernobyl Power exploded! All of its owner's other properties are destroyed forever.",
  );
}

/**
 * Moves currentTurnIndex to the next player, skipping over (and
 * decrementing turnsToSkip on) anyone still sitting out a penalty.
 * Bounded to one lap of the table so it can't loop forever in the freak
 * case where every remaining player is somehow flagged at once.
 */
function advanceTurn(state: GameState): GameState {
  let next = state;
  let index = next.currentTurnIndex;

  for (let i = 0; i < next.turnOrder.length; i++) {
    index = (index + 1) % next.turnOrder.length;
    const candidateId = next.turnOrder[index];
    const candidate = next.players[candidateId];

    if (candidate.turnsToSkip > 0) {
      const turnsToSkip = candidate.turnsToSkip - 1;
      next = logEvent(
        {
          ...next,
          players: {
            ...next.players,
            [candidateId]: {
              ...candidate,
              turnsToSkip,
              // Their hiding period ends along with the skip - "out of hiding."
              hidingPosition: turnsToSkip === 0 ? null : candidate.hidingPosition,
            },
          },
        },
        'A turn was skipped.',
      );
      continue;
    }

    return { ...next, currentTurnIndex: index };
  }

  return { ...next, currentTurnIndex: index };
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

export function devSetForcedCard(
  state: GameState,
  cardId: string | null,
): GameState {
  return { ...state, forcedCardId: cardId };
}

/**
 * Teleports the current player to any tile and resolves landing on it,
 * same as if they'd rolled their way there - buys/rent/jail/cards/all of
 * it. Always approaches from the front (ignores movingBackward) and
 * waives the STOY pass fee, same simplification as Nomenklatura's
 * "advance to" movement, since this is a testing shortcut, not a real
 * move.
 */
export function devJumpToTile(
  state: GameState,
  tileId: number,
  rng: () => number = Math.random,
): GameState {
  const playerId = currentPlayerId(state);
  const player = state.players[playerId];
  const forwardSteps = (tileId - player.position + BOARD_SIZE) % BOARD_SIZE;

  if (forwardSteps === 0) {
    return resolveLanding(state, playerId, tileId, rng);
  }
  const forcedForward: GameState = {
    ...state,
    players: { ...state.players, [playerId]: { ...player, movingBackward: false } },
  };
  return moveAndResolve(forcedForward, playerId, forwardSteps, rng, { waiveStoyFee: true });
}

/** Draws a card for the current player right now, regardless of where they're standing - uses forcedCardId if one's set, otherwise a real draw from the given deck's pile. */
export function devDrawCard(
  state: GameState,
  deck: CardDeck,
  rng: () => number = Math.random,
): GameState {
  const playerId = currentPlayerId(state);
  return resolveCardLanding(state, playerId, deck, rng);
}
