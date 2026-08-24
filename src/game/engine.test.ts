import { describe, expect, it } from 'vitest';
import {
  acceptTrade,
  acceptVolgaOffer,
  accuseOfTrotsky,
  acknowledgeCard,
  afkSkipTurn,
  answerNkvdQuiz,
  buildHouse,
  buyProperty,
  callShowTrial,
  castShowTrialVote,
  chooseCard,
  chooseEndgameTarget,
  chooseNewPiece,
  confirmLiquidationPayment,
  confirmStillHere,
  createInitialGameState,
  declareBankruptcy,
  declineTrade,
  declineVolgaOffer,
  devDrawCard,
  devForceAutoPickPiece,
  devForceDisappear,
  devForceEndgame,
  devForceSkipTurn,
  devJumpToTile,
  devKickPlayer,
  devSetForcedCard,
  devSetForcedRoll,
  devSetRoubles,
  drawFromPile,
  endTurn,
  getAvailablePieceIds,
  mortgageProperty,
  proposeTrade,
  rejoinFromAfk,
  resolveCardTarget,
  resolveCatRedirect,
  resolveRubberDuckEncounter,
  resolveSmuggleOffer,
  rollDice,
  sellHouse,
  skipPurchase,
  unmortgageProperty,
  useDenounceCollaborators,
  useSecretInformant,
  withdrawTrade,
} from './engine';
import { COMMUNIST_TEST_CARDS, NO_CHANCE_CARDS } from '../data/cards';
import { getTile } from '../data/board';
import { STARTING_PIECES } from '../data/pieces';
import type { EndgameState, GameState } from '../types/game';

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
    // Below 1000 so the STOY bonus doesn't also trip the separate
    // over-1000 jail rule - this test is just about the bonus itself.
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, roubles: 700 } } };
    state = devSetForcedRoll(state, [1, 1]); // 38 + 2 = 40 -> wraps to 0
    state = rollDice(state);
    expect(state.players.p1.position).toBe(0);
    expect(state.players.p1.roubles).toBe(700 + 200);
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

  it('turnCount only increments when the turn actually passes to someone else, not on a doubles continuation', () => {
    let state = createInitialGameState(PLAYERS);
    expect(state.turnCount).toBe(0);

    state = devSetForcedRoll(state, [4, 4]); // doubles - same player goes again
    state = rollDice(state);
    state = skipPurchase(state); // lands on an unowned property (tile 8) - clear the prompt first
    state = endTurn(state);
    expect(state.currentTurnIndex).toBe(0); // still p1's turn
    expect(state.turnCount).toBe(0); // no real turn change yet

    state = devSetForcedRoll(state, [2, 3]); // non-double - turn actually passes
    state = rollDice(state);
    state = skipPurchase(state); // lands on tile 13, also unowned - clear that prompt too
    state = endTurn(state);
    expect(state.currentTurnIndex).toBe(1); // now p2's turn
    expect(state.turnCount).toBe(1);
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
  it('charges base (no-house) rent for landing on a property someone else owns', () => {
    let state = createInitialGameState(PLAYERS);
    // p1 buys Moscow Metro (tile 6, price 100, base rent 6). Non-double
    // roll so the turn actually passes to p2 afterwards.
    state = devSetForcedRoll(state, [2, 4]);
    state = rollDice(state);
    state = buyProperty(state);
    state = endTurn(state); // now p2's turn

    // p2 lands on the same tile.
    state = devSetForcedRoll(state, [2, 4]);
    state = rollDice(state);

    const expectedRent = 6;
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

    expect(state.players.p2.roubles).toBe(1000 - 6); // still pays rent
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

  it('sends a player to jail after three doubles, cumulative not just consecutive', () => {
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
    expect(state.players.p1.doublesRolledCount).toBe(0);
  });

  it('sends a player to jail after three doubles that are not consecutive', () => {
    let state = createInitialGameState(PLAYERS);
    // Low roubles so an incidental rent/bonus along the way can't
    // accidentally trip the separate over-1000 jail rule and confuse
    // this test's own assertions.
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, roubles: 200 } },
    };

    state = devSetForcedRoll(state, [1, 1]);
    state = rollDice(state); // doubles #1 - position 0 -> 2
    expect(state.players.p1.doublesRolledCount).toBe(1);

    state = devSetForcedRoll(state, [1, 2]);
    state = rollDice(state); // non-doubles - position 2 -> 5, count untouched
    expect(state.players.p1.doublesRolledCount).toBe(1);
    expect(state.players.p1.inJail).toBe(false);

    state = devSetForcedRoll(state, [2, 2]);
    state = rollDice(state); // doubles #2 - position 5 -> 9
    expect(state.players.p1.doublesRolledCount).toBe(2);

    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state); // non-doubles again - position 9 -> 13, still no reset
    expect(state.players.p1.doublesRolledCount).toBe(2);
    expect(state.players.p1.inJail).toBe(false);

    state = devSetForcedRoll(state, [3, 3]);
    state = rollDice(state); // doubles #3 - jails instead of moving, even though none were back-to-back

    expect(state.players.p1.inJail).toBe(true);
    expect(state.players.p1.doublesRolledCount).toBe(0);
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

  it('sends a player to jail the moment a gain pushes them over 1000 roubles', () => {
    let state = createInitialGameState(PLAYERS);
    // p1 owns Moscow Metro (tile 6, base rent 6); park p1's own roubles
    // right at the edge so collecting rent tips them over.
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, ownedTileIds: [6], roubles: 995 },
      },
    };
    state = endTurn(state); // p2's turn

    state = devSetForcedRoll(state, [2, 4]); // p2 lands on tile 6, pays 6 rent
    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(1001);
    expect(state.players.p1.inJail).toBe(true);
  });

  it("doesn't jail for a gain that lands exactly on 1000", () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, ownedTileIds: [6], roubles: 994 },
      },
    };
    state = endTurn(state);

    state = devSetForcedRoll(state, [2, 4]);
    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(1000);
    expect(state.players.p1.inJail).toBe(false);
  });

  it("the Dev Panel's set-roubles tool also enforces the over-1000 rule", () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetRoubles(state, 'p1', 1500);

    expect(state.players.p1.roubles).toBe(1500);
    expect(state.players.p1.inJail).toBe(true);
  });

  it('rolling doubles to escape jail fails (stays jailed) while still over 1000 roubles', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, inJail: true, position: 10, roubles: 1500 },
      },
    };
    state = devSetForcedRoll(state, [3, 3]); // would normally escape
    state = rollDice(state);

    expect(state.players.p1.inJail).toBe(true);
    expect(state.players.p1.position).toBe(10);
  });

  it('escapes normally by rolling doubles once back at/under 1000 roubles', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, inJail: true, position: 10, roubles: 1000 },
      },
    };
    state = devSetForcedRoll(state, [3, 3]);
    state = rollDice(state);

    expect(state.players.p1.inJail).toBe(false);
    expect(state.players.p1.position).toBe(16);
  });

  it('Denounce Your Collaborators fails while the holder has over 1000 roubles', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: {
          ...state.players.p1,
          inJail: true,
          position: 10,
          roubles: 1500,
          heldCardIds: ['denounceCollaborators'],
        },
      },
    };
    state = useDenounceCollaborators(state, 'p1', 'p2');

    expect(state.players.p1.inJail).toBe(true);
    expect(state.players.p2.inJail).toBe(false);
    expect(state.players.p1.heldCardIds).toEqual(['denounceCollaborators']); // card not consumed
  });

  it('a Show Trial release sends the target straight back to jail if they have over 1000 roubles', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, heldCardIds: ['showTrial'] },
        p2: { ...state.players.p2, inJail: true, position: 10, roubles: 1500 },
      },
    };
    state = callShowTrial(state, 'p1', 'p2');
    state = castShowTrialVote(state, 'p1', 'release');
    state = castShowTrialVote(state, 'p2', 'release');

    expect(state.players.p2.inJail).toBe(true);
  });

  it('sends a player to jail the moment a payment drains them down to exactly 0 roubles', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, ownedTileIds: [6] },
        p2: { ...state.players.p2, roubles: 6 },
      },
    };
    state = endTurn(state); // p2's turn

    state = devSetForcedRoll(state, [2, 4]); // p2 lands on tile 6, pays the full 6 rent
    state = rollDice(state);

    expect(state.players.p2.roubles).toBe(0);
    expect(state.players.p2.inJail).toBe(true);
  });

  it("doesn't jail for a payment that leaves 1 rouble", () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, ownedTileIds: [6] },
        p2: { ...state.players.p2, roubles: 7 },
      },
    };
    state = endTurn(state);

    state = devSetForcedRoll(state, [2, 4]);
    state = rollDice(state);

    expect(state.players.p2.roubles).toBe(1);
    expect(state.players.p2.inJail).toBe(false);
  });

  it("the Dev Panel's set-roubles tool also enforces the 0-roubles rule", () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetRoubles(state, 'p1', 0);

    expect(state.players.p1.roubles).toBe(0);
    expect(state.players.p1.inJail).toBe(true);
  });

  it('rolling doubles to escape jail fails (stays jailed) while at 0 roubles', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, inJail: true, position: 10, roubles: 0 },
      },
    };
    state = devSetForcedRoll(state, [3, 3]); // would normally escape
    state = rollDice(state);

    expect(state.players.p1.inJail).toBe(true);
    expect(state.players.p1.position).toBe(10);
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
    state = drawFromPile(state);

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
    state = drawFromPile(state);

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
    state = drawFromPile(state);

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
    state = drawFromPile(state);

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
    state = drawFromPile(state);

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
    state = drawFromPile(state);

    expect(state.players.p1.roubles).toBe(1000);
    expect(state.players.p1.ownedTileIds).toEqual([]);
  });

  it('"Anti-Revisionist" makes the player miss their next turn', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'antiRevisionist');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);
    state = drawFromPile(state);

    expect(state.players.p1.turnsToSkip).toBe(1);
  });

  it('"Party Vanguard" grants two extra turns before play passes on', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'partyVanguard');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);
    state = drawFromPile(state);
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
    state = drawFromPile(state);

    expect(state.players.p1.movingBackward).toBe(true);
    expect(state.players.p2.movingBackward).toBe(false);
  });

  it('"Cultural Revolution" reverses every player\'s direction', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'culturalRevolution');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);
    state = drawFromPile(state);

    expect(state.players.p1.movingBackward).toBe(true);
    expect(state.players.p2.movingBackward).toBe(true);
  });

  it('a player moving backward wraps correctly and still pays the STOY pass fee', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      // Below 1000 so the Kremlin bonus below doesn't also trip the
      // separate over-1000 jail rule - this test is just about the wrap.
      players: { ...state.players, p1: { ...state.players.p1, movingBackward: true, roubles: 700 } },
    };
    state = withPosition(state, 'p1', 2);
    state = devSetForcedRoll(state, [2, 3]); // 2 - 5 -> wraps backward past STOY to 37
    state = rollDice(state);

    expect(state.players.p1.position).toBe(37);
    expect(state.players.p1.roubles).toBe(700 - 50 + 200); // STOY pass fee, then Kremlin's first-visit bonus
  });

  it('"Blacklist" blocks buying and rent collection until passing STOY again', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'blacklist');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);
    state = drawFromPile(state);
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

    expect(state.players.p2.roubles).toBe(1000 - 6); // still pays
    expect(state.players.p1.roubles).toBe(1000); // but blacklisted owner never receives it
  });

  it('"Nomenklatura" force-advances to The Kremlin and waives the STOY pass fee', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 30);
    // Below 1000 so the Kremlin bonus below doesn't also trip the
    // separate over-1000 jail rule - this test is just about the advance.
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, roubles: 700 } } };
    state = devSetForcedCard(state, 'nomenklatura');
    state = devSetForcedRoll(state, [3, 5]); // 30 + 8 -> tile 38, Communist Test
    state = rollDice(state);
    state = drawFromPile(state);

    expect(state.players.p1.position).toBe(37); // The Kremlin
    // No STOY pass fee despite wrapping through it, plus the Kremlin's
    // own first-visit bonus for landing there.
    expect(state.players.p1.roubles).toBe(700 + 200);
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
    state = drawFromPile(state);

    expect(state.players.p1.turnsToSkip).toBe(3);
    expect(state.players.p1.hidingPosition).toBe(4);

    state = acknowledgeCard(state);
    state = endTurn(state); // p1 -> p2

    state = devSetForcedCard(state, 'bankError'); // p2's own draw, kept deterministic
    state = devSetForcedRoll(state, [1, 3]); // p2: 0 + 4 -> lands on p1's hiding spot too
    state = rollDice(state);
    state = drawFromPile(state);

    expect(state.players.p1.roubles).toBe(1000); // Disappeared (reset)
    expect(state.players.p1.hidingPosition).toBeNull();
  });

  it('"Go Into Hiding!" ends the turn outright, even if the landing roll was doubles', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0); // 0 + 4 -> tile 4, a doubles roll
    state = devSetForcedCard(state, 'goIntoHiding');
    state = devSetForcedRoll(state, [2, 2]);
    state = rollDice(state);
    state = drawFromPile(state);

    expect(state.lastRollWasDoubles).toBe(false);
  });

  describe('"NKVD" (the card)', () => {
    it('opens a quiz decision with a specific question, instead of resolving immediately', () => {
      let state = createInitialGameState(PLAYERS);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'nkvd');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state);
      state = drawFromPile(state, () => 0); // picks question index 0

      expect(state.pendingDecision).toEqual({ type: 'nkvdQuiz', questionIndex: 0, forPlayerId: 'p1' });
      expect(state.players.p1.inJail).toBe(false);
    });

    it('answering correctly (loosely normalized) just moves on', () => {
      let state = createInitialGameState(PLAYERS);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'nkvd');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state);
      state = drawFromPile(state, () => 0); // question 0: "...True Grit?" -> "John Wayne"

      state = answerNkvdQuiz(state, "  john wayne.  "); // trimmed/lowercased/punctuation-stripped

      expect(state.players.p1.inJail).toBe(false);
      expect(state.pendingDecision).toBeNull();
    });

    it('answering incorrectly sends the player to jail', () => {
      let state = createInitialGameState(PLAYERS);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'nkvd');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state);
      state = drawFromPile(state, () => 0);

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
    state = drawFromPile(state);

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
    state = rollDice(state);
    state = drawFromPile(state, () => 0); // loser = turnOrder[0] = p1

    expect(state.players.p1.roubles).toBe(1000); // Disappeared (reset)
    expect(state.players.p1.ownedTileIds).toEqual([]);
    expect(state.players.p2.ownedTileIds).toHaveLength(1); // kept half of 2, rounded up to lose 1
  });

  describe('"Bestseller!"', () => {
    it('rolling a 6 keeps the 500 roubles, but that pushes them over 1000 - jailed by the house rule, not the card', () => {
      let state = createInitialGameState(PLAYERS);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'bestseller');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state);
      state = drawFromPile(state, () => 0.99); // -> 6

      expect(state.players.p1.roubles).toBe(1500);
      expect(state.players.p1.inJail).toBe(true);
    });

    it('rolling a 1 Disappears the player after collecting the 500', () => {
      let state = createInitialGameState(PLAYERS);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'bestseller');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state);
      state = drawFromPile(state, () => 0); // -> 1

      expect(state.players.p1.roubles).toBe(1000); // reset by Disappear
    });

    it('rolling in between surrenders all tradeable property', () => {
      let state = createInitialGameState(PLAYERS);
      state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6] } } };
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'bestseller');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state);
      state = drawFromPile(state, () => 0.4); // -> 3

      expect(state.players.p1.roubles).toBe(1500); // kept the 500
      expect(state.players.p1.ownedTileIds).toEqual([]);
      expect(state.players.p1.inJail).toBe(true); // over 1000 roubles - jailed by the house rule
    });

    it('jails instead if there was no property to surrender', () => {
      let state = createInitialGameState(PLAYERS);
      state = withPosition(state, 'p1', 0);
      state = devSetForcedCard(state, 'bestseller');
      state = devSetForcedRoll(state, [1, 3]);
      state = rollDice(state);
      state = drawFromPile(state, () => 0.4); // -> 3, no property owned

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
    state = drawFromPile(state);
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
    state = rollDice(state);
    state = drawFromPile(state, () => 0);

    expect(state.players.p1.isTrotsky).toBe(true);
    expect(state.players.p2.isTrotsky).toBe(false);
    expect(state.trotskyHidingSpot).toBe(1);

    // The location is meant to be public per the rules; only who is
    // Trotsky stays secret - no player name/id should appear in the log.
    const locationLog = state.log.find((entry) => entry.includes('marked location is'));
    expect(locationLog).toContain(getTile(1).name);
    expect(state.log.some((entry) => entry.includes('p1') || entry.includes('p2'))).toBe(false);
  });

  it('ends the Fourth International hunt if the secret Trotsky Disappears some other way before being accused', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'fourthInternational');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state);
    state = drawFromPile(state, () => 0); // p1 is Trotsky

    expect(state.players.p1.isTrotsky).toBe(true);
    expect(state.trotskyHidingSpot).not.toBeNull();

    state = devForceDisappear(state, 'p1');

    expect(state.players.p1.isTrotsky).toBe(false);
    // The hunt ends outright rather than leaving a hiding spot with no
    // real Trotsky left behind it - every player would otherwise show
    // as "Notsky" with no way to ever win the accusation.
    expect(state.trotskyHidingSpot).toBeNull();
  });

  it("leaves an unrelated player's Disappear alone during an active Fourth International hunt", () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'fourthInternational');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state);
    state = drawFromPile(state, () => 0); // p1 is Trotsky

    state = devForceDisappear(state, 'p2'); // not the secret Trotsky

    expect(state.players.p1.isTrotsky).toBe(true);
    expect(state.trotskyHidingSpot).not.toBeNull();
  });

  it('"Siege of Stalingrad" seizes a target opponent property, locking it permanently', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, players: { ...state.players, p2: { ...state.players.p2, ownedTileIds: [6] } } };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'siegeOfStalingrad');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state);
    state = drawFromPile(state);
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
    state = drawFromPile(state);
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
    state = rollDice(state);
    state = drawFromPile(state, () => 0); // internal die roll -> 1

    expect(state.players.p1.roubles).toBe(1000);
    expect(state.players.p1.ownedTileIds).toEqual([]);
    expect(state.pendingDecision).toEqual({ type: 'cardDrawn', cardId: 'phoneCallFromStalin', forPlayerId: 'p1' });
  });

  it('"Phone Call from Stalin" otherwise offers a free property that traps the piece if revisited', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'phoneCallFromStalin');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state);
    state = drawFromPile(state, () => 0.99); // internal die roll -> 6, not 1

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
    state = drawFromPile(state);
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
    state = drawFromPile(state);
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
      state = drawFromPile(state);
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
      state = drawFromPile(state);
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
      state = drawFromPile(state);
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
      state = drawFromPile(state);
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
    state = rollDice(state);
    state = drawFromPile(state, () => 0); // p1 is Trotsky, hiding spot = tile 1
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
    state = rollDice(state);
    state = drawFromPile(state, () => 0); // p1 is Trotsky (turnOrder[0]), hiding spot = tile 1
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
    state = rollDice(state);
    state = drawFromPile(state, () => 0);
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
    state = drawFromPile(state);

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
    state = drawFromPile(state);

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
    state = drawFromPile(state);
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
    state = drawFromPile(state);

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
    state = drawFromPile(state);

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
    state = drawFromPile(state);

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
    // Jail "just visiting" (tile 10) has no landing effect of its own, so
    // nothing else (like an unowned property's purchase prompt, or Free
    // Parking's smuggle offer) blocks endTurn.
    state = withPosition(state, 'p2', 10);
    state = withPosition(state, 'p1', 5);
    state = devSetForcedRoll(state, [2, 3]); // non-doubles roll, 5 + 5 -> tile 10
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
    state = drawFromPile(state);

    expect(state.pendingDecision).toEqual({ type: 'catRedirect', cardId: 'bankError' });
    expect(state.players.p1.roubles).toBe(1000); // not applied yet
  });

  it('keeping the card applies its full effect to Cat', () => {
    let state = createInitialGameState(players);
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'bankError');
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);
    state = drawFromPile(state);

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
    state = drawFromPile(state);

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
    state = drawFromPile(state);

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
    state = rollDice(state);
    state = drawFromPile(state, () => 0);

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
    state = drawFromPile(state);
    const before = state;

    expect(resolveCatRedirect(state, 'p1')).toBe(before); // can't redirect to self
    expect(resolveCatRedirect(state, 'not-a-real-player')).toBe(before);
  });
});

