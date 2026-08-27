import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialGameState, devSetRoubles } from '../game/engine';
import type { GameState } from '../types/game';

const gameSync = vi.hoisted(() => ({
  rollDiceAndSync: vi.fn(),
  buyPropertyAndSync: vi.fn(),
  skipPurchaseAndSync: vi.fn(),
  endTurnAndSync: vi.fn(),
  acceptVolgaOfferAndSync: vi.fn(),
  declineVolgaOfferAndSync: vi.fn(),
  acknowledgeCardAndSync: vi.fn(),
  chooseCardAndSync: vi.fn(),
  drawFromPileAndSync: vi.fn(),
  resolveCardTargetAndSync: vi.fn(),
  answerNkvdQuizAndSync: vi.fn(),
  buildHouseAndSync: vi.fn(),
  sellHouseAndSync: vi.fn(),
  mortgagePropertyAndSync: vi.fn(),
  confirmLiquidationPaymentAndSync: vi.fn(),
  declareBankruptcyAndSync: vi.fn(),
  resolveSmuggleOfferAndSync: vi.fn(),
  chooseNewPieceAndSync: vi.fn(),
  chooseEndgameTargetAndSync: vi.fn(),
  resolveCatRedirectAndSync: vi.fn(),
  rollCardDieAndSync: vi.fn(),
  castShowTrialVoteAndSync: vi.fn(),
}));

vi.mock('./gameSync', () => gameSync);

const { botDecisionFingerprint, gameProgressSignature, runBotStep } = await import('./botAi');

const PLAYERS = [
  { playerId: 'p1', pieceId: 'boot' as const },
  { playerId: 'bot-1', pieceId: 'battleship' as const },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runBotStep - purchase decisions', () => {
  it('skips an unaffordable purchase regardless of difficulty', async () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetRoubles(state, 'p1', 10);
    // Synthesize the pendingDecision directly rather than actually
    // landing on it via rollDice - landing itself is already covered by
    // engine.test.ts; this is only testing runBotStep's own response.
    state = { ...state, pendingDecision: { type: 'purchase', tileId: 1 } };

    await runBotStep('ROOM', state, 'p1', 'easy', false);
    expect(gameSync.skipPurchaseAndSync).toHaveBeenCalledTimes(1);
    expect(gameSync.buyPropertyAndSync).not.toHaveBeenCalled();
  });

  it('a Normal bot buys when it can afford the price plus its cash buffer', async () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetRoubles(state, 'p1', 1000);
    state = { ...state, pendingDecision: { type: 'purchase', tileId: 1 } };

    await runBotStep('ROOM', state, 'p1', 'normal', false);
    expect(gameSync.buyPropertyAndSync).toHaveBeenCalledTimes(1);
  });

  it('a Normal bot declines when buying would eat into its buffer', async () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetRoubles(state, 'p1', 150); // tile 1 costs 50 - leaves only 100, under the 150 buffer
    state = { ...state, pendingDecision: { type: 'purchase', tileId: 1 } };

    await runBotStep('ROOM', state, 'p1', 'normal', false);
    expect(gameSync.skipPurchaseAndSync).toHaveBeenCalledTimes(1);
  });

  it('forceFallback always skips, even when the bot could otherwise afford it', async () => {
    let state = createInitialGameState(PLAYERS);
    state = devSetRoubles(state, 'p1', 1000);
    state = { ...state, pendingDecision: { type: 'purchase', tileId: 1 } };

    await runBotStep('ROOM', state, 'p1', 'normal', true);
    expect(gameSync.skipPurchaseAndSync).toHaveBeenCalledTimes(1);
    expect(gameSync.buyPropertyAndSync).not.toHaveBeenCalled();
  });
});

