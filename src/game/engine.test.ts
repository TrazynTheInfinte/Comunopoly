import { describe, expect, it } from 'vitest';
import {
  acceptVolgaOffer,
  buyProperty,
  createInitialGameState,
  declineVolgaOffer,
  devSetForcedRoll,
  endTurn,
  rollDice,
  skipPurchase,
} from './engine';
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
  it('sets skipNextTurn on the first visit', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 30);
    state = devSetForcedRoll(state, [4, 5]); // 30 + 9 -> tile 39, NKVD HQ
    state = rollDice(state);

    expect(state.players.p1.skipNextTurn).toBe(true);
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
    players: { ...state.players, p2: { ...state.players.p2, skipNextTurn: true } },
  };
  state = endTurn(state); // p1 ends their turn; p2 should be skipped, landing back on p1

  expect(state.currentTurnIndex).toBe(0);
  expect(state.players.p2.skipNextTurn).toBe(false);
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