describe('houses and hotels', () => {
  // lightBlue group: tiles 6 (Moscow Metro), 8 (Vermont Avenue), 9
  // (Alexander Garden). House cost 50; rentTable [6, 30, 90, 270, 400, 550].
  function withFullLightBlueGroup(state: GameState, playerId: string): GameState {
    return {
      ...state,
      players: {
        ...state.players,
        [playerId]: { ...state.players[playerId], ownedTileIds: [6, 8, 9] },
      },
    };
  }

  it('refuses to build without owning the whole collection', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6, 8] } }, // missing 9
    };
    const before = state;

    state = buildHouse(state, 'p1', 6);

    expect(state).toBe(before);
  });

  it('builds a house: deducts cost, increments the count, draws from the bank supply', () => {
    let state = createInitialGameState(PLAYERS);
    state = withFullLightBlueGroup(state, 'p1');

    state = buildHouse(state, 'p1', 6);

    expect(state.players.p1.roubles).toBe(1000 - 50);
    expect(state.propertyHouses[6]).toBe(1);
    expect(state.housesRemaining).toBe(31);
  });

  it('the 5th build on a property becomes a hotel, returning its 4 houses to the bank', () => {
    let state = createInitialGameState(PLAYERS);
    state = withFullLightBlueGroup(state, 'p1');

    for (let i = 0; i < 4; i++) {
      state = buildHouse(state, 'p1', 6);
    }
    expect(state.propertyHouses[6]).toBe(4);
    expect(state.housesRemaining).toBe(28);

    state = buildHouse(state, 'p1', 6);

    expect(state.propertyHouses[6]).toBe(5);
    expect(state.hotelsRemaining).toBe(11);
    expect(state.housesRemaining).toBe(32); // the 4 houses came back
  });

  it('refuses to build past a hotel', () => {
    let state = createInitialGameState(PLAYERS);
    state = withFullLightBlueGroup(state, 'p1');
    state = { ...state, propertyHouses: { 6: 5 } };
    const atHotel = state;

    expect(buildHouse(state, 'p1', 6)).toBe(atHotel);
  });

  it("refuses to build without enough roubles", () => {
    let state = createInitialGameState(PLAYERS);
    state = withFullLightBlueGroup(state, 'p1');
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, roubles: 10 } } };
    const broke = state;

    expect(buildHouse(state, 'p1', 6)).toBe(broke);
  });

  it('an empty bank supply blocks building even with a full collection and enough cash', () => {
    let state = createInitialGameState(PLAYERS);
    state = withFullLightBlueGroup(state, 'p1');
    state = { ...state, housesRemaining: 0 };
    const before = state;

    state = buildHouse(state, 'p1', 6);

    expect(state.propertyHouses[6]).toBeUndefined();
    expect(state.players.p1.roubles).toBe(before.players.p1.roubles);
  });

  it('rent scales with the number of houses on the property', () => {
    let state = createInitialGameState(PLAYERS);
    state = withFullLightBlueGroup(state, 'p1');
    state = buildHouse(state, 'p1', 6);
    state = buildHouse(state, 'p1', 6); // 2 houses -> rentTable[2] = 90

    state = endTurn(state); // p2's turn
    state = withPosition(state, 'p2', 0);
    state = devSetForcedRoll(state, [3, 3]); // -> tile 6

    state = rollDice(state);

    expect(state.players.p2.roubles).toBe(1000 - 90);
    expect(state.players.p1.roubles).toBe(1000 - 100 + 90); // paid 50x2 to build, then collected rent
  });

  it('sells a house back for half price, returning it to the bank supply', () => {
    let state = createInitialGameState(PLAYERS);
    state = withFullLightBlueGroup(state, 'p1');
    state = buildHouse(state, 'p1', 6);

    state = sellHouse(state, 'p1', 6);

    expect(state.propertyHouses[6]).toBe(0);
    expect(state.players.p1.roubles).toBe(1000 - 50 + 25);
    expect(state.housesRemaining).toBe(32);
  });

  it('selling a hotel converts it back to 4 houses and refunds half its cost', () => {
    let state = createInitialGameState(PLAYERS);
    state = withFullLightBlueGroup(state, 'p1');
    state = { ...state, propertyHouses: { 6: 5 }, hotelsRemaining: 11, housesRemaining: 32 };

    state = sellHouse(state, 'p1', 6);

    expect(state.propertyHouses[6]).toBe(4);
    expect(state.hotelsRemaining).toBe(12);
    expect(state.housesRemaining).toBe(28);
    expect(state.players.p1.roubles).toBe(1000 + 25);
  });

  it('refuses to break down a hotel if the bank has fewer than 4 houses available', () => {
    let state = createInitialGameState(PLAYERS);
    state = withFullLightBlueGroup(state, 'p1');
    state = { ...state, propertyHouses: { 6: 5 }, hotelsRemaining: 11, housesRemaining: 2 };

    state = sellHouse(state, 'p1', 6);

    expect(state.propertyHouses[6]).toBe(5); // still a hotel
    expect(state.hotelsRemaining).toBe(11);
    expect(state.housesRemaining).toBe(2);
    expect(state.players.p1.roubles).toBe(1000); // no refund
  });
});