describe('runBotStep - turn actions', () => {
  it('rolls when this bot is up and has no roll yet', async () => {
    const state = createInitialGameState(PLAYERS); // p1 (index 0) is up first
    await runBotStep('ROOM', state, 'p1', 'easy', false);
    expect(gameSync.rollDiceAndSync).toHaveBeenCalledTimes(1);
  });

  it('does nothing when it is not this bot\'s turn and no decision targets it', async () => {
    const state = createInitialGameState(PLAYERS); // p1 is up, not bot-1
    await runBotStep('ROOM', state, 'bot-1', 'easy', false);
    expect(gameSync.rollDiceAndSync).not.toHaveBeenCalled();
    expect(gameSync.endTurnAndSync).not.toHaveBeenCalled();
  });

  it('ends the turn once rolled and not doubles (Easy never tries to build)', async () => {
    let state = createInitialGameState(PLAYERS);
    state = { ...state, lastRoll: [2, 3], lastRollWasDoubles: false };
    await runBotStep('ROOM', state, 'p1', 'easy', false);
    expect(gameSync.endTurnAndSync).toHaveBeenCalledTimes(1);
    expect(gameSync.buildHouseAndSync).not.toHaveBeenCalled();
  });
});

describe('runBotStep - nkvdQuiz', () => {
  it('always answers (regardless of difficulty) with one of the offered options', async () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      pendingDecision: { type: 'nkvdQuiz', questionIndex: 0, forPlayerId: 'p1' },
    };
    await runBotStep('ROOM', state, 'p1', 'hard', false);
    expect(gameSync.answerNkvdQuizAndSync).toHaveBeenCalledTimes(1);
    const [, , answer] = gameSync.answerNkvdQuizAndSync.mock.calls[0];
    expect(typeof answer).toBe('string');
  });
});

describe('runBotStep - liquidationChoice', () => {
  function liquidationState(): GameState {
    let state = createInitialGameState(PLAYERS, Math.random, false, 'lenin');
    state = devSetRoubles(state, 'p1', 0);
    state = {
      ...state,
      pendingDecision: { type: 'liquidationChoice', forPlayerId: 'p1', amountOwed: 100 },
    };
    return state;
  }

  it('pays immediately if it can already afford the amount owed', async () => {
    let state = liquidationState();
    state = devSetRoubles(state, 'p1', 500);
    await runBotStep('ROOM', state, 'p1', 'normal', false);
    expect(gameSync.confirmLiquidationPaymentAndSync).toHaveBeenCalledTimes(1);
  });

  it('declares bankruptcy outright with nothing to sell or mortgage', async () => {
    const state = liquidationState(); // fresh player: no properties, no houses
    await runBotStep('ROOM', state, 'p1', 'normal', false);
    expect(gameSync.declareBankruptcyAndSync).toHaveBeenCalledTimes(1);
  });

  it('forceFallback jumps straight to bankruptcy without trying to sell/mortgage first', async () => {
    let state = liquidationState();
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [1] } } };
    await runBotStep('ROOM', state, 'p1', 'normal', true);
    expect(gameSync.declareBankruptcyAndSync).toHaveBeenCalledTimes(1);
    expect(gameSync.mortgagePropertyAndSync).not.toHaveBeenCalled();
    expect(gameSync.sellHouseAndSync).not.toHaveBeenCalled();
  });

  it('mortgages an owned property before giving up, when it has one and no houses', async () => {
    let state = liquidationState();
    state = { ...state, players: { ...state.players, p1: { ...state.players.p1, ownedTileIds: [1] } } };
    await runBotStep('ROOM', state, 'p1', 'normal', false);
    expect(gameSync.mortgagePropertyAndSync).toHaveBeenCalledTimes(1);
    expect(gameSync.declareBankruptcyAndSync).not.toHaveBeenCalled();
  });
});

