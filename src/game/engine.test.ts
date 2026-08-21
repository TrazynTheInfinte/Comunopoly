import { describe, expect, it } from 'vitest';
import {
  acceptVolgaOffer,
  accuseOfTrotsky,
  acknowledgeCard,
  answerNkvdQuiz,
  buyProperty,
  callShowTrial,
  castShowTrialVote,
  chooseCard,
  createInitialGameState,
  declineVolgaOffer,
  devDrawCard,
  devJumpToTile,
  devSetForcedCard,
  devSetForcedRoll,
  endTurn,
  resolveCardTarget,
  resolveCatRedirect,
  resolveRubberDuckEncounter,
  rollDice,
  skipPurchase,
  useDenounceCollaborators,
  useSecretInformant,
} from './engine';
import { COMMUNIST_TEST_CARDS, NO_CHANCE_CARDS } from '../data/cards';
import { getTile } from '../data/board';
import type { GameState } from '../types/game';

const PLAYERS = [
  { playerId: 'p1', pieceId: 'boot' as const },
  { playerId: 'p2', pieceId: 'battleship' as const },
];

/** Test helper: moves a player straight to a position without going through rollDice, for setting up landing scenarios. */
function withPosition(
  state: GameState,
  playerId: string,
  position: number,
): GameState {
  return {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...state.players[playerId], position },
    },
  };
}

describe('createInitialGameState', () => {
  it('starts every player on STOY with 1000 roubles', () => {
    const state = createInitialGameState(PLAYERS);
    expect(state.players.p1).toMatchObject({
      position: 0,
      roubles: 1000,
      pieceId: 'boot',
    });
    expect(state.currentTurnIndex).toBe(0);
  });
});

describe('rollDice', () => {
  it('moves the current player by the sum of the dice', () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetForcedRoll(state, [2, 3]);
    state = rollDice(state);
    expect(state.players.p1.position).toBe(5);
  });

  it('pays 200 roubles for landing exactly on STOY', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 38);
    state = devSetForcedRoll(state, [1, 1]); // 38 + 2 = 40 -> wraps to 0
    state = rollDice(state);
    expect(state.players.p1.position).toBe(0);
    expect(state.players.p1.roubles).toBe(1000 + 200);
  });

  it('charges a 50 rouble fee for passing STOY without landing on it', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 38);
    state = devSetForcedRoll(state, [1, 2]); // 38 + 3 = 41 -> wraps to 1
    state = rollDice(state);
    expect(state.players.p1.position).toBe(1);
    expect(state.players.p1.roubles).toBe(1000 - 50);
  });

  it('flags doubles so the same player can roll again', () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetForcedRoll(state, [4, 4]);
    state = rollDice(state);
    expect(state.lastRollWasDoubles).toBe(true);

    state = endTurn(state);
    expect(state.currentTurnIndex).toBe(0); // still p1's turn
  });

  it('lands on an unowned property and opens a purchase decision instead of buying automatically', () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetForcedRoll(state, [3, 3]); // 0 + 6 -> Moscow Metro (tile 6, property)
    state = rollDice(state);
    expect(state.pendingDecision).toEqual({ type: 'purchase', tileId: 6 });
    expect(state.players.p1.ownedTileIds).toEqual([]);
  });
});

describe('buyProperty', () => {
  it('deducts the price and adds the tile to the buyer, clearing the decision', () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetForcedRoll(state, [3, 3]); // lands on Moscow Metro, price 100
    state = rollDice(state);

    state = buyProperty(state);

    expect(state.players.p1.roubles).toBe(1000 - 100);
    expect(state.players.p1.ownedTileIds).toEqual([6]);
    expect(state.pendingDecision).toBeNull();
  });

  it("does nothing if there's no pending purchase", () => {
    const state = createInitialGameState(PLAYERS);
    expect(buyProperty(state)).toEqual(state);
  });
});

describe('skipPurchase', () => {
  it('clears the decision without spending anything', () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetForcedRoll(state, [3, 3]);
    state = rollDice(state);

    state = skipPurchase(state);

    expect(state.pendingDecision).toBeNull();
    expect(state.players.p1.roubles).toBe(1000);
    expect(state.players.p1.ownedTileIds).toEqual([]);
  });
});

describe('rent', () => {
  it('charges a flat percentage of price for landing on a property someone else owns', () => {
    let state = createInitialGameState(PLAYERS);
    // p1 buys Moscow Metro (tile 6, price 100). Non-double roll so the
    // turn actually passes to p2 afterwards.
    state = devSetForcedRoll(state, [2, 4]);
    state = rollDice(state);
    state = buyProperty(state);
    state = endTurn(state); // now p2's turn

    // p2 lands on the same tile.
    state = devSetForcedRoll(state, [2, 4]);
    state = rollDice(state);

    const expectedRent = Math.round(100 * 0.2); // 20
    expect(state.players.p2.roubles).toBe(1000 - expectedRent);
    expect(state.players.p1.roubles).toBe(1000 - 100 + expectedRent);
  });

  it("seizes rent for the State instead of paying it to a jailed owner", () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetForcedRoll(state, [2, 4]); // p1 buys Moscow Metro (tile 6)
    state = rollDice(state);
    state = buyProperty(state);
    state = endTurn(state); // p2's turn

    // Jail p1 directly (setup, not via a real roll).
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, inJail: true } },
    };

    state = devSetForcedRoll(state, [2, 4]); // p2 lands on tile 6 again
    state = rollDice(state);

    expect(state.players.p2.roubles).toBe(1000 - 20); // still pays rent
    expect(state.players.p1.roubles).toBe(1000 - 100); // but the jailed owner never receives it
  });

  it('scales railroad rent with how many the owner has', () => {
    let state = createInitialGameState(PLAYERS);
    // Hand p1 two railroads directly (tiles 5 and 15) to set up the scenario.
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, ownedTileIds: [5, 15] },
      },
    };
    state = endTurn(state); // p1 has no pending roll, but move to p2's turn

    state = devSetForcedRoll(state, [2, 3]); // p2: 0 + 5 -> tile 5, a railroad p1 owns
    state = rollDice(state);

    expect(state.players.p2.roubles).toBe(1000 - 50); // 2 railroads owned -> 50 rent
    expect(state.players.p1.roubles).toBe(1000 + 50);
  });
});