describe("Hat's power (free house on completing a collection)", () => {
  const players = [
    { playerId: 'p1', pieceId: 'hat' as const },
    { playerId: 'p2', pieceId: 'boot' as const },
  ];

  it('grants a free house the moment a normal purchase completes a collection', () => {
    let state = createInitialGameState(players);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [1] } }, // already owns tile 1 (purple)
    };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [1, 2]); // -> tile 3, the other purple property

    state = rollDice(state);
    state = buyProperty(state);

    expect(state.players.p1.ownedTileIds).toEqual(expect.arrayContaining([1, 3]));
    expect(state.hatFreeHouseGroups).toContain('purple');
    // Tied at 0 houses each, so the free house lands on the lower tile ID (1).
    expect(state.propertyHouses[1]).toBe(1);
    expect(state.housesRemaining).toBe(31);
  });

  it('also grants the free house when a collection completes via a forced seizure', () => {
    let state = createInitialGameState(players);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, ownedTileIds: [1] },
        p2: { ...state.players.p2, ownedTileIds: [3] },
      },
    };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'siegeOfStalingrad');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state);
    state = drawFromPile(state);

    state = resolveCardTarget(state, { targetTileId: 3 });

    expect(state.players.p1.ownedTileIds).toEqual(expect.arrayContaining([1, 3]));
    expect(state.hatFreeHouseGroups).toContain('purple');
    expect(state.propertyHouses[1]).toBe(1);
  });

  it("does not re-grant a free house for a group it's already been rewarded for", () => {
    let state = createInitialGameState(players);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [1, 3] } },
      hatFreeHouseGroups: ['purple'],
      propertyHouses: { 1: 1 },
      housesRemaining: 31,
    };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedCard(state, 'phoneCallFromStalin');
    state = devSetForcedRoll(state, [1, 3]);
    state = rollDice(state);
    state = drawFromPile(state, () => 0.99); // internal die roll -> 6, not 1

    // Re-claims an already-owned tile - routes back through giveTileTo,
    // re-triggering the Hat check, but the group is already recorded.
    state = resolveCardTarget(state, { targetTileId: 1 });

    expect(state.propertyHouses[1]).toBe(1); // unchanged - no second freebie
    expect(state.hatFreeHouseGroups).toEqual(['purple']); // still just the one entry
  });

  it('Disappearing clears the reward record for groups Hat no longer owns, and returns houses to the bank', () => {
    let state = createInitialGameState(players);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [1, 3] } },
      hatFreeHouseGroups: ['purple'],
      propertyHouses: { 1: 1 },
      housesRemaining: 31,
    };
    state = devSetForcedCard(state, 'accident'); // disappearStub via a real card path
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 4]);

    state = rollDice(state);
    state = drawFromPile(state);

    expect(state.players.p1.ownedTileIds).toEqual([]);
    expect(state.hatFreeHouseGroups).toEqual([]);
    expect(state.propertyHouses[1]).toBe(0);
    expect(state.housesRemaining).toBe(32); // the house came back to the bank
  });
});

