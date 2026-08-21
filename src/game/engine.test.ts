import { describe, expect, it } from 'vitest';
import {
  buyProperty,
  createInitialGameState,
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