describe('jail', () => {
  it('sends a player straight to jail when landing on the Go To Jail tile', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 20); // Free Parking
    state = devSetForcedRoll(state, [4, 6]); // sum 10 -> tile 30, Go To Jail
    state = rollDice(state);

    expect(state.players.p1.position).toBe(10);
    expect(state.players.p1.inJail).toBe(true);
  });

  it('sends a player to jail after three consecutive doubles instead of moving', () => {
    let state = createInitialGameState(PLAYERS);
    // Start somewhere that two +4 moves land on plain properties, not a
    // card tile - drawing a random card here would make this test flaky
    // (e.g. a card that changes movingBackward or Disappears the player).
    // (11, not 10/JAIL_POSITION, so the final assertion isn't trivially
    // true just because we started there.)
    state = withPosition(state, 'p1', 11);
    state = devSetForcedRoll(state, [2, 2]);
    state = rollDice(state);
    state = devSetForcedRoll(state, [2, 2]);
    state = rollDice(state);
    state = devSetForcedRoll(state, [2, 2]);
    state = rollDice(state);

    expect(state.players.p1.inJail).toBe(true);
    expect(state.players.p1.position).toBe(10);
    expect(state.lastRollWasDoubles).toBe(false); // turn ends, doesn't chain into another roll
    expect(state.doublesCount).toBe(0);
  });

  it('escapes jail by rolling doubles, then moves normally from the jail tile', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, inJail: true, position: 10 } },
    };
    state = devSetForcedRoll(state, [3, 3]); // doubles, 6 steps from tile 10
    state = rollDice(state);

    expect(state.players.p1.inJail).toBe(false);
    expect(state.players.p1.position).toBe(16);
    // Escaping doesn't chain into another roll - it's a one-time exit, not the usual doubles bonus.
    expect(state.lastRollWasDoubles).toBe(false);
  });

  it('stays in jail after a non-doubles roll with no 1s', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, inJail: true, position: 10 } },
    };
    state = devSetForcedRoll(state, [2, 4]);
    state = rollDice(state);

    expect(state.players.p1.inJail).toBe(true);
    expect(state.players.p1.position).toBe(10);
  });

  it('disappears (placeholder reset) when rolling a 1 in jail', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          inJail: true,
          position: 10,
          roubles: 500,
          ownedTileIds: [6],
        },
      },
    };
    state = devSetForcedRoll(state, [1, 5]);
    state = rollDice(state);

    expect(state.players.p1.inJail).toBe(false);
    expect(state.players.p1.position).toBe(0);
    expect(state.players.p1.roubles).toBe(1000);
    expect(state.players.p1.ownedTileIds).toEqual([]);
  });

  it('charges the jail bribe at end of turn if still in jail', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, inJail: true, position: 10 } },
    };
    state = devSetForcedRoll(state, [2, 4]); // fails to escape
    state = rollDice(state);
    state = endTurn(state);

    expect(state.players.p1.roubles).toBe(1000 - 100);
    expect(state.currentTurnIndex).toBe(1); // turn actually passed
  });

  it("disappears (placeholder reset) if the bribe can't be afforded at end of turn", () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, inJail: true, position: 10, roubles: 50 },
      },
    };
    state = devSetForcedRoll(state, [2, 4]); // fails to escape
    state = rollDice(state);
    state = endTurn(state);

    expect(state.players.p1.inJail).toBe(false);
    expect(state.players.p1.roubles).toBe(1000); // reset by the placeholder
    expect(state.currentTurnIndex).toBe(1);
  });
});

describe('The Kremlin', () => {
  it('collects 200 roubles on the first visit', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 30);
    state = devSetForcedRoll(state, [3, 4]); // 30 + 7 -> tile 37, The Kremlin
    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(1200);
    expect(state.players.p1.kremlinVisits).toBe(1);
  });

  it('sends the player to jail on the second visit', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, kremlinVisits: 1 } },
    };
    state = withPosition(state, 'p1', 30);
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);

    expect(state.players.p1.inJail).toBe(true);
    expect(state.players.p1.position).toBe(10);
  });
});

describe('NKVD HQ', () => {
  it('sets turnsToSkip on the first visit', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 30);
    state = devSetForcedRoll(state, [4, 5]); // 30 + 9 -> tile 39, NKVD HQ
    state = rollDice(state);

    expect(state.players.p1.turnsToSkip).toBe(1);
    expect(state.players.p1.nkvdVisits).toBe(1);
  });

  it('jails on the second visit', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, nkvdVisits: 1 } },
    };
    state = withPosition(state, 'p1', 30);
    state = devSetForcedRoll(state, [4, 5]);
    state = rollDice(state);

    expect(state.players.p1.inJail).toBe(true);
  });

  it('disappears (placeholder) on the third visit', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, nkvdVisits: 2, roubles: 500, ownedTileIds: [6] },
      },
    };
    state = withPosition(state, 'p1', 30);
    state = devSetForcedRoll(state, [4, 5]);
    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(1000);
    expect(state.players.p1.ownedTileIds).toEqual([]);
  });
});

it("skips a flagged player's turn when ending the previous turn", () => {
  let state = createInitialGameState(PLAYERS);
  state = {
    ...state,
    players: { ...state.players, p2: { ...state.players.p2, turnsToSkip: 1 } },
  };
  state = endTurn(state); // p1 ends their turn; p2 should be skipped, landing back on p1

  expect(state.currentTurnIndex).toBe(0);
  expect(state.players.p2.turnsToSkip).toBe(0);
});

describe('Chernobyl Power', () => {
  it('is forced onto whoever lands on it while unowned, for free', () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetForcedRoll(state, [6, 6]); // 0 + 12 -> tile 12
    state = rollDice(state);

    expect(state.players.p1.ownedTileIds).toEqual([12]);
    expect(state.players.p1.roubles).toBe(1000); // free
  });

  it('gets forcibly handed to the next player who lands on it (hot potato)', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [12] } },
    };
    state = endTurn(state); // p2's turn
    state = devSetForcedRoll(state, [6, 6]); // p2: 0 + 12 -> tile 12
    state = rollDice(state);

    expect(state.players.p1.ownedTileIds).toEqual([]);
    expect(state.players.p2.ownedTileIds).toEqual([12]);
  });

  it("explodes after 3 of its owner's own turns without them holding The Volga, destroying their other properties", () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [12, 6] } },
    };
    // Turns alternate p1/p2, and only the owner's (p1's) own turns tick
    // the countdown - p2 ending their turn shouldn't move it at all.
    state = endTurn(state); // p1's turn ends -> tick, countdown 2
    state = endTurn(state); // p2's turn ends -> no tick
    state = endTurn(state); // p1's turn ends -> tick, countdown 1
    state = endTurn(state); // p2's turn ends -> no tick
    state = endTurn(state); // p1's turn ends -> tick, explodes

    expect(state.players.p1.ownedTileIds).toEqual([]);
    expect(state.destroyedTileIds).toEqual([6]);
    expect(state.chernobylCountdown).toBeNull();
  });

  it("resets the countdown when hot-potatoed to a new owner", () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [12] } },
    };
    state = endTurn(state); // p1's turn ends -> tick, countdown 2
    expect(state.chernobylCountdown).toBe(2);

    state = devSetForcedRoll(state, [6, 6]); // p2: 0 + 12 -> tile 12, hot potato
    state = rollDice(state);

    expect(state.players.p2.ownedTileIds).toEqual([12]);
    expect(state.chernobylCountdown).toBeNull(); // reset, not carried over at 2
  });

  it("doesn't tick down while the owner also holds The Volga", () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [12, 28] } },
    };
    state = endTurn(state);
    state = endTurn(state);
    state = endTurn(state);
    state = endTurn(state);

    expect(state.chernobylCountdown).toBeNull();
    expect(state.players.p1.ownedTileIds).toEqual([12, 28]); // never exploded
  });
});