describe('mortgaging', () => {
  it('mortgages a property for half its price', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6] } } };

    state = mortgageProperty(state, 'p1', 6);

    expect(state.players.p1.roubles).toBe(1000 + 50);
    expect(state.mortgagedTileIds).toEqual([6]);
  });

  it('mortgages a railroad too', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [5] } } };

    state = mortgageProperty(state, 'p1', 5); // Komsomolskaya Station, price 200

    expect(state.players.p1.roubles).toBe(1000 + 100);
    expect(state.mortgagedTileIds).toEqual([5]);
  });

  it("refuses to mortgage if there are houses anywhere in the property's collection", () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6, 8, 9] } },
      propertyHouses: { 8: 2 }, // houses on a group-mate, not tile 6 itself
    };
    state = mortgageProperty(state, 'p1', 6);

    expect(state.mortgagedTileIds).toEqual([]);
    expect(state.players.p1.roubles).toBe(1000);
  });

  it('refuses to build a house on a mortgaged property', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6, 8, 9] } },
    };
    state = mortgageProperty(state, 'p1', 6);
    const afterMortgage = state;

    state = buildHouse(state, 'p1', 6);

    expect(state.propertyHouses[6]).toBeUndefined();
    expect(state.players.p1.roubles).toBe(afterMortgage.players.p1.roubles);
  });

  it('a mortgaged property charges no rent', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      // Below 1000 so the mortgage payout below doesn't also trip the
      // separate over-1000 jail rule - this test is just about the rent.
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6], roubles: 500 } },
    };
    state = mortgageProperty(state, 'p1', 6);
    state = endTurn(state); // p2's turn
    state = withPosition(state, 'p2', 0);
    state = devSetForcedRoll(state, [3, 3]); // -> tile 6

    state = rollDice(state);

    expect(state.players.p2.roubles).toBe(1000); // no rent paid
    expect(state.players.p1.roubles).toBe(500 + 50); // just the mortgage payout, no rent
  });

  it('pays off a mortgage for the mortgage value plus 10% interest', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6] } } };
    state = mortgageProperty(state, 'p1', 6); // +50, roubles now 1050

    state = unmortgageProperty(state, 'p1', 6); // pays back 55 (50 * 1.1)

    expect(state.mortgagedTileIds).toEqual([]);
    expect(state.players.p1.roubles).toBe(1050 - 55);
  });

  it("refuses to pay off a mortgage without enough roubles", () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6], roubles: 10 } },
      mortgagedTileIds: [6],
    };

    state = unmortgageProperty(state, 'p1', 6);

    expect(state.mortgagedTileIds).toEqual([6]);
    expect(state.players.p1.roubles).toBe(10);
  });

  it('a mortgage on a property automatically clears (unrefunded) if the owner Disappears', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6] } },
      mortgagedTileIds: [6],
    };
    state = devSetForcedCard(state, 'accident');
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 4]);

    state = rollDice(state);
    state = drawFromPile(state);

    expect(state.players.p1.ownedTileIds).toEqual([]);
    expect(state.mortgagedTileIds).toEqual([]);
  });
});

describe('Smuggling to the West', () => {
  it('landing on Free Parking opens a smuggle offer up to the current roubles', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 15);
    state = devSetForcedRoll(state, [2, 3]); // 15 + 5 -> tile 20, Free Parking

    state = rollDice(state);

    expect(state.pendingDecision).toEqual({ type: 'smuggleOffer', maxAmount: 1000 });
  });

  it('resolveSmuggleOffer deposits the chosen amount as pending (at-risk) West roubles', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 15);
    state = devSetForcedRoll(state, [2, 3]);
    state = rollDice(state);

    state = resolveSmuggleOffer(state, 400);

    expect(state.players.p1.roubles).toBe(600);
    expect(state.players.p1.pendingWestRoubles).toBe(400);
    expect(state.players.p1.westRoubles).toBe(0);
    expect(state.pendingDecision).toBeNull();
  });

  it('skipping (0) smuggles nothing', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 15);
    state = devSetForcedRoll(state, [2, 3]);
    state = rollDice(state);

    state = resolveSmuggleOffer(state, 0);

    expect(state.players.p1.roubles).toBe(1000);
    expect(state.players.p1.pendingWestRoubles).toBe(0);
  });

  it('clamps an offer above what the player actually has', () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 15);
    state = devSetForcedRoll(state, [2, 3]);
    state = rollDice(state);

    state = resolveSmuggleOffer(state, 999999);

    expect(state.players.p1.roubles).toBe(0);
    expect(state.players.p1.pendingWestRoubles).toBe(1000);
    // Smuggling every last rouble away leaves 0 on hand - the house rule
    // catches that same as any other way of running dry.
    expect(state.players.p1.inJail).toBe(true);
  });

  it('landing back on Free Parking secures pending West roubles', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, pendingWestRoubles: 100 } },
    };
    state = withPosition(state, 'p1', 15);
    state = devSetForcedRoll(state, [2, 3]); // -> tile 20 again

    state = rollDice(state);

    expect(state.players.p1.westRoubles).toBe(100);
    expect(state.players.p1.pendingWestRoubles).toBe(0);
  });

  it('passing/landing on STOY also secures pending West roubles (the checkpoint opposite Free Parking)', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, pendingWestRoubles: 100 } },
    };
    state = withPosition(state, 'p1', 38);
    state = devSetForcedRoll(state, [1, 2]); // 38 + 3 -> wraps past STOY to tile 1

    state = rollDice(state);

    expect(state.players.p1.westRoubles).toBe(100);
    expect(state.players.p1.pendingWestRoubles).toBe(0);
  });

  it('another player landing on Free Parking catches pending West roubles and Disappears the smuggler', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, pendingWestRoubles: 250 } },
    };
    state = endTurn(state); // p2's turn
    state = withPosition(state, 'p2', 15);
    state = devSetForcedRoll(state, [2, 3]); // p2 -> tile 20

    state = rollDice(state);

    expect(state.players.p2.roubles).toBe(1000 + 250); // kept it
    expect(state.players.p1.pendingWestRoubles).toBe(0);
    expect(state.players.p1.westRoubles).toBe(0);
    // p1 Disappeared: fresh start, old Piece retired, needs to pick a new one.
    expect(state.players.p1.roubles).toBe(1000);
    expect(state.players.p1.ownedTileIds).toEqual([]);
    expect(state.retiredPieceIds).toContain('boot');
    expect(state.pendingPieceChoices).toContain('p1');
  });

  it('Disappearing for any other reason still fully Seizes both safe and pending West roubles', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, westRoubles: 500, pendingWestRoubles: 100 },
      },
    };
    state = devSetForcedCard(state, 'accident');
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 4]);

    state = rollDice(state);
    state = drawFromPile(state);

    expect(state.players.p1.westRoubles).toBe(0);
    expect(state.players.p1.pendingWestRoubles).toBe(0);
  });
});

describe("Penguin's power (smuggle on any owned property/railroad)", () => {
  const players = [
    { playerId: 'p1', pieceId: 'penguin' as const },
    { playerId: 'p2', pieceId: 'boot' as const },
  ];

  it('opens a smuggle offer landing on their own owned property (normally a no-op)', () => {
    let state = createInitialGameState(players);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6] } } };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 3]); // -> tile 6, already theirs

    state = rollDice(state);

    expect(state.pendingDecision).toEqual({ type: 'smuggleOffer', maxAmount: 1000 });
  });

  it("opens a smuggle offer landing on someone else's owned property, after rent resolves", () => {
    let state = createInitialGameState(players);
    state = { ...state, players: { ...state.players, p2: { ...state.players.p2, ownedTileIds: [6] } } };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 3]);

    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(1000 - 6); // paid base rent first
    expect(state.pendingDecision).toEqual({ type: 'smuggleOffer', maxAmount: 1000 - 6 });
  });

  it('extends to railroads too', () => {
    let state = createInitialGameState(players);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [5] } } };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [2, 3]); // -> tile 5, railroad, already theirs

    state = rollDice(state);

    expect(state.pendingDecision).toEqual({ type: 'smuggleOffer', maxAmount: 1000 });
  });

  it('does NOT extend to utilities', () => {
    let state = createInitialGameState(players);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [12] } } };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [6, 6]); // -> tile 12, Chernobyl Power, already theirs

    state = rollDice(state);

    expect(state.pendingDecision).toBeNull();
  });

  it("a non-Penguin piece landing on their own property still gets no smuggle prompt", () => {
    let state = createInitialGameState(PLAYERS); // p1 is boot
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6] } } };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 3]);

    state = rollDice(state);

    expect(state.pendingDecision).toBeNull();
  });
});

describe('Destitute (unpayable debts send you to jail instead of going negative)', () => {
  it("can't afford rent - jailed, debt forgiven entirely, owner gets nothing", () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, roubles: 2 }, // rent on tile 6 is 6
        p2: { ...state.players.p2, ownedTileIds: [6] },
      },
    };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 3]); // -> tile 6

    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(2); // untouched, not partial payment
    expect(state.players.p1.inJail).toBe(true);
    expect(state.players.p2.roubles).toBe(1000); // received nothing
  });

  it("can't afford the STOY pass fee - jailed en route, never actually resolves the landing tile", () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, roubles: 10, ownedTileIds: [] }, // fee is 50
      },
    };
    state = withPosition(state, 'p1', 38);
    state = devSetForcedRoll(state, [1, 2]); // 38 + 3 -> wraps past STOY to tile 1 (unowned property)

    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(10);
    expect(state.players.p1.inJail).toBe(true);
    expect(state.pendingDecision).toBeNull(); // never got a purchase prompt for tile 1
  });

  it('secures pendingWestRoubles even when the STOY pass fee itself sends the player to jail', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, roubles: 10, pendingWestRoubles: 300, ownedTileIds: [] }, // fee is 50
      },
    };
    state = withPosition(state, 'p1', 38);
    state = devSetForcedRoll(state, [1, 2]); // 38 + 3 -> wraps past STOY to tile 1

    state = rollDice(state);

    expect(state.players.p1.inJail).toBe(true);
    expect(state.players.p1.westRoubles).toBe(300); // secured despite the jailing
    expect(state.players.p1.pendingWestRoubles).toBe(0);
  });

  it("can't afford a Telegraph Union toll - jailed, no split paid to the Commissar", () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      commissarPlayerId: 'p2',
      closedTileIds: [6],
      players: { ...state.players, p1: { ...state.players.p1, roubles: 5 } }, // toll is 20
    };
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 3]); // -> tile 6, closed

    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(5);
    expect(state.players.p1.inJail).toBe(true);
    expect(state.players.p2.roubles).toBe(1000); // no toll split received
  });
});