describe('runBotStep - pieceChoice/endgameTarget queues', () => {
  it('picks a random still-available Piece from the queue', async () => {
    let state = createInitialGameState(PLAYERS);
    // A real Disappear retires the old Piece (see disappearPlayer) -
    // without that, getAvailablePieceIds only excludes Pieces held by
    // OTHER players, so p1's own still-current 'boot' would wrongly stay
    // pickable and this assertion would be flaky.
    state = { ...state, pendingPieceChoices: ['p1'], retiredPieceIds: ['boot'] };
    await runBotStep('ROOM', state, 'p1', 'easy', false);
    expect(gameSync.chooseNewPieceAndSync).toHaveBeenCalledTimes(1);
    const [, , , pieceId] = gameSync.chooseNewPieceAndSync.mock.calls[0];
    expect(pieceId).not.toBe('boot'); // retired - can never be picked again
  });

  it('a Normal/Hard bot targets the richest active opponent for its Endgame choice', async () => {
    const players = [
      { playerId: 'p1', pieceId: 'thimble' as const },
      { playerId: 'p2', pieceId: 'boot' as const },
      { playerId: 'p3', pieceId: 'battleship' as const },
    ];
    let state = createInitialGameState(players);
    state = devSetRoubles(state, 'p2', 100);
    state = devSetRoubles(state, 'p3', 900);
    state = {
      ...state,
      endgame: {
        finalLapRemaining: [],
        pendingTargetChoices: ['p1'],
        targetChoices: {},
        results: null,
        scoreBreakdowns: null,
      },
    };
    await runBotStep('ROOM', state, 'p1', 'hard', false);
    expect(gameSync.chooseEndgameTargetAndSync).toHaveBeenCalledWith('ROOM', state, 'p1', 'p3');
  });
});

describe('runBotStep - Show Trial voting', () => {
  it('casts a vote when an active Show Trial has not heard from this bot yet, even off-turn', async () => {
    let state = createInitialGameState(PLAYERS); // p1 is up, not bot-1
    state = {
      ...state,
      activeVote: { callerId: 'p1', targetPlayerId: 'p1', votes: {} },
    };
    await runBotStep('ROOM', state, 'bot-1', 'easy', false);
    expect(gameSync.castShowTrialVoteAndSync).toHaveBeenCalledTimes(1);
    const [, , votingId, vote] = gameSync.castShowTrialVoteAndSync.mock.calls[0];
    expect(votingId).toBe('bot-1');
    expect(['release', 'disappear']).toContain(vote);
  });

  it('does nothing once this bot has already voted', async () => {
    let state = createInitialGameState(PLAYERS);
    state = {
      ...state,
      activeVote: { callerId: 'p1', targetPlayerId: 'p1', votes: { 'bot-1': 'release' } },
    };
    await runBotStep('ROOM', state, 'bot-1', 'easy', false);
    expect(gameSync.castShowTrialVoteAndSync).not.toHaveBeenCalled();
  });
});

describe('gameProgressSignature', () => {
  it('changes when a roll actually lands, even once past a hypothetical log cap', () => {
    let state = createInitialGameState(PLAYERS);
    const before = gameProgressSignature(state);
    state = { ...state, lastRoll: [3, 4], log: Array(20).fill('padding') };
    const after = gameProgressSignature(state);
    expect(before).not.toBe(after);
  });

  it('is identical for two structurally-equal states, regardless of object identity', () => {
    // Same rng for both so the shuffled card piles come out identical too -
    // otherwise two freshly-created games would never match by chance.
    const a = createInitialGameState(PLAYERS, () => 0.5);
    const b = createInitialGameState(PLAYERS, () => 0.5);
    expect(gameProgressSignature(a)).toBe(gameProgressSignature(b));
  });
});

describe('botDecisionFingerprint', () => {
  it('changes between rolling and ending the turn', () => {
    let state = createInitialGameState(PLAYERS);
    const rollFingerprint = botDecisionFingerprint(state, 'p1');
    state = { ...state, lastRoll: [1, 2], lastRollWasDoubles: false };
    const endTurnFingerprint = botDecisionFingerprint(state, 'p1');
    expect(rollFingerprint).not.toBe(endTurnFingerprint);
  });

  it('reports idle for a bot with nothing to do', () => {
    const state = createInitialGameState(PLAYERS); // bot-1 isn't up
    expect(botDecisionFingerprint(state, 'bot-1')).toBe('idle');
  });
});