describe('The Volga', () => {
  it('offers a give-everything-away decision when landing on it unowned with properties', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6] } },
    };
    state = withPosition(state, 'p1', 20);
    state = devSetForcedRoll(state, [3, 5]); // 20 + 8 -> tile 28, The Volga
    state = rollDice(state);

    expect(state.pendingDecision).toEqual({ type: 'volgaOffer', tileId: 28 });
  });

  it('claims the Volga for free when landing on it unowned with nothing to give', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 20);
    state = devSetForcedRoll(state, [3, 5]);
    state = rollDice(state);

    expect(state.players.p1.ownedTileIds).toEqual([28]);
    expect(state.pendingDecision).toBeNull();
  });

  it('accepting the offer distributes properties evenly and grants the Volga', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'boot' },
      { playerId: 'p2', pieceId: 'battleship' },
      { playerId: 'p3', pieceId: 'car' },
    ]);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [1, 3, 6] } },
    };
    state = withPosition(state, 'p1', 20);
    state = devSetForcedRoll(state, [3, 5]);
    state = rollDice(state);
    state = acceptVolgaOffer(state);

    expect(state.players.p1.ownedTileIds).toEqual([28]);
    expect(state.players.p2.ownedTileIds).toEqual([1, 6]);
    expect(state.players.p3.ownedTileIds).toEqual([3]);
  });

  it('declining the offer keeps properties and leaves the Volga unowned', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6] } },
    };
    state = withPosition(state, 'p1', 20);
    state = devSetForcedRoll(state, [3, 5]);
    state = rollDice(state);
    state = declineVolgaOffer(state);

    expect(state.pendingDecision).toBeNull();
    expect(state.players.p1.ownedTileIds).toEqual([6]);
  });

  it('forces the landing player to surrender everything to the Volga owner', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, ownedTileIds: [28] },
        p2: { ...state.players.p2, ownedTileIds: [1, 3] },
      },
    };
    state = endTurn(state); // p2's turn
    state = withPosition(state, 'p2', 20);
    state = devSetForcedRoll(state, [3, 5]);
    state = rollDice(state);

    expect(state.players.p2.ownedTileIds).toEqual([]);
    expect(state.players.p1.ownedTileIds).toEqual(expect.arrayContaining([1, 3, 28]));
  });

  it('never gives up Chernobyl Power - only tradeable properties move', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, ownedTileIds: [28] }, // p1 owns Volga
        p2: { ...state.players.p2, ownedTileIds: [1, 12] }, // p2 owns a property + Chernobyl
      },
    };
    state = endTurn(state); // p2's turn
    state = withPosition(state, 'p2', 20);
    state = devSetForcedRoll(state, [3, 5]);
    state = rollDice(state);

    // Chernobyl stays with p2; only the regular property gets surrendered.
    expect(state.players.p2.ownedTileIds).toEqual([12]);
    expect(state.players.p1.ownedTileIds).toEqual(expect.arrayContaining([1, 28]));
  });

  it('treats owning only Chernobyl Power as owning nothing, for stealing the Volga', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, ownedTileIds: [28] },
        p2: { ...state.players.p2, ownedTileIds: [12] }, // only Chernobyl - counts as nothing
      },
    };
    state = endTurn(state);
    state = withPosition(state, 'p2', 20);
    state = devSetForcedRoll(state, [3, 5]);
    state = rollDice(state);

    expect(state.players.p2.ownedTileIds).toEqual(expect.arrayContaining([12, 28]));
    expect(state.players.p1.ownedTileIds).toEqual([]);
  });

  it('steals the Volga if the landing player owns nothing', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [28] } },
    };
    state = endTurn(state); // p2's turn, p2 owns nothing
    state = withPosition(state, 'p2', 20);
    state = devSetForcedRoll(state, [3, 5]);
    state = rollDice(state);

    expect(state.players.p2.ownedTileIds).toEqual([28]);
    expect(state.players.p1.ownedTileIds).toEqual([]);
  });
});