describe('Disappear and the Piece Pool', () => {
  it('retires the old Piece and queues the player to pick a new one, when the Pool has options', () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetForcedCard(state, 'accident');
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 4]);

    state = rollDice(state);
    state = drawFromPile(state);

    expect(state.retiredPieceIds).toEqual(['boot']);
    expect(state.pendingPieceChoices).toEqual(['p1']);
    expect(state.players.p1.isSpectating).toBe(false);
  });

  it("rollDice refuses to run for a player who still needs to pick a new Piece", () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, pendingPieceChoices: ['p1'] };

    const result = rollDice(state);

    expect(result).toBe(state);
  });

  it('chooseNewPiece assigns an available Piece and clears the pending choice', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, pendingPieceChoices: ['p1'], retiredPieceIds: ['boot'] };

    state = chooseNewPiece(state, 'p1', 'iron');

    expect(state.players.p1.pieceId).toBe('iron');
    expect(state.pendingPieceChoices).toEqual([]);
  });

  it('rejects a Piece already held by someone else', () => {
    let state = createInitialGameState(PLAYERS); // p2 already holds battleship
    state = { ...state, pendingPieceChoices: ['p1'], retiredPieceIds: ['boot'] };

    state = chooseNewPiece(state, 'p1', 'battleship');

    expect(state.players.p1.pieceId).toBe('boot'); // unchanged - rejected
    expect(state.pendingPieceChoices).toEqual(['p1']);
  });

  it('rejects a Piece that was permanently retired', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, pendingPieceChoices: ['p1'], retiredPieceIds: ['boot', 'iron'] };

    state = chooseNewPiece(state, 'p1', 'iron');

    expect(state.players.p1.pieceId).toBe('boot');
  });

  it('getAvailablePieceIds excludes both retired and other-held Pieces', () => {
    // Realistic mid-Disappear shape: the old Piece is already retired by
    // the time this gets called (see disappearPlayer), even though
    // players.p1.pieceId itself still shows the stale value until they pick.
    const state: GameState = { ...createInitialGameState(PLAYERS), retiredPieceIds: ['boot'] };
    const available = getAvailablePieceIds(state, 'p1');

    expect(available).not.toContain('boot');
    expect(available).not.toContain('battleship');
    expect(available).toHaveLength(10);
  });

  it('an empty Piece Pool leaves the player permanently spectating instead of queuing a choice', () => {
    let state = createInitialGameState(PLAYERS); // p1 boot, p2 battleship
    state = {
      ...state,
      // Retire everything except what's currently held - the next
      // Disappear will have nothing left to offer.
      retiredPieceIds: ['car', 'iron', 'thimble', 'dog', 'wheelBarrel', 'hat', 'penguin', 'cat', 'rubberDuck', 'trex'],
    };
    state = devSetForcedCard(state, 'accident');
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 4]);

    state = rollDice(state);
    state = drawFromPile(state);

    expect(state.players.p1.isSpectating).toBe(true);
    expect(state.pendingPieceChoices).toEqual([]);
    expect(state.retiredPieceIds).toContain('boot');
  });

  it('a spectating player is skipped forever in turn order', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'boot' as const },
      { playerId: 'p2', pieceId: 'battleship' as const },
      { playerId: 'p3', pieceId: 'car' as const },
    ]);
    state = {
      ...state,
      players: { ...state.players, p2: { ...state.players.p2, isSpectating: true } },
    };
    // Land on Jail "just visiting" (tile 10) - no side effect, so nothing
    // blocks endTurn afterward.
    state = devSetForcedRoll(state, [4, 6]); // non-doubles, 0 + 10 -> tile 10

    state = rollDice(state); // p1's turn
    state = endTurn(state);

    expect(state.turnOrder[state.currentTurnIndex]).toBe('p3'); // skipped p2 entirely
  });
});

/** Test helper: jumps straight into "everyone's had their final turn except this one player" so a single endTurn() triggers scoring (or the target-choice phase) without needing to actually play out a full final lap. */
function triggerEndgame(state: GameState, lastRemainingPlayerId: string): GameState {
  const endgame: EndgameState = {
    finalLapRemaining: [lastRemainingPlayerId],
    pendingTargetChoices: [],
    targetChoices: {},
    results: null,
    scoreBreakdowns: null,
  };
  return { ...state, endgame };
}

describe('Endgame trigger (the Piece Pool running dry)', () => {
  it('starts the final lap the moment a Disappeared player claims the last available Piece', () => {
    let state = createInitialGameState(PLAYERS); // p1 boot, p2 battleship
    state = {
      ...state,
      retiredPieceIds: ['iron', 'thimble', 'dog', 'wheelBarrel', 'hat', 'penguin', 'cat', 'rubberDuck', 'trex'],
    };
    state = devSetForcedCard(state, 'accident');
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 4]);
    state = rollDice(state);
    state = drawFromPile(state); // p1 Disappears - exactly one Piece ('car') left in the Pool

    expect(state.pendingPieceChoices).toEqual(['p1']);
    expect(state.endgame).toBeNull();

    state = chooseNewPiece(state, 'p1', 'car');

    expect(state.endgame).not.toBeNull();
    expect(state.endgame?.finalLapRemaining).toEqual(['p1', 'p2']);
    expect(state.endgame?.results).toBeNull();
  });

  it('a room that fills every Piece at creation starts the Endgame immediately', () => {
    const players = STARTING_PIECES.map((piece, index) => ({
      playerId: `p${index + 1}`,
      pieceId: piece.id,
    }));

    const state = createInitialGameState(players);

    expect(state.endgame).not.toBeNull();
    expect(state.endgame?.finalLapRemaining).toHaveLength(12);
  });

  it('pops players off the final-lap list as their turns end, computing Scores once empty', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      endgame: { finalLapRemaining: ['p1', 'p2'], pendingTargetChoices: [], targetChoices: {}, results: null, scoreBreakdowns: null },
    };

    state = endTurn(state); // p1's turn ends
    expect(state.endgame?.finalLapRemaining).toEqual(['p2']);
    expect(state.endgame?.results).toBeNull();

    state = endTurn(state); // p2's turn ends
    expect(state.endgame?.finalLapRemaining).toEqual([]);
    expect(state.endgame?.results).not.toBeNull(); // neither piece needs a target
  });

  it('rollDice refuses to run once Scores are in', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      endgame: { finalLapRemaining: [], pendingTargetChoices: [], targetChoices: {}, results: { p1: 10, p2: 5 }, scoreBreakdowns: null },
    };

    expect(rollDice(state)).toBe(state);
  });

  it('a player who Disappears mid-final-lap (into permanent spectating) is pulled off the list instead of leaving the game stuck', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      retiredPieceIds: ['car', 'iron', 'thimble', 'dog', 'wheelBarrel', 'hat', 'penguin', 'cat', 'rubberDuck', 'trex'],
      endgame: { finalLapRemaining: ['p1', 'p2'], pendingTargetChoices: [], targetChoices: {}, results: null, scoreBreakdowns: null },
    };
    state = devSetForcedCard(state, 'accident');
    state = withPosition(state, 'p1', 0);
    state = devSetForcedRoll(state, [3, 4]);

    state = rollDice(state);
    state = drawFromPile(state); // p1 Disappears with nothing left in the Pool

    expect(state.players.p1.isSpectating).toBe(true);
    expect(state.endgame?.finalLapRemaining).toEqual(['p2']);
  });
});

describe('Endgame Win Condition scoring', () => {
  it('Boot: (roubles x properties) / (active players + 1)', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'boot' as const },
      { playerId: 'p2', pieceId: 'hat' as const },
    ]);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, roubles: 900, ownedTileIds: [1, 3, 6] } },
    };
    state = endTurn(triggerEndgame(state, 'p1'));

    expect(state.endgame?.results?.p1).toBe(900); // 900 * 3 / (2 + 1)
    expect(state.endgame?.results?.p2).toBe(0);
  });

  it('Battleship: roubles x house count (a hotel counts as 4 houses)', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'battleship' as const },
      { playerId: 'p2', pieceId: 'hat' as const },
    ]);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, roubles: 10, ownedTileIds: [1, 3] } },
      propertyHouses: { 1: 3, 3: 5 }, // 3 houses + a hotel (4) = 7
    };
    state = endTurn(triggerEndgame(state, 'p1'));

    expect(state.endgame?.results?.p1).toBe(70);
  });

  it('Car: West roubles x hotel count', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'car' as const },
      { playerId: 'p2', pieceId: 'hat' as const },
    ]);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, westRoubles: 50, ownedTileIds: [1, 3] } },
      propertyHouses: { 1: 5, 3: 5 }, // 2 hotels
    };
    state = endTurn(triggerEndgame(state, 'p1'));

    expect(state.endgame?.results?.p1).toBe(100);
  });

  it('Dog: half of West roubles', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'dog' as const },
      { playerId: 'p2', pieceId: 'hat' as const },
    ]);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, westRoubles: 101 } } };
    state = endTurn(triggerEndgame(state, 'p1'));

    expect(state.endgame?.results?.p1).toBe(50);
  });

  it('Wheel Barrel: West roubles x number of properties', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'wheelBarrel' as const },
      { playerId: 'p2', pieceId: 'hat' as const },
    ]);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, westRoubles: 10, ownedTileIds: [1, 3, 5] } },
    };
    state = endTurn(triggerEndgame(state, 'p1'));

    expect(state.endgame?.results?.p1).toBe(30);
  });

  it('Rubber duck: jailed-count x number of properties', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'rubberDuck' as const },
      { playerId: 'p2', pieceId: 'hat' as const },
    ]);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, sentToJailCount: 3, ownedTileIds: [1, 3] } },
    };
    state = endTurn(triggerEndgame(state, 'p1'));

    expect(state.endgame?.results?.p1).toBe(6);
  });

  it('sentToJailCount only increments when Rubber duck actually jails someone', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'rubberDuck' as const },
      { playerId: 'p2', pieceId: 'boot' as const },
    ]);
    state = { ...state, rubberDuckEncounter: { rubberDuckPlayerId: 'p1', targetPlayerId: 'p2' } };
    state = resolveRubberDuckEncounter(state, true);
    expect(state.players.p1.sentToJailCount).toBe(1);

    state = { ...state, rubberDuckEncounter: { rubberDuckPlayerId: 'p1', targetPlayerId: 'p2' } };
    state = resolveRubberDuckEncounter(state, false);
    expect(state.players.p1.sentToJailCount).toBe(1); // unchanged - declined
  });

  it("T-Rex: gives away roubles evenly, docks the remainder from their own Score, scores others-shared x seized properties", () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'trex' as const },
      { playerId: 'p2', pieceId: 'boot' as const },
      { playerId: 'p3', pieceId: 'battleship' as const },
    ]);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, roubles: 100, ownedTileIds: [1, 3, 5] }, // 3 seized properties
        p2: { ...state.players.p2, roubles: 0, ownedTileIds: [] }, // Boot's own formula stays 0 (no properties)
        p3: { ...state.players.p3, roubles: 0, ownedTileIds: [] }, // Battleship's own formula stays 0 (no houses)
      },
    };
    state = endTurn(triggerEndgame(state, 'p1'));

    // 100 roubles / 2 others = 50 each, no remainder. Score = 2 * 3 - 0 = 6
    expect(state.endgame?.results?.p1).toBe(6);
  });

  it('T-Rex: an uneven split docks the remainder from their own Score', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'trex' as const },
      { playerId: 'p2', pieceId: 'boot' as const },
      { playerId: 'p3', pieceId: 'boot' as const },
    ]);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, roubles: 101, ownedTileIds: [1] }, // 1 seized property
        p2: { ...state.players.p2, ownedTileIds: [] },
        p3: { ...state.players.p3, ownedTileIds: [] },
      },
    };
    state = endTurn(triggerEndgame(state, 'p1'));

    // 101 / 2 = 50 each, remainder 1. Score = 2*1 - 1 = 1
    expect(state.endgame?.results?.p1).toBe(1);
  });

  it("T-Rex's giveaway actually reaches the other players' hand, feeding Boot's own formula", () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'trex' as const },
      { playerId: 'p2', pieceId: 'boot' as const },
    ]);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, roubles: 200, ownedTileIds: [] },
        p2: { ...state.players.p2, roubles: 0, ownedTileIds: [1] },
      },
    };
    state = endTurn(triggerEndgame(state, 'p1'));

    // p2 receives all 200 (the only other player), then Boot: floor(200 * 1 / 3)
    expect(state.endgame?.results?.p2).toBe(Math.floor(200 / 3));
  });

  it("Penguin: target's Score is locked at 0, Penguin gets what the target's own formula would have scored", () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'penguin' as const },
      { playerId: 'p2', pieceId: 'dog' as const },
    ]);
    state = { ...state, players: { ...state.players, p2: { ...state.players.p2, westRoubles: 40 } } };
    state = endTurn(triggerEndgame(state, 'p1'));
    expect(state.endgame?.pendingTargetChoices).toEqual(['p1']);

    state = chooseEndgameTarget(state, 'p1', 'p2');

    expect(state.endgame?.results?.p2).toBe(0);
    expect(state.endgame?.results?.p1).toBe(20); // Dog's own formula: floor(40 / 2)
  });

  it('Penguin: rejects targeting self, still scores off a valid later choice', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'penguin' as const },
      { playerId: 'p2', pieceId: 'hat' as const },
    ]);
    state = endTurn(triggerEndgame(state, 'p1'));

    state = chooseEndgameTarget(state, 'p1', 'p1'); // rejected
    expect(state.endgame?.pendingTargetChoices).toEqual(['p1']);

    state = chooseEndgameTarget(state, 'p1', 'p2');
    expect(state.endgame?.results?.p1).toBe(0); // Hat's own formula is 0 anyway
  });

  it("Iron: target's Score becomes Iron's Roubles-in-hand, Iron gets half their own Roubles", () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'iron' as const },
      { playerId: 'p2', pieceId: 'dog' as const },
    ]);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, roubles: 300 },
        p2: { ...state.players.p2, westRoubles: 1000 }, // would otherwise score 500
      },
    };
    state = endTurn(triggerEndgame(state, 'p1'));
    state = chooseEndgameTarget(state, 'p1', 'p2');

    expect(state.endgame?.results?.p2).toBe(300); // replaced entirely
    expect(state.endgame?.results?.p1).toBe(150); // half of Iron's own roubles
  });

  it("Thimble: deducts their Roubles from a target's Score - a negative result becomes Thimble's own (positive) Score", () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'thimble' as const },
      { playerId: 'p2', pieceId: 'dog' as const },
    ]);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, roubles: 150 },
        p2: { ...state.players.p2, westRoubles: 200 }, // own formula: 100
      },
    };
    state = endTurn(triggerEndgame(state, 'p1'));
    state = chooseEndgameTarget(state, 'p1', 'p2');

    expect(state.endgame?.results?.p2).toBe(-50); // 100 - 150, stays negative
    expect(state.endgame?.results?.p1).toBe(50); // positive mirror
  });

  it("Thimble: scores zero if the deduction doesn't go negative", () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'thimble' as const },
      { playerId: 'p2', pieceId: 'dog' as const },
    ]);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, roubles: 50 },
        p2: { ...state.players.p2, westRoubles: 200 }, // own formula: 100
      },
    };
    state = endTurn(triggerEndgame(state, 'p1'));
    state = chooseEndgameTarget(state, 'p1', 'p2');

    expect(state.endgame?.results?.p2).toBe(50); // 100 - 50, stays positive
    expect(state.endgame?.results?.p1).toBe(0);
  });

  it('Cat: scores 0, then everyone rotates Score clockwise by board position', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'cat' as const },
      { playerId: 'p2', pieceId: 'dog' as const },
      { playerId: 'p3', pieceId: 'wheelBarrel' as const },
    ]);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, position: 10 },
        p2: { ...state.players.p2, position: 5, westRoubles: 100 }, // own score 50
        p3: { ...state.players.p3, position: 20, westRoubles: 10, ownedTileIds: [1] }, // own score 10
      },
    };
    state = endTurn(triggerEndgame(state, 'p1'));

    // Ascending board position: p2(5) -> p1(10) -> p3(20) -> wraps to p2.
    // Pre-rotation scores: p1=0 (Cat), p2=50, p3=10. Each moves to the next.
    expect(state.endgame?.results?.p1).toBe(50); // received from p2
    expect(state.endgame?.results?.p2).toBe(10); // received from p3 (wraps around)
    expect(state.endgame?.results?.p3).toBe(0); // received from p1 (Cat's own 0)
    // The breakdown text rotates along with the score itself - whoever
    // receives Cat's own 0 gets told that, not "Always 0" themselves.
    expect(state.endgame?.scoreBreakdowns?.p3).toContain('always 0');
    expect(state.endgame?.scoreBreakdowns?.p1).toContain('rotated to you');
  });

  it('scoreBreakdowns records the actual numbers behind each Score, not just the final total', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'boot' as const },
      { playerId: 'p2', pieceId: 'dog' as const },
    ]);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, roubles: 300, ownedTileIds: [1, 3] }, // 300*2/3 = 200
        p2: { ...state.players.p2, westRoubles: 100 }, // 100/2 = 50
      },
    };
    state = endTurn(triggerEndgame(state, 'p1'));

    expect(state.endgame?.results?.p1).toBe(200);
    expect(state.endgame?.scoreBreakdowns?.p1).toBe('₽300 cash × 2 properties ÷ (2 players + 1) = 200');
    expect(state.endgame?.results?.p2).toBe(50);
    expect(state.endgame?.scoreBreakdowns?.p2).toBe('₽100 in the West ÷ 2 = 50');
  });

  it('permanently spectating players score nothing and cannot be chosen as a target', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'penguin' as const },
      { playerId: 'p2', pieceId: 'dog' as const },
      { playerId: 'p3', pieceId: 'hat' as const },
    ]);
    state = {
      ...state,
      players: { ...state.players, p2: { ...state.players.p2, isSpectating: true, westRoubles: 999 } },
    };
    state = endTurn(triggerEndgame(state, 'p1'));

    state = chooseEndgameTarget(state, 'p1', 'p2'); // rejected - spectating
    expect(state.endgame?.pendingTargetChoices).toEqual(['p1']);

    state = chooseEndgameTarget(state, 'p1', 'p3');
    expect(state.endgame?.results?.p2).toBeUndefined();
    expect(state.endgame?.results?.p1).toBe(0);
    expect(state.endgame?.results?.p3).toBe(0);
  });
});

describe('Dev Panel: force Disappear / force Endgame', () => {
  it('devForceDisappear runs the real Disappear on demand for any player', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, roubles: 5, ownedTileIds: [6] } } };

    state = devForceDisappear(state, 'p1');

    expect(state.players.p1.roubles).toBe(1000);
    expect(state.players.p1.ownedTileIds).toEqual([]);
    expect(state.retiredPieceIds).toContain('boot');
    expect(state.pendingPieceChoices).toContain('p1');
  });

  it('devForceDisappear is a no-op for an unknown player', () => {
    const state = createInitialGameState(PLAYERS);
    expect(devForceDisappear(state, 'not-a-real-player')).toBe(state);
  });

  it('Disappear zeroes the West stash by default', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, westRoubles: 300, pendingWestRoubles: 50 } } };

    state = devForceDisappear(state, 'p1');

    expect(state.players.p1.westRoubles).toBe(0);
    expect(state.players.p1.pendingWestRoubles).toBe(0);
  });

  it('carryWestOnDisappear keeps the West stash through a Disappear', () => {
    let state = createInitialGameState(PLAYERS, Math.random, true);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, westRoubles: 300, pendingWestRoubles: 50 } } };

    state = devForceDisappear(state, 'p1');

    expect(state.players.p1.westRoubles).toBe(300);
    expect(state.players.p1.pendingWestRoubles).toBe(50);
  });

  it('devForceEndgame retires every unheld Piece and starts the final lap immediately', () => {
    let state = createInitialGameState(PLAYERS); // p1 boot, p2 battleship

    state = devForceEndgame(state);

    expect(state.retiredPieceIds).toHaveLength(10); // everything except boot/battleship
    expect(state.retiredPieceIds).not.toContain('boot');
    expect(state.retiredPieceIds).not.toContain('battleship');
    expect(state.endgame).not.toBeNull();
    expect(state.endgame?.finalLapRemaining).toEqual(['p1', 'p2']);
  });

  it('devForceEndgame is a no-op once the Endgame has already started', () => {
    let state = createInitialGameState(PLAYERS);
    state = devForceEndgame(state);
    const afterFirst = state;

    state = devForceEndgame(state);

    expect(state).toBe(afterFirst);
  });
});