describe('Communist Test / No Chance cards', () => {
  it('shuffles both full decks into the draw piles at game start', () => {
    const state = createInitialGameState(PLAYERS);
    expect(state.communistTestDrawPile).toHaveLength(COMMUNIST_TEST_CARDS.length);
    expect(state.noChanceDrawPile).toHaveLength(NO_CHANCE_CARDS.length);
    expect(state.communistTestDiscardPile).toEqual([]);
    expect(state.noChanceDiscardPile).toEqual([]);
  });

  it('draws the top card into the discard pile on a normal (non-forced) draw', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [1, 3]); // 0 + 4 -> tile 4, No Chance
    state = rollDice(state);

    expect(state.noChanceDrawPile).toHaveLength(NO_CHANCE_CARDS.length - 1);
    expect(state.noChanceDiscardPile).toHaveLength(1);
    // Whichever card actually got drawn, it's either awaiting
    // acknowledgement or (for a target-needing card) awaiting a target -
    // both are valid immediate outcomes of a real, non-forced draw.
    expect(['cardDrawn', 'cardTarget']).toContain(state.pendingDecision?.type);
  });

  it('a forced card draw bypasses the pile entirely', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'bankError');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);

    expect(state.pendingDecision).toEqual({ type: 'cardDrawn', cardId: 'bankError', forPlayerId: 'p1' });
    expect(state.forcedCardId).toBeNull();
    expect(state.communistTestDrawPile).toHaveLength(COMMUNIST_TEST_CARDS.length); // untouched
  });

  it('acknowledgeCard dismisses the drawn-card prompt so the turn can end', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'bankError');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);

    expect(endTurn(state)).toBe(state); // blocked while a card is pending

    state = acknowledgeCard(state);
    expect(state.pendingDecision).toBeNull();
  });

  it('a card with no automated effect just gets shown, with no other state change', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'politicalCorrectness');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);

    expect(state.pendingDecision).toEqual({
      type: 'cardDrawn',
      cardId: 'politicalCorrectness',
      forPlayerId: 'p1',
    });
    expect(state.players.p1.roubles).toBe(1000);
    expect(state.players.p1.ownedTileIds).toEqual([]);
  });

  it('"Bank Error in Your Favour" collects 1000 roubles', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'bankError');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(2000);
  });

  it('"Accident" disappears (placeholder) the drawing player', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, roubles: 700, ownedTileIds: [6] } },
    };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'accident');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(1000);
    expect(state.players.p1.ownedTileIds).toEqual([]);
  });

  it('"Anti-Revisionist" makes the player miss their next turn', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'antiRevisionist');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);

    expect(state.players.p1.turnsToSkip).toBe(1);
  });

  it('"Party Vanguard" grants two extra turns before play passes on', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'partyVanguard');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);
    state = acknowledgeCard(state);

    expect(state.players.p1.extraTurns).toBe(2);

    state = endTurn(state);
    expect(state.currentTurnIndex).toBe(0); // still p1 - 1st extra turn
    expect(state.players.p1.extraTurns).toBe(1);

    state = endTurn(state);
    expect(state.currentTurnIndex).toBe(0); // still p1 - 2nd extra turn
    expect(state.players.p1.extraTurns).toBe(0);

    state = endTurn(state);
    expect(state.currentTurnIndex).toBe(1); // extra turns used up, passes to p2
  });

  it('"Counter-Revolutionary!" reverses only the drawing player\'s direction', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'counterRevolutionary');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);

    expect(state.players.p1.movingBackward).toBe(true);
    expect(state.players.p2.movingBackward).toBe(false);
  });

  it('"Cultural Revolution" reverses every player\'s direction', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'culturalRevolution');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);

    expect(state.players.p1.movingBackward).toBe(true);
    expect(state.players.p2.movingBackward).toBe(true);
  });

  it('a player moving backward wraps correctly and still pays the STOY pass fee', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, movingBackward: true } },
    };
    state = withPosition(state, 'p1', 2);
    state = devSetForcedRoll(state, [2, 3]); // 2 - 5 -> wraps backward past STOY to 37
    state = rollDice(state);

    expect(state.players.p1.position).toBe(37);
    expect(state.players.p1.roubles).toBe(1000 - 50 + 200); // STOY pass fee, then Kremlin's first-visit bonus
  });

  it('"Blacklist" blocks buying and rent collection until passing STOY again', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'blacklist');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);
    state = acknowledgeCard(state);
    expect(state.players.p1.blacklisted).toBe(true);

    // Can't buy while blacklisted (still p1's turn - rollDice always acts
    // on whoever currentPlayerId currently is, and we haven't ended the
    // turn, so this is legitimately still p1 rolling again).
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [2, 4]); // -> tile 6, Moscow Metro, unowned
    state = rollDice(state);
    expect(state.pendingDecision).toBeNull();
    expect(state.players.p1.ownedTileIds).toEqual([]);

    // Passing STOY clears the blacklist.
    state = withPosition(state, 'p1', 38);
    state = devSetForcedRoll(state, [1, 2]); // 38 + 3 -> wraps to tile 1
    state = rollDice(state);
    expect(state.players.p1.blacklisted).toBe(false);
  });

  it("Blacklist seizes rent for the State instead of paying the blacklisted owner", () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, ownedTileIds: [6], blacklisted: true },
      },
    };
    state = endTurn(state); // p2's turn
    state = devSetForcedRoll(state, [2, 4]); // p2: 0 + 6 -> tile 6, owned by blacklisted p1
    state = rollDice(state);

    expect(state.players.p2.roubles).toBe(1000 - 20); // still pays
    expect(state.players.p1.roubles).toBe(1000); // but blacklisted owner never receives it
  });

  it('"Nomenklatura" force-advances to The Kremlin and waives the STOY pass fee', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 30);
    state = devSetForcedCard(state, 'nomenklatura');
    state = devSetForcedRoll(state, [3, 5]); // 30 + 8 -> tile 38, Communist Test
    state = rollDice(state);

    expect(state.players.p1.position).toBe(37); // The Kremlin
    // No STOY pass fee despite wrapping through it, plus the Kremlin's
    // own first-visit bonus for landing there.
    expect(state.players.p1.roubles).toBe(1000 + 200);
    expect(state.players.p1.kremlinVisits).toBe(1);
  });
});