describe('Dev Panel: unstick the game (a disconnected player)', () => {
  it('devForceSkipTurn ends the turn even with an unresolved pending decision', () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetForcedRoll(state, [2, 4]);
    state = rollDice(state); // lands p1 on an unowned property - leaves a 'purchase' pendingDecision

    expect(state.pendingDecision?.type).toBe('purchase');
    expect(state.currentTurnIndex).toBe(0);

    state = devForceSkipTurn(state);

    expect(state.pendingDecision).toBeNull();
    expect(state.currentTurnIndex).toBe(1); // actually passed to p2
  });

  it("devForceSkipTurn doesn't chain into another roll even if the abandoned turn had rolled doubles", () => {
    let state = createInitialGameState(PLAYERS);
    state = withPosition(state, 'p1', 11);
    state = devSetForcedRoll(state, [2, 2]); // doubles - normally means roll again
    state = rollDice(state);
    expect(state.lastRollWasDoubles).toBe(true);

    state = devForceSkipTurn(state);

    expect(state.currentTurnIndex).toBe(1);
  });

  it('devForceAutoPickPiece picks the first available Piece for a player stuck choosing one', () => {
    let state = createInitialGameState(PLAYERS);
    state = devForceDisappear(state, 'p1');
    expect(state.pendingPieceChoices).toContain('p1');

    state = devForceAutoPickPiece(state, 'p1');

    expect(state.pendingPieceChoices).not.toContain('p1');
    expect(state.players.p1.pieceId).not.toBe('boot'); // boot is retired, can't be re-picked
  });

  it('devForceAutoPickPiece is a no-op for a player who is not actually stuck choosing one', () => {
    const state = createInitialGameState(PLAYERS);
    expect(devForceAutoPickPiece(state, 'p1')).toBe(state);
  });
});

describe('Dev Panel: kick a player', () => {
  it('seizes everything, retires their Piece, and permanently spectates them', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, roubles: 500, ownedTileIds: [6] } },
    };

    state = devKickPlayer(state, 'p1');

    expect(state.players.p1.roubles).toBe(1000); // reset by the seizure
    expect(state.players.p1.ownedTileIds).toEqual([]);
    expect(state.retiredPieceIds).toContain('boot');
    expect(state.players.p1.isSpectating).toBe(true);
    expect(state.pendingPieceChoices).not.toContain('p1'); // never queued for a pick - no one left to make it
  });

  it("forces the turn to end if it was the kicked player's turn", () => {
    let state = createInitialGameState(PLAYERS);
    expect(state.turnOrder[state.currentTurnIndex]).toBe('p1');

    state = devKickPlayer(state, 'p1');

    expect(state.turnOrder[state.currentTurnIndex]).toBe('p2');
  });

  it("doesn't touch the turn order when kicking someone whose turn it isn't", () => {
    let state = createInitialGameState(PLAYERS);
    state = endTurn(state); // p1's (empty) turn ends -> p2's turn
    expect(state.turnOrder[state.currentTurnIndex]).toBe('p2');

    state = devKickPlayer(state, 'p1');

    expect(state.turnOrder[state.currentTurnIndex]).toBe('p2'); // unchanged
    expect(state.players.p1.isSpectating).toBe(true);
  });

  it('is a no-op for an unknown player or one already spectating', () => {
    let state = createInitialGameState(PLAYERS);
    expect(devKickPlayer(state, 'not-a-real-player')).toBe(state);

    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, isSpectating: true } } };
    expect(devKickPlayer(state, 'p1')).toBe(state);
  });

  it('pulls a kicked player off the final lap, computing Scores immediately if they were the last one owed a turn', () => {
    let state = createInitialGameState(PLAYERS);
    state = triggerEndgame(state, 'p1');

    state = devKickPlayer(state, 'p1');

    expect(state.endgame?.finalLapRemaining).toEqual([]);
    expect(state.endgame?.results).not.toBeNull();
  });

  it('pulls a kicked player off pendingTargetChoices (their own transfer just does not happen), computing Scores if they were last', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'iron' as const },
      { playerId: 'p2', pieceId: 'boot' as const },
    ]);
    state = {
      ...state,
      endgame: { finalLapRemaining: [], pendingTargetChoices: ['p1'], targetChoices: {}, results: null, scoreBreakdowns: null },
    };

    state = devKickPlayer(state, 'p1');

    expect(state.endgame?.pendingTargetChoices).toEqual([]);
    expect(state.endgame?.results).not.toBeNull();
    // Kicked (permanently spectating) players don't participate in
    // scoring at all, source or target - not even a 0 entry - same as
    // any other spectator (see computeEndgameScores' doc comment).
    expect(state.endgame?.results?.p1).toBeUndefined();
    expect(state.endgame?.results?.p2).toBeDefined();
  });

  it('kicking a player stuck choosing a replacement Piece spectates them instead of leaving them queued', () => {
    let state = createInitialGameState(PLAYERS);
    state = devForceDisappear(state, 'p1');
    expect(state.pendingPieceChoices).toContain('p1');

    state = devKickPlayer(state, 'p1');

    expect(state.pendingPieceChoices).not.toContain('p1');
    expect(state.players.p1.isSpectating).toBe(true);
  });
});

describe('AFK handling (useAfkSelfCheck / useHostAfkWatchdog)', () => {
  it('afkSkipTurn ends the turn (abandoning any pending decision) and counts the skip', () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetForcedRoll(state, [2, 4]);
    state = rollDice(state); // lands p1 on an unowned property - leaves a pending purchase decision
    expect(state.pendingDecision?.type).toBe('purchase');

    state = afkSkipTurn(state);

    expect(state.pendingDecision).toBeNull();
    expect(state.currentTurnIndex).toBe(1); // actually passed to p2
    expect(state.players.p1.consecutiveAfkSkips).toBe(1);
    expect(state.players.p1.isSpectating).toBe(false);
  });

  it('benches the player instead of skipping again once the away-skip limit is reached', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, consecutiveAfkSkips: 3 } } };

    state = afkSkipTurn(state);

    expect(state.players.p1.isSpectating).toBe(true);
    expect(state.players.p1.isAfkSpectating).toBe(true);
    expect(state.players.p1.consecutiveAfkSkips).toBe(0); // reset, not left sitting at the limit
    expect(state.currentTurnIndex).toBe(1); // still moved on to p2
  });

  it("benching (unlike a real Disappear/kick) doesn't touch roubles or properties - nothing was seized", () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, consecutiveAfkSkips: 3, roubles: 700, ownedTileIds: [6] },
      },
    };

    state = afkSkipTurn(state);

    expect(state.players.p1.roubles).toBe(700);
    expect(state.players.p1.ownedTileIds).toEqual([6]);
  });

  it('benching pulls the player off finalLapRemaining/pendingTargetChoices, same cascades as a kick', () => {
    let state = createInitialGameState([
      { playerId: 'p1', pieceId: 'iron' as const },
      { playerId: 'p2', pieceId: 'boot' as const },
    ]);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, consecutiveAfkSkips: 3 } },
      endgame: { finalLapRemaining: [], pendingTargetChoices: ['p1'], targetChoices: {}, results: null, scoreBreakdowns: null },
    };

    state = afkSkipTurn(state);

    expect(state.endgame?.pendingTargetChoices).toEqual([]);
    expect(state.endgame?.results).not.toBeNull(); // p1 was the last one blocking it
  });

  it('rollDice clears an away-skip streak the moment the player actually rolls for real', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, consecutiveAfkSkips: 2 } } };
    state = devSetForcedRoll(state, [2, 4]);

    state = rollDice(state);

    expect(state.players.p1.consecutiveAfkSkips).toBe(0);
  });

  it('confirmStillHere clears the streak for the current player without ending their turn', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, consecutiveAfkSkips: 2 } } };

    state = confirmStillHere(state, 'p1');

    expect(state.players.p1.consecutiveAfkSkips).toBe(0);
    expect(state.currentTurnIndex).toBe(0); // still p1's turn
  });

  it("confirmStillHere is a no-op for anyone other than whoever's turn it currently is", () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, players: { ...state.players, p2: { ...state.players.p2, consecutiveAfkSkips: 2 } } };

    state = confirmStillHere(state, 'p2'); // it's p1's turn, not p2's

    expect(state.players.p2.consecutiveAfkSkips).toBe(2); // unchanged
  });

  it('rejoinFromAfk resumes a benched player', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, isSpectating: true, isAfkSpectating: true } },
    };

    state = rejoinFromAfk(state, 'p1');

    expect(state.players.p1.isSpectating).toBe(false);
    expect(state.players.p1.isAfkSpectating).toBe(false);
  });

  it("rejoinFromAfk is a no-op for a player who isn't actually AFK-benched (e.g. a real kick/Disappear)", () => {
    let state = createInitialGameState(PLAYERS);
    state = devKickPlayer(state, 'p1'); // permanent spectating, isAfkSpectating stays false

    expect(rejoinFromAfk(state, 'p1')).toBe(state);
  });

  it('devKickPlayer can still permanently remove an AFK-benched player who never comes back', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, isSpectating: true, isAfkSpectating: true, roubles: 500, ownedTileIds: [6] },
      },
    };

    state = devKickPlayer(state, 'p1');

    expect(state.players.p1.isSpectating).toBe(true);
    expect(state.players.p1.isAfkSpectating).toBe(false); // no longer just benched - this is permanent now
    expect(state.players.p1.roubles).toBe(1000); // seized, unlike a plain AFK bench
    expect(state.players.p1.ownedTileIds).toEqual([]);
  });
});

describe('Lenin mode', () => {
  it('createInitialGameState threads rulesetMode through, defaulting to stalin', () => {
    expect(createInitialGameState(PLAYERS).rulesetMode).toBe('stalin');
    expect(createInitialGameState(PLAYERS, Math.random, false, 'lenin').rulesetMode).toBe('lenin');
  });

  it('fines instead of Disappearing on a Stalin-mode Disappear trigger (NKVD repeat visits)', () => {
    let state = createInitialGameState(PLAYERS, Math.random, false, 'lenin');
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, nkvdVisits: 2, roubles: 1000, ownedTileIds: [6] },
      },
    };
    state = withPosition(state, 'p1', 30);
    state = devSetForcedRoll(state, [4, 5]); // 30 + 9 -> tile 39, NKVD HQ, 3rd visit
    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(1000 - 300); // LENIN_FINE_NKVD
    expect(state.players.p1.ownedTileIds).toEqual([6]); // kept - not wiped like a real Disappear
    expect(state.players.p1.isSpectating).toBe(false);
  });

  it("jails for insolvency (doesn't partially pay) if the fine itself is unaffordable", () => {
    let state = createInitialGameState(PLAYERS, Math.random, false, 'lenin');
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, nkvdVisits: 2, roubles: 100, ownedTileIds: [] }, // fine is 300
      },
    };
    state = withPosition(state, 'p1', 30);
    state = devSetForcedRoll(state, [4, 5]);
    state = rollDice(state);

    expect(state.players.p1.roubles).toBe(100); // untouched
    expect(state.players.p1.inJail).toBe(true);
    expect(state.players.p1.jailedForInsolvency).toBe(true);
  });

  it('Stalin mode is unaffected by any of this - the same trigger still fully Disappears', () => {
    let state = createInitialGameState(PLAYERS); // stalin (default)
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

    expect(state.players.p1.roubles).toBe(1000); // full reset, not a fine
    expect(state.players.p1.ownedTileIds).toEqual([]);
  });

  describe('insolvency bailout roll', () => {
    it('doubles escapes jail and pays out a 100 rouble bailout', () => {
      let state = createInitialGameState(PLAYERS, Math.random, false, 'lenin');
      state = {
        ...state,
        players: {
          ...state.players,
          p1: { ...state.players.p1, inJail: true, jailedForInsolvency: true, roubles: 0, position: 10 },
        },
      };
      state = devSetForcedRoll(state, [3, 3]);

      state = rollDice(state);

      expect(state.players.p1.inJail).toBe(false);
      expect(state.players.p1.jailedForInsolvency).toBe(false);
      expect(state.players.p1.roubles).toBe(100);
    });

    it('anything but doubles eliminates outright', () => {
      let state = createInitialGameState(PLAYERS, Math.random, false, 'lenin');
      state = {
        ...state,
        players: {
          ...state.players,
          p1: {
            ...state.players.p1,
            inJail: true,
            jailedForInsolvency: true,
            roubles: 0,
            position: 10,
            ownedTileIds: [6],
          },
        },
      };
      state = devSetForcedRoll(state, [3, 4]);

      state = rollDice(state);

      expect(state.players.p1.isSpectating).toBe(true);
      expect(state.players.p1.jailedForInsolvency).toBe(false);
      expect(state.players.p1.ownedTileIds).toEqual([]);
    });
  });

  describe('liquidation choice (unpayable jail bribe)', () => {
    it('opens a liquidationChoice decision instead of eliminating outright if there is something to sell', () => {
      let state = createInitialGameState(PLAYERS, Math.random, false, 'lenin');
      state = {
        ...state,
        players: {
          ...state.players,
          p1: { ...state.players.p1, inJail: true, roubles: 10, ownedTileIds: [6] },
        },
      };

      state = endTurn(state);

      expect(state.pendingDecision).toEqual({ type: 'liquidationChoice', forPlayerId: 'p1', amountOwed: 100 });
      expect(state.currentTurnIndex).toBe(0); // turn hasn't actually advanced yet
    });

    it('eliminates outright, no liquidationChoice, if there is nothing to sell', () => {
      let state = createInitialGameState(PLAYERS, Math.random, false, 'lenin');
      state = {
        ...state,
        players: {
          ...state.players,
          p1: { ...state.players.p1, inJail: true, roubles: 10, ownedTileIds: [] },
        },
      };

      state = endTurn(state);

      expect(state.pendingDecision).toBeNull();
      expect(state.players.p1.isSpectating).toBe(true);
      expect(state.currentTurnIndex).toBe(1); // turn actually finished advancing
    });

    it('confirmLiquidationPayment pays and finishes the turn once affordable, no-ops otherwise', () => {
      let state = createInitialGameState(PLAYERS, Math.random, false, 'lenin');
      state = {
        ...state,
        players: {
          ...state.players,
          p1: { ...state.players.p1, inJail: true, roubles: 10, ownedTileIds: [6] }, // tile 6, price 100
        },
      };
      state = endTurn(state);
      expect(state.pendingDecision?.type).toBe('liquidationChoice');

      state = mortgageProperty(state, 'p1', 6); // +50 -> 60, still short of 100
      expect(state.players.p1.roubles).toBe(60);
      expect(confirmLiquidationPayment(state)).toBe(state); // no-op, still can't afford it

      state = { ...state, players: { ...state.players, p1: { ...state.players.p1, roubles: 150 } } };
      state = confirmLiquidationPayment(state);

      expect(state.pendingDecision).toBeNull();
      expect(state.players.p1.roubles).toBe(50);
      expect(state.currentTurnIndex).toBe(1); // turn finished advancing
    });

    it('declareBankruptcy eliminates the player and finishes the turn', () => {
      let state = createInitialGameState(PLAYERS, Math.random, false, 'lenin');
      state = {
        ...state,
        players: {
          ...state.players,
          p1: { ...state.players.p1, inJail: true, roubles: 10, ownedTileIds: [6] },
        },
      };
      state = endTurn(state);
      expect(state.pendingDecision?.type).toBe('liquidationChoice');

      state = declareBankruptcy(state);

      expect(state.players.p1.isSpectating).toBe(true);
      expect(state.pendingDecision).toBeNull();
      expect(state.currentTurnIndex).toBe(1);
    });
  });

  it('the match ends once exactly one non-spectating player is left', () => {
    const players = [
      { playerId: 'p1', pieceId: 'boot' as const },
      { playerId: 'p2', pieceId: 'battleship' as const },
      { playerId: 'p3', pieceId: 'car' as const },
    ];
    let state = createInitialGameState(players, Math.random, false, 'lenin');
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, inJail: true, roubles: 10, ownedTileIds: [] },
      },
    };

    state = endTurn(state); // p1 eliminated outright - p2 and p3 still active

    expect(state.players.p1.isSpectating).toBe(true);
    expect(state.leninWinnerId).toBeNull();

    state = {
      ...state,
      currentTurnIndex: state.turnOrder.indexOf('p2'),
      players: {
        ...state.players,
        p2: { ...state.players.p2, inJail: true, roubles: 10, ownedTileIds: [] },
      },
    };
    state = endTurn(state);

    expect(state.players.p2.isSpectating).toBe(true);
    expect(state.leninWinnerId).toBe('p3');
  });
});

describe('trading (both modes)', () => {
  it('proposes, then accept swaps tiles/roubles both ways', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: {
        ...state.players,
        p1: { ...state.players.p1, ownedTileIds: [6], roubles: 500 },
        p2: { ...state.players.p2, ownedTileIds: [8], roubles: 500 },
      },
    };

    state = proposeTrade(state, 'trade-1', 'p1', 'p2', { tileIds: [6], roubles: 50 }, { tileIds: [8], roubles: 0 });
    expect(state.activeTrades).toHaveLength(1);

    state = acceptTrade(state, 'trade-1');

    expect(state.activeTrades).toHaveLength(0);
    expect(state.players.p1.ownedTileIds).toEqual([8]);
    expect(state.players.p2.ownedTileIds).toEqual([6]);
    expect(state.players.p1.roubles).toBe(450);
    expect(state.players.p2.roubles).toBe(550);
  });

  it('decline removes the offer without swapping anything', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6] } } };
    state = proposeTrade(state, 'trade-1', 'p1', 'p2', { tileIds: [6], roubles: 0 }, { tileIds: [], roubles: 0 });

    state = declineTrade(state, 'trade-1');

    expect(state.activeTrades).toHaveLength(0);
    expect(state.players.p1.ownedTileIds).toEqual([6]);
  });

  it('withdraw removes the offer without swapping anything', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6] } } };
    state = proposeTrade(state, 'trade-1', 'p1', 'p2', { tileIds: [6], roubles: 0 }, { tileIds: [], roubles: 0 });

    state = withdrawTrade(state, 'trade-1');

    expect(state.activeTrades).toHaveLength(0);
    expect(state.players.p1.ownedTileIds).toEqual([6]);
  });

  it('rejects proposing a tile with houses on it', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6] } },
      propertyHouses: { 6: 2 },
    };

    state = proposeTrade(state, 'trade-1', 'p1', 'p2', { tileIds: [6], roubles: 0 }, { tileIds: [], roubles: 0 });

    expect(state.activeTrades).toHaveLength(0);
  });

  it('rejects proposing a tile locked by Siege of Stalingrad', () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6] } },
      lockedTileIds: [6],
    };

    state = proposeTrade(state, 'trade-1', 'p1', 'p2', { tileIds: [6], roubles: 0 }, { tileIds: [], roubles: 0 });

    expect(state.activeTrades).toHaveLength(0);
  });

  it('accept fails gracefully (no swap, just removes the offer) if something changed since it was proposed', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6] } } };
    state = proposeTrade(state, 'trade-1', 'p1', 'p2', { tileIds: [6], roubles: 0 }, { tileIds: [], roubles: 0 });

    // p1 loses the property some other way before p2 accepts.
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [] } } };

    state = acceptTrade(state, 'trade-1');

    expect(state.activeTrades).toHaveLength(0);
    expect(state.players.p2.ownedTileIds).toEqual([]); // nothing actually transferred
  });

  it('Disappearing clears any trades involving that player', () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [6] } } };
    state = proposeTrade(state, 'trade-1', 'p1', 'p2', { tileIds: [6], roubles: 0 }, { tileIds: [], roubles: 0 });
    expect(state.activeTrades).toHaveLength(1);

    state = devForceDisappear(state, 'p1');

    expect(state.activeTrades).toHaveLength(0);
  });
});