describe('newly automated cards', () => {
  it('"Go Into Hiding!" hides the drawer and Disappears anyone who lands on them', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'goIntoHiding');
    state = devSetForcedRoll(state, [1, 3]); // -> tile 4
    state = rollDice(state);

    expect(state.players.p1.turnsToSkip).toBe(3);
    expect(state.players.p1.hidingPosition).toBe(4);

    state = acknowledgeCard(state);
    state = endTurn(state); // p1 -> p2

    state = devSetForcedCard(state, 'bankError'); // p2's own draw, kept deterministic
    state = devSetForcedRoll(state, [1, 3]); // p2: 0 + 4 -> lands on p1's hiding spot too
    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(1000); // Disappeared (reset)
    expect(state.players.p1.hidingPosition).toBeNull();
  });

  it('"Go Into Hiding!" ends the turn outright, even if the landing roll was doubles', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0); // 0 + 4 -> tile 4, a doubles roll
    state = devSetForcedCard(state, 'goIntoHiding');
    state = devSetForcedRoll(state, [2, 2]);
    state = rollDice(state);

    expect(state.lastRollWasDoubles).toBe(false);
  });

  describe('"NKVD" (the card)', () => {
    it('opens a quiz decision with a specific question, instead of resolving immediately', () => {
      let state = createInitialGameState(PLAYERS);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'nkvd');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state, () => 0); // picks question index 0

      expect(state.pendingDecision).toEqual({ type: 'nkvdQuiz', questionIndex: 0, forPlayerId: 'p1' });
      expect(state.players.p1.inJail).toBe(false);
    });

    it('answering correctly (loosely normalized) just moves on', () => {
      let state = createInitialGameState(PLAYERS);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'nkvd');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state, () => 0); // question 0: "...True Grit?" -> "John Wayne"

      state = answerNkvdQuiz(state, "  john wayne.  "); // trimmed/lowercased/punctuation-stripped

      expect(state.players.p1.inJail).toBe(false);
      expect(state.pendingDecision).toBeNull();
    });

    it('answering incorrectly sends the player to jail', () => {
      let state = createInitialGameState(PLAYERS);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'nkvd');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state, () => 0);

      state = answerNkvdQuiz(state, 'Clint Eastwood');

      expect(state.players.p1.inJail).toBe(true);
      expect(state.pendingDecision).toBeNull();
    });
  });

  it('"Collectivization Drive!" redistributes money evenly and conserves total tradeable property', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, roubles: 1200, ownedTileIds: [1, 3] },
        p2: { ...state.players.p2, roubles: 800, ownedTileIds: [6] },
      },
    };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'collectivizationDrive');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(1000);
    expect(state.players.p2.roubles).toBe(1000);
    const totalTiles = state.players.p1.ownedTileIds.length + state.players.p2.ownedTileIds.length;
    expect(totalTiles).toBe(3);
  });

  it("\"The Great Purge\" halves everyone's tradeable properties and Disappears one random player", () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, ownedTileIds: [1, 3, 6, 8] },
        p2: { ...state.players.p2, ownedTileIds: [9, 11] },
      },
    };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'greatPurge');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state, () => 0); // loser = turnOrder[0] = p1

    expect(state.players.p1.roubles).toBe(1000); // Disappeared (reset)
    expect(state.players.p1.ownedTileIds).toEqual([]);
    expect(state.players.p2.ownedTileIds).toHaveLength(1); // kept half of 2, rounded up to lose 1
  });

  describe('"Bestseller!"', () => {
    it('rolling a 6 keeps the 500 roubles with no further consequence', () => {
      let state = createInitialGameState(PLAYERS);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'bestseller');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state, () => 0.99); // -> 6

      expect(state.players.p1.roubles).toBe(1500);
      expect(state.players.p1.inJail).toBe(false);
    });

    it('rolling a 1 Disappears the player after collecting the 500', () => {
      let state = createInitialGameState(PLAYERS);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'bestseller');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state, () => 0); // -> 1

      expect(state.players.p1.roubles).toBe(1000); // reset by Disappear
    });

    it('rolling in between surrenders all tradeable property', () => {
      let state = createInitialGameState(PLAYERS);
      state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6] } } };
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'bestseller');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state, () => 0.4); // -> 3

      expect(state.players.p1.roubles).toBe(1500); // kept the 500
      expect(state.players.p1.ownedTileIds).toEqual([]);
      expect(state.players.p1.inJail).toBe(false);
    });

    it('jails instead if there was no property to surrender', () => {
      let state = createInitialGameState(PLAYERS);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'bestseller');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state, () => 0.4); // -> 3, no property owned

      expect(state.players.p1.roubles).toBe(1500);
      expect(state.players.p1.inJail).toBe(true);
    });
  });

  it('"Telegraph Union" makes the drawer Commissar, closing stations they land on and tolling everyone else', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'telegraphUnion');
    state = devSetForcedRoll(state, [1, 3]); // -> tile 4
    state = rollDice(state);
    expect(state.commissarPlayerId).toBe('p1');

    // Commissar closes Komsomolskaya Station (tile 5) by landing on it.
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [2, 3]); // -> tile 5, railroad
    state = rollDice(state);
    expect(state.closedTileIds).toEqual([5]);

    state = acknowledgeCard(state); // clears the leftover telegraphUnion cardDrawn prompt
    state = endTurn(state); // p1 -> p2

    // p2 lands there and pays the toll.
    state = devSetForcedRoll(state, [2, 3]); // p2: 0 + 5 -> tile 5
    state = rollDice(state);

    expect(state.players.p2.roubles).toBe(1000 - 20);
    expect(state.players.p1.roubles).toBe(1000 + 10); // Commissar's half of the toll
  });

  it('"Fourth International" secretly assigns Trotsky, but publishes the hiding spot in the log', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'fourthInternational');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state, () => 0);

    expect(state.players.p1.isTrotsky).toBe(true);
    expect(state.players.p2.isTrotsky).toBe(false);
    expect(state.trotskyHidingSpot).toBe(1);

    // The location is meant to be public per the rules; only who is
    // Trotsky stays secret - no player name/id should appear in the log.
    const locationLog = state.log.find((entry) => entry.includes('marked location is'));
    expect(locationLog).toContain(getTile(1).name);
    expect(state.log.some((entry) => entry.includes('p1') || entry.includes('p2'))).toBe(false);
  });

  it('"Siege of Stalingrad" seizes a target opponent property, locking it permanently', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, players: { ...state.players, p2: { ...state.players.p2, ownedTileIds: [6] } } };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'siegeOfStalingrad');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state);
    expect(state.pendingDecision).toEqual({ type: 'cardTarget', cardId: 'siegeOfStalingrad', forPlayerId: 'p1' });

    state = resolveCardTarget(state, { targetTileId: 6 });

    expect(state.players.p1.ownedTileIds).toEqual([6]);
    expect(state.players.p2.ownedTileIds).toEqual([]);
    expect(state.lockedTileIds).toEqual([6]);
    expect(state.pendingDecision).toEqual({ type: 'cardDrawn', cardId: 'siegeOfStalingrad', forPlayerId: 'p1' });
  });

  it('a locked (seized) property is exempt from being surrendered to The Volga', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      lockedTileIds: [6],
      players: {
        ...state.players,
        p1: { ...state.players.p1, ownedTileIds: [28] }, // Volga
        p2: { ...state.players.p2, ownedTileIds: [6, 1] }, // 6 locked, 1 tradeable
      },
    };
    state = endTurn(state); // p2's turn
    state = withPosition(state, 'p2', 20);
    state = devSetForcedRoll(state, [3, 5]); // -> tile 28, Volga
    state = rollDice(state);

    expect(state.players.p2.ownedTileIds).toEqual([6]); // kept the locked one
    expect(state.players.p1.ownedTileIds).toEqual(expect.arrayContaining([1, 28]));
  });

  it('"Double Agent" swaps Pieces between the drawer and the chosen target', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'doubleAgent');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state);
    expect(state.pendingDecision).toEqual({ type: 'cardTarget', cardId: 'doubleAgent', forPlayerId: 'p1' });

    state = resolveCardTarget(state, { targetPlayerId: 'p2' });

    expect(state.players.p1.pieceId).toBe('battleship');
    expect(state.players.p2.pieceId).toBe('boot');
  });

  it('"Phone Call from Stalin" Disappears the player on a roll of 1', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, roubles: 700, ownedTileIds: [6] } },
    };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'phoneCallFromStalin');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state, () => 0); // internal die roll -> 1

    expect(state.players.p1.roubles).toBe(1000);
    expect(state.players.p1.ownedTileIds).toEqual([]);
    expect(state.pendingDecision).toEqual({ type: 'cardDrawn', cardId: 'phoneCallFromStalin', forPlayerId: 'p1' });
  });

  it('"Phone Call from Stalin" otherwise offers a free property that traps the piece if revisited', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'phoneCallFromStalin');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state, () => 0.99); // internal die roll -> 6, not 1

    expect(state.pendingDecision).toEqual({ type: 'cardTarget', cardId: 'phoneCallFromStalin', forPlayerId: 'p1' });

    state = resolveCardTarget(state, { targetTileId: 9 }); // unowned property
    expect(state.players.p1.ownedTileIds).toEqual([9]);
    expect(state.phoneCallTraps).toEqual([{ playerId: 'p1', tileId: 9 }]);

    state = acknowledgeCard(state);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 6]); // 0 + 9 -> tile 9, landing back on the trap
    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(1000);
    expect(state.players.p1.ownedTileIds).toEqual([]);
    expect(state.phoneCallTraps).toEqual([]);
  });
});

describe('held cards (hand)', () => {
  it('Denounce Your Collaborators is held, then swaps places out of jail when used', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'denounceCollaborators');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state);
    expect(state.players.p1.heldCardIds).toContain('denounceCollaborators');

    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, inJail: true, position: 10 },
        p2: { ...state.players.p2, position: 20 },
      },
    };
    state = useDenounceCollaborators(state, 'p1', 'p2');

    expect(state.players.p1.inJail).toBe(false);
    expect(state.players.p1.position).toBe(20);
    expect(state.players.p2.inJail).toBe(true);
    expect(state.players.p2.position).toBe(10);
    expect(state.players.p1.heldCardIds).not.toContain('denounceCollaborators');
  });

  it("does nothing if the holder isn't actually in jail", () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, heldCardIds: ['denounceCollaborators'] } },
    };
    expect(useDenounceCollaborators(state, 'p1', 'p2')).toBe(state);
  });

  it('Secret Informant jails a player sharing your square and returns to the bottom of the deck', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'secretInformant');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state);
    expect(state.players.p1.heldCardIds).toContain('secretInformant');

    state = withPosition(state, 'p1', 15);
    state = withPosition(state, 'p2', 15);
    state = useSecretInformant(state, 'p1', 'p2');

    expect(state.players.p2.inJail).toBe(true);
    expect(state.players.p1.heldCardIds).not.toContain('secretInformant');
    expect(state.communistTestDrawPile[state.communistTestDrawPile.length - 1]).toBe('secretInformant');
  });

  describe('Show Trial', () => {
    it('is usable even when the caller is the one in jail (can be your own trial)', () => {
      let state = createInitialGameState(PLAYERS);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'showTrial');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state);
      state = { ...state, players: { ...state.players, p1: { ...state.players.p1, inJail: true } } };

      state = callShowTrial(state, 'p1', 'p1');

      expect(state.activeVote).toEqual({ callerId: 'p1', targetPlayerId: 'p1', votes: {} });
    });

    it("consumes the card from the caller's hand immediately when called", () => {
      let state = createInitialGameState(PLAYERS);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'showTrial');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state);
      state = { ...state, players: { ...state.players, p2: { ...state.players.p2, inJail: true } } };

      state = callShowTrial(state, 'p1', 'p2');

      expect(state.players.p1.heldCardIds).not.toContain('showTrial');
    });

    it("the caller's vote counts double, deciding the outcome once everyone has voted", () => {
      let state = createInitialGameState(PLAYERS);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'showTrial');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state);
      state = { ...state, players: { ...state.players, p2: { ...state.players.p2, inJail: true } } };
      state = callShowTrial(state, 'p1', 'p2');

      state = castShowTrialVote(state, 'p2', 'release'); // weight 1
      state = castShowTrialVote(state, 'p1', 'disappear'); // caller, weight 2 - decides it

      expect(state.activeVote).toBeNull();
      expect(state.players.p2.roubles).toBe(1000); // Disappeared (reset)
    });

    it('a tied vote falls back to a coin flip', () => {
      let state = createInitialGameState([
        { playerId: 'p1', pieceId: 'boot' },
        { playerId: 'p2', pieceId: 'battleship' },
        { playerId: 'p3', pieceId: 'car' },
      ]);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'showTrial');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state);
      state = { ...state, players: { ...state.players, p3: { ...state.players.p3, inJail: true } } };
      state = callShowTrial(state, 'p1', 'p3'); // p1 is caller (weight 2)

      // p1 votes release (weight 2); p2 + target p3 both vote disappear (weight 1 each = 2) -> tie
      state = castShowTrialVote(state, 'p2', 'disappear');
      state = castShowTrialVote(state, 'p3', 'disappear');
      state = castShowTrialVote(state, 'p1', 'release', () => 0.9); // coin flip forced to "disappear"

      expect(state.players.p3.roubles).toBe(1000); // disappear won the coin flip
    });
  });
});

describe('Fourth International accusation (house rule)', () => {
  it('exposes and Disappears the accused when the accusation is correct', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'fourthInternational');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state, () => 0); // p1 is Trotsky, hiding spot = tile 1
    state = acknowledgeCard(state);

    state = withPosition(state, 'p2', 1);
    state = { ...state, currentTurnIndex: 1 }; // p2's turn
    state = accuseOfTrotsky(state, 'p1');

    expect(state.players.p1.roubles).toBe(1000); // Disappeared (reset)
    expect(state.trotskyHidingSpot).toBeNull();
  });

  it('sends the accuser to jail when the accusation is wrong', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'boot' },
      { playerId: 'p2', pieceId: 'battleship' },
      { playerId: 'p3', pieceId: 'car' },
    ]);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'fourthInternational');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state, () => 0); // p1 is Trotsky (turnOrder[0]), hiding spot = tile 1
    state = acknowledgeCard(state);

    state = withPosition(state, 'p2', 1);
    state = { ...state, currentTurnIndex: 1 }; // p2's turn
    state = accuseOfTrotsky(state, 'p3'); // wrong - p1 is actually Trotsky

    expect(state.players.p2.inJail).toBe(true);
    expect(state.trotskyHidingSpot).toBeNull();
  });

  it("refuses to let a player accuse themselves", () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'fourthInternational');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state, () => 0);
    state = acknowledgeCard(state);

    state = withPosition(state, 'p2', 1);
    state = { ...state, currentTurnIndex: 1 };
    const before = state;
    state = accuseOfTrotsky(state, 'p2');

    expect(state).toBe(before);
  });
});

describe('dev helpers', () => {
  it('devJumpToTile moves the current player and resolves landing on it', () => {
    let state = createInitialGameState(PLAYERS);
    state = devJumpToTile(state, 6); // Moscow Metro, unowned property

    expect(state.players.p1.position).toBe(6);
    expect(state.pendingDecision).toEqual({ type: 'purchase', tileId: 6 });
  });

  it("devJumpToTile waives the STOY pass fee even when the jump wraps through it", () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 38);
    state = devJumpToTile(state, 5); // wraps through STOY on the way

    expect(state.players.p1.roubles).toBe(1000); // no pass fee charged
  });

  it('devDrawCard draws for the current player regardless of where they are standing', () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetForcedCard(state, 'bankError');
    state = devDrawCard(state, 'communistTest');

    expect(state.players.p1.roubles).toBe(2000);
    expect(state.pendingDecision).toEqual({ type: 'cardDrawn', cardId: 'bankError', forPlayerId: 'p1' });
    // Forced draws never touch the pile.
    expect(state.communistTestDrawPile).toHaveLength(COMMUNIST_TEST_CARDS.length);
  });
});

describe('Piece Special Powers', () => {
  // Boot's "utilities half price" is a documented no-op (utilities
  // aren't purchasable in this variant - see data/pieces.ts) and has no
  // code to test.

  it('Battleship buys railroads at half price', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'battleship' },
      { playerId: 'p2', pieceId: 'boot' },
    ]);
    state = devSetForcedRoll(state, [2, 3]); // 0 + 5 -> tile 5, Komsomolskaya Station, price 200
    state = rollDice(state);
    state = buyProperty(state);

    expect(state.players.p1.roubles).toBe(1000 - 100); // half of 200
    expect(state.players.p1.ownedTileIds).toEqual([5]);
  });

  it('Battleship still pays full price for ordinary properties', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'battleship' },
      { playerId: 'p2', pieceId: 'boot' },
    ]);
    state = devSetForcedRoll(state, [3, 3]); // 0 + 6 -> Moscow Metro, price 100
    state = rollDice(state);
    state = buyProperty(state);

    expect(state.players.p1.roubles).toBe(1000 - 100);
  });

  it('Iron never pays the STOY pass fee', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'iron' },
      { playerId: 'p2', pieceId: 'boot' },
    ]);
    state = withPosition(state, 'p1', 38);
    state = devSetForcedRoll(state, [1, 2]); // wraps past STOY to tile 1
    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(1000); // no fee
  });

  it('Iron still collects the STOY landing bonus normally', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'iron' },
      { playerId: 'p2', pieceId: 'boot' },
    ]);
    state = withPosition(state, 'p1', 38);
    state = devSetForcedRoll(state, [1, 1]); // lands exactly on STOY
    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(1000 + 200);
  });

  it('Thimble rolls only one die - moves by that single value, and it never counts as doubles', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'thimble' },
      { playerId: 'p2', pieceId: 'boot' },
    ]);
    // Start at 10 (Jail, just a safe starting point) so landing on 14
    // isn't a card tile - avoids an unrelated random card effect
    // (e.g. Nomenklatura) making this test flaky.
    state = withPosition(state, 'p1', 10);
    state = rollDice(state, () => 0.5); // rollOneDie(0.5) -> floor(3) + 1 = 4

    expect(state.players.p1.position).toBe(14);
    expect(state.lastRoll).toEqual([4, 0]);
    expect(state.lastRollWasDoubles).toBe(false);
  });

  it("Thimble can't roll doubles, so 3-doubles-to-jail never triggers no matter how many turns pass", () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'thimble' },
      { playerId: 'p2', pieceId: 'boot' },
    ]);
    // 11 -> 15 -> 19 -> 23, chosen so none of the three landings hit a
    // card tile (which would introduce an unrelated random effect).
    state = withPosition(state, 'p1', 11);
    state = rollDice(state, () => 0.5);
    state = rollDice(state, () => 0.5);
    state = rollDice(state, () => 0.5);

    expect(state.players.p1.inJail).toBe(false);
  });

  it('Car opens a card-choice decision on Communist Test', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'car' },
      { playerId: 'p2', pieceId: 'boot' },
    ]);
    state = withPosition(state, 'p1', 35);
    state = devSetForcedRoll(state, [3, 4]); // 35 + 7 -> tile 2, Communist Test
    state = rollDice(state);

    expect(state.pendingDecision).toEqual({ type: 'cardChoice', deck: 'communistTest' });
  });

  it('Car draws normally (no choice) on No Chance tiles', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'car' },
      { playerId: 'p2', pieceId: 'boot' },
    ]);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [1, 3]); // 0 + 4 -> tile 4, No Chance
    state = rollDice(state);

    expect(state.pendingDecision?.type).not.toBe('cardChoice');
  });

  it('chooseCard lets Car take a specific card out of the pile and resolves it', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'car' },
      { playerId: 'p2', pieceId: 'boot' },
    ]);
    state = withPosition(state, 'p1', 35);
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);
    expect(state.pendingDecision).toEqual({ type: 'cardChoice', deck: 'communistTest' });

    state = chooseCard(state, 'bankError');

    // 35 + 7 wraps through STOY (a 50 rouble fee), then Bank Error gives 1000.
    expect(state.players.p1.roubles).toBe(1000 - 50 + 1000);
    expect(state.communistTestDrawPile).not.toContain('bankError');
    expect(state.communistTestDiscardPile).toContain('bankError');
    expect(state.pendingDecision).toEqual({ type: 'cardDrawn', cardId: 'bankError', forPlayerId: 'p1' });
  });

  it("chooseCard does nothing if the chosen card isn't actually in the pile", () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'car' },
      { playerId: 'p2', pieceId: 'boot' },
    ]);
    state = withPosition(state, 'p1', 35);
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);

    const before = state;
    state = chooseCard(state, 'not-a-real-card-id');
    expect(state).toBe(before);
  });

  it('Dog opens a card-choice decision on No Chance', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'dog' },
      { playerId: 'p2', pieceId: 'boot' },
    ]);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [1, 3]); // 0 + 4 -> tile 4, No Chance
    state = rollDice(state);

    expect(state.pendingDecision).toEqual({ type: 'cardChoice', deck: 'noChance' });
  });

  it("the forced-card dev override bypasses Car/Dog's choice entirely", () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'car' },
      { playerId: 'p2', pieceId: 'boot' },
    ]);
    state = withPosition(state, 'p1', 35);
    state = devSetForcedCard(state, 'bankError');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);

    expect(state.pendingDecision).toEqual({ type: 'cardDrawn', cardId: 'bankError', forPlayerId: 'p1' });
  });
});

describe("Wheel Barrel's power (auto-seize purple properties)", () => {
  const players = [
    { playerId: 'p1', pieceId: 'wheelBarrel' as const },
    { playerId: 'p2', pieceId: 'boot' as const },
  ];

  it('takes an unowned purple property for free, with no purchase prompt', () => {
    let state = createInitialGameState(players);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [1, 0]); // -> tile 1, purple, unowned

    state = rollDice(state);

    expect(state.players.p1.ownedTileIds).toEqual([1]);
    expect(state.players.p1.roubles).toBe(1000);
    expect(state.pendingDecision).toBeNull();
  });

  it("seizes an opponent's purple property for free, no rent paid", () => {
    let state = createInitialGameState(players);
    state = { ...state, players: { ...state.players, p2: { ...state.players.p2, ownedTileIds: [1] } } };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [1, 0]); // -> tile 1

    state = rollDice(state);

    expect(state.players.p1.ownedTileIds).toEqual([1]);
    expect(state.players.p2.ownedTileIds).toEqual([]);
    expect(state.players.p1.roubles).toBe(1000); // no rent paid
    expect(state.players.p2.roubles).toBe(1000); // no rent received either
  });

  it('does not auto-take a non-purple property - normal purchase prompt applies', () => {
    let state = createInitialGameState(players);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 3]); // -> tile 6, Moscow Metro (lightBlue)

    state = rollDice(state);

    expect(state.players.p1.ownedTileIds).toEqual([]);
    expect(state.pendingDecision).toEqual({ type: 'purchase', tileId: 6 });
  });

  it('a locked purple property is exempt - falls through to normal rent instead', () => {
    let state = createInitialGameState(players);
    state = {
      ...state,
      lockedTileIds: [1],
      players: { ...state.players, p2: { ...state.players.p2, ownedTileIds: [1] } },
    };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [1, 0]); // -> tile 1

    state = rollDice(state);

    expect(state.players.p2.ownedTileIds).toEqual([1]); // not seized
    expect(state.players.p1.roubles).toBeLessThan(1000); // paid rent instead
  });
});

describe("T-Rex's power (can't buy, auto-seizes owned properties)", () => {
  const players = [
    { playerId: 'p1', pieceId: 'trex' as const },
    { playerId: 'p2', pieceId: 'boot' as const },
  ];

  it('never gets a purchase prompt for an unowned property', () => {
    let state = createInitialGameState(players);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 3]); // -> tile 6, unowned

    state = rollDice(state);

    expect(state.players.p1.ownedTileIds).toEqual([]);
    expect(state.pendingDecision).toBeNull();
    expect(state.log[state.log.length - 1]).toContain("T-Rex can't buy properties");
  });

  it("seizes an opponent's property automatically, paying no rent", () => {
    let state = createInitialGameState(players);
    state = { ...state, players: { ...state.players, p2: { ...state.players.p2, ownedTileIds: [6] } } };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 3]); // -> tile 6

    state = rollDice(state);

    expect(state.players.p1.ownedTileIds).toEqual([6]);
    expect(state.players.p2.ownedTileIds).toEqual([]);
    expect(state.players.p1.roubles).toBe(1000);
    expect(state.players.p2.roubles).toBe(1000);
  });

  it("seizes an opponent's railroad automatically too", () => {
    let state = createInitialGameState(players);
    state = { ...state, players: { ...state.players, p2: { ...state.players.p2, ownedTileIds: [5] } } };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [2, 3]); // -> tile 5, railroad

    state = rollDice(state);

    expect(state.players.p1.ownedTileIds).toEqual([5]);
    expect(state.players.p2.ownedTileIds).toEqual([]);
  });

  it('Chernobyl Power still follows its own normal forced-ownership rule, untouched by T-Rex', () => {
    let state = createInitialGameState(players);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [6, 6]); // -> tile 12, Chernobyl Power

    state = rollDice(state);

    expect(state.players.p1.ownedTileIds).toEqual([12]);
    expect(state.log[state.log.length - 1]).not.toContain('T-Rex');
  });

  it('a locked property is exempt - falls through to normal rent instead', () => {
    let state = createInitialGameState(players);
    state = {
      ...state,
      lockedTileIds: [6],
      players: { ...state.players, p2: { ...state.players.p2, ownedTileIds: [6] } },
    };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 3]); // -> tile 6

    state = rollDice(state);

    expect(state.players.p2.ownedTileIds).toEqual([6]); // not seized
    expect(state.players.p1.roubles).toBeLessThan(1000); // paid rent instead
  });
});

describe("Rubber duck's power (offer to jail whoever they land on)", () => {
  const players = [
    { playerId: 'p1', pieceId: 'rubberDuck' as const },
    { playerId: 'p2', pieceId: 'boot' as const },
  ];

  it('sets an encounter when their own move lands them on another player', () => {
    let state = createInitialGameState(players);
    state = withPosition(state, 'p2', 6);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 3]); // p1 -> tile 6, same as p2

    state = rollDice(state);

    expect(state.rubberDuckEncounter).toEqual({ rubberDuckPlayerId: 'p1', targetPlayerId: 'p2' });
  });

  it('does NOT trigger when another player lands on Rubber duck instead', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'boot' as const },
      { playerId: 'p2', pieceId: 'rubberDuck' as const },
    ]);
    state = withPosition(state, 'p2', 6);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 3]); // p1 (not Rubber duck) -> tile 6

    state = rollDice(state);

    expect(state.rubberDuckEncounter).toBeNull();
  });

  it('resolveRubberDuckEncounter(true) sends the target to jail', () => {
    let state = createInitialGameState(players);
    state = withPosition(state, 'p2', 6);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 3]);
    state = rollDice(state);

    state = resolveRubberDuckEncounter(state, true);

    expect(state.players.p2.inJail).toBe(true);
    expect(state.rubberDuckEncounter).toBeNull();
  });

  it('resolveRubberDuckEncounter(false) just dismisses it', () => {
    let state = createInitialGameState(players);
    state = withPosition(state, 'p2', 6);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 3]);
    state = rollDice(state);

    state = resolveRubberDuckEncounter(state, false);

    expect(state.players.p2.inJail).toBe(false);
    expect(state.rubberDuckEncounter).toBeNull();
  });

  it('lapses (implicitly "no") if Rubber duck ends their turn without acting on it', () => {
    let state = createInitialGameState(players);
    // Free Parking (tile 20) has no landing effect of its own, so nothing
    // else (like an unowned property's purchase prompt) blocks endTurn.
    state = withPosition(state, 'p2', 20);
    state = withPosition(state, 'p1', 15);
    state = devSetForcedRoll(state, [2, 3]); // non-doubles roll, 15 + 5 -> tile 20
    state = rollDice(state);
    expect(state.rubberDuckEncounter).not.toBeNull();

    state = endTurn(state);

    expect(state.rubberDuckEncounter).toBeNull();
    expect(state.players.p2.inJail).toBe(false);
  });
});

describe("Cat's power (keep or redirect a drawn card's effects)", () => {
  const players = [
    { playerId: 'p1', pieceId: 'cat' as const },
    { playerId: 'p2', pieceId: 'boot' as const },
  ];

  it('opens a catRedirect decision after reading the card, instead of applying it immediately', () => {
    let state = createInitialGameState(players);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'bankError');
    state = devSetForcedRoll(state, [3, 4]);

    state = rollDice(state);

    expect(state.pendingDecision).toEqual({ type: 'catRedirect', cardId: 'bankError' });
    expect(state.players.p1.roubles).toBe(1000); // not applied yet
  });

  it('keeping the card applies its full effect to Cat', () => {
    let state = createInitialGameState(players);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'bankError');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);

    state = resolveCatRedirect(state, null);

    expect(state.players.p1.roubles).toBe(2000);
    expect(state.pendingDecision).toEqual({ type: 'cardDrawn', cardId: 'bankError', forPlayerId: 'p1' });
  });

  it('giving it away applies the full effect to the chosen player instead', () => {
    let state = createInitialGameState(players);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'bankError');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);

    state = resolveCatRedirect(state, 'p2');

    expect(state.players.p1.roubles).toBe(1000); // Cat untouched
    expect(state.players.p2.roubles).toBe(2000); // p2 got the money instead
    expect(state.pendingDecision).toEqual({ type: 'cardDrawn', cardId: 'bankError', forPlayerId: 'p2' });
  });

  it('redirecting a target-needing card hands the follow-up decision to the new player too', () => {
    let state = createInitialGameState(players);
    state = { ...state, players: { ...state.players, p2: { ...state.players.p2, ownedTileIds: [6] } } };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'doubleAgent');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state);

    state = resolveCatRedirect(state, 'p2');
    expect(state.pendingDecision).toEqual({ type: 'cardTarget', cardId: 'doubleAgent', forPlayerId: 'p2' });

    // p2 (not Cat/p1) now resolves it, swapping Pieces with p1 (the only other player).
    state = resolveCardTarget(state, { targetPlayerId: 'p1' });
    expect(state.players.p2.pieceId).toBe('cat');
    expect(state.players.p1.pieceId).toBe('boot');
  });

  it('redirecting NKVD sends the wrong-answer penalty to the new player, not Cat', () => {
    let state = createInitialGameState(players);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'nkvd');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state, () => 0);

    state = resolveCatRedirect(state, 'p2', () => 0);
    expect(state.pendingDecision).toEqual({ type: 'nkvdQuiz', questionIndex: 0, forPlayerId: 'p2' });

    state = answerNkvdQuiz(state, 'wrong answer');

    expect(state.players.p2.inJail).toBe(true);
    expect(state.players.p1.inJail).toBe(false);
  });

  it('rejects an invalid target (self or a nonexistent player)', () => {
    let state = createInitialGameState(players);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'bankError');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);
    const before = state;

    expect(resolveCatRedirect(state, 'p1')).toBe(before); // can't redirect to self
    expect(resolveCatRedirect(state, 'not-a-real-player')).toBe(before);
  });
});
