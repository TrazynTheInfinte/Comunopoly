import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { LENIN_PIECE_IDS, STARTING_PIECES } from '../data/pieces';
import { pickAvailablePiece } from './rooms';
import type { CardDeck, GameState, PieceId } from '../types/game';
import type { Room, RulesetMode } from '../types/room';
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
  mortgageProperty,
  proposeTrade,
  rejoinFromAfk,
  resolveCardTarget,
  resolveCatRedirect,
  resolveRubberDuckEncounter,
  resolveSmuggleOffer,
  rollCardDie,
  rollDice,
  sellHouse,
  skipPurchase,
  unmortgageProperty,
  useDenounceCollaborators,
  useSecretInformant,
  withdrawTrade,
} from '../game/engine';

// Every function here follows the same shape: take the game state this
// client already has (from its live Firestore subscription), run it
// through a pure function from game/engine.ts, and write the result back.
// This is the "client-authoritative" trust model from
// docs/adr/0001-client-authoritative-sync.md - there's no server checking
// these writes are legal moves.
async function writeGameState(roomCode: string, game: GameState) {
  await updateDoc(doc(db, 'rooms', roomCode), { game });
}

export async function startGame(
  roomCode: string,
  playerAssignments: { playerId: string; pieceId: PieceId }[],
  carryWestOnDisappear: boolean = false,
  rulesetMode: RulesetMode = 'stalin',
) {
  await writeGameState(
    roomCode,
    createInitialGameState(playerAssignments, Math.random, carryWestOnDisappear, rulesetMode),
  );
}

/**
 * The nuclear option for a Comrade Stalin: wipes the room's `game`
 * field entirely (Room.game is optional - "absent while the room is
 * still in its lobby" - so this is the same as the room never having
 * started one), dropping everyone straight back to the Lobby for every
 * connected client at once via their live subscription. For a game
 * that's gotten stuck in a way even kicking a player and force-skipping
 * a turn can't recover from. Players keep their existing seats/Piece
 * assignments in room.players, so the host can just hit Start Game
 * again immediately rather than everyone re-joining from scratch.
 */
export async function endGameEntirely(roomCode: string) {
  await updateDoc(doc(db, 'rooms', roomCode), { game: deleteField() });
}

/**
 * Starts a fresh match with everyone currently in the room, skipping
 * the Lobby entirely - offered on the Endgame results screen so a
 * rematch doesn't mean re-picking Pieces one at a time. Always assigns
 * random Pieces the way "experienced" mode does (and sets the room's
 * mode to match, so it stays consistent if the host ever goes back to
 * a normal Lobby afterward) - everyone here has already played a full
 * game, so there's no reason to make them pick blind again.
 */
export async function startNewMatch(roomCode: string, room: Room) {
  // Lenin mode's Pool is a curated subset (LENIN_PIECE_IDS), smaller
  // than the full 12 - cap how many players get an assignment to
  // whichever Pool actually applies, not always the full roster's size.
  const allowedPieceIds = room.rulesetMode === 'lenin' ? LENIN_PIECE_IDS : undefined;
  const poolSize = allowedPieceIds?.length ?? STARTING_PIECES.length;
  const claimed: PieceId[] = [];
  const assignments: { playerId: string; pieceId: PieceId }[] = [];
  for (const playerId of Object.keys(room.players).slice(0, poolSize)) {
    const pieceId = pickAvailablePiece(claimed, allowedPieceIds);
    if (!pieceId) break; // more players than Pieces exist - shouldn't happen, but don't crash if it does
    claimed.push(pieceId);
    assignments.push({ playerId, pieceId });
  }
  await updateDoc(doc(db, 'rooms', roomCode), {
    mode: 'experienced',
    game: createInitialGameState(
      assignments,
      Math.random,
      room.carryWestOnDisappear ?? false,
      room.rulesetMode,
    ),
  });
}

export async function rollDiceAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, rollDice(game));
}

/** Rolls the die a pending cardDiceRoll decision (Bestseller!, Phone Call from Stalin) is waiting on. */
export async function rollCardDieAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, rollCardDie(game));
}

export async function buyPropertyAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, buyProperty(game));
}

export async function skipPurchaseAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, skipPurchase(game));
}

export async function endTurnAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, endTurn(game));
}

export async function acceptVolgaOfferAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, acceptVolgaOffer(game));
}

export async function declineVolgaOfferAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, declineVolgaOffer(game));
}

export async function acknowledgeCardAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, acknowledgeCard(game));
}

export async function chooseCardAndSync(roomCode: string, game: GameState, cardId: string) {
  await writeGameState(roomCode, chooseCard(game, cardId));
}

export async function drawFromPileAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, drawFromPile(game));
}

export async function resolveCardTargetAndSync(
  roomCode: string,
  game: GameState,
  selection: { targetPlayerId?: string; targetTileId?: number },
) {
  await writeGameState(roomCode, resolveCardTarget(game, selection));
}

export async function accuseOfTrotskyAndSync(roomCode: string, game: GameState, accusedId: string) {
  await writeGameState(roomCode, accuseOfTrotsky(game, accusedId));
}

export async function answerNkvdQuizAndSync(roomCode: string, game: GameState, answerText: string) {
  await writeGameState(roomCode, answerNkvdQuiz(game, answerText));
}

export async function useDenounceCollaboratorsAndSync(
  roomCode: string,
  game: GameState,
  playerId: string,
  targetPlayerId: string,
) {
  await writeGameState(roomCode, useDenounceCollaborators(game, playerId, targetPlayerId));
}

export async function useSecretInformantAndSync(
  roomCode: string,
  game: GameState,
  playerId: string,
  targetPlayerId: string,
) {
  await writeGameState(roomCode, useSecretInformant(game, playerId, targetPlayerId));
}

export async function callShowTrialAndSync(
  roomCode: string,
  game: GameState,
  playerId: string,
  targetPlayerId: string,
) {
  await writeGameState(roomCode, callShowTrial(game, playerId, targetPlayerId));
}

export async function castShowTrialVoteAndSync(
  roomCode: string,
  game: GameState,
  playerId: string,
  vote: 'release' | 'disappear',
) {
  await writeGameState(roomCode, castShowTrialVote(game, playerId, vote));
}

export async function devSetRoublesAndSync(
  roomCode: string,
  game: GameState,
  playerId: string,
  roubles: number,
) {
  await writeGameState(roomCode, devSetRoubles(game, playerId, roubles));
}

export async function devSetForcedRollAndSync(
  roomCode: string,
  game: GameState,
  roll: [number, number] | null,
) {
  await writeGameState(roomCode, devSetForcedRoll(game, roll));
}

export async function devSetForcedCardAndSync(
  roomCode: string,
  game: GameState,
  cardId: string | null,
) {
  await writeGameState(roomCode, devSetForcedCard(game, cardId));
}

export async function devJumpToTileAndSync(
  roomCode: string,
  game: GameState,
  tileId: number,
) {
  await writeGameState(roomCode, devJumpToTile(game, tileId));
}

export async function resolveCatRedirectAndSync(
  roomCode: string,
  game: GameState,
  targetPlayerId: string | null,
) {
  await writeGameState(roomCode, resolveCatRedirect(game, targetPlayerId));
}

export async function resolveRubberDuckEncounterAndSync(
  roomCode: string,
  game: GameState,
  sendToJailChoice: boolean,
) {
  await writeGameState(roomCode, resolveRubberDuckEncounter(game, sendToJailChoice));
}

export async function buildHouseAndSync(
  roomCode: string,
  game: GameState,
  playerId: string,
  tileId: number,
) {
  await writeGameState(roomCode, buildHouse(game, playerId, tileId));
}

export async function sellHouseAndSync(
  roomCode: string,
  game: GameState,
  playerId: string,
  tileId: number,
) {
  await writeGameState(roomCode, sellHouse(game, playerId, tileId));
}

export async function mortgagePropertyAndSync(
  roomCode: string,
  game: GameState,
  playerId: string,
  tileId: number,
) {
  await writeGameState(roomCode, mortgageProperty(game, playerId, tileId));
}

export async function unmortgagePropertyAndSync(
  roomCode: string,
  game: GameState,
  playerId: string,
  tileId: number,
) {
  await writeGameState(roomCode, unmortgageProperty(game, playerId, tileId));
}

/** Lenin mode: pays off a pending liquidationChoice's jail bribe, if selling/mortgaging (sellHouseAndSync/mortgagePropertyAndSync above) has raised enough since it opened. */
export async function confirmLiquidationPaymentAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, confirmLiquidationPayment(game));
}

/** Lenin mode: gives up on a pending liquidationChoice rather than keep selling/mortgaging - real bankruptcy. */
export async function declareBankruptcyAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, declareBankruptcy(game));
}

// --- Trading (both modes) --------------------------------------------------

export async function proposeTradeAndSync(
  roomCode: string,
  game: GameState,
  fromPlayerId: string,
  toPlayerId: string,
  offer: { tileIds: number[]; roubles: number; cardIds: string[] },
  request: { tileIds: number[]; roubles: number; cardIds: string[] },
) {
  await writeGameState(
    roomCode,
    proposeTrade(game, crypto.randomUUID(), fromPlayerId, toPlayerId, offer, request),
  );
}

export async function acceptTradeAndSync(roomCode: string, game: GameState, tradeId: string) {
  await writeGameState(roomCode, acceptTrade(game, tradeId));
}

export async function declineTradeAndSync(roomCode: string, game: GameState, tradeId: string) {
  await writeGameState(roomCode, declineTrade(game, tradeId));
}

export async function withdrawTradeAndSync(roomCode: string, game: GameState, tradeId: string) {
  await writeGameState(roomCode, withdrawTrade(game, tradeId));
}

export async function resolveSmuggleOfferAndSync(roomCode: string, game: GameState, amount: number) {
  await writeGameState(roomCode, resolveSmuggleOffer(game, amount));
}

export async function chooseNewPieceAndSync(
  roomCode: string,
  game: GameState,
  playerId: string,
  pieceId: PieceId,
) {
  await writeGameState(roomCode, chooseNewPiece(game, playerId, pieceId));
}

export async function chooseEndgameTargetAndSync(
  roomCode: string,
  game: GameState,
  playerId: string,
  targetPlayerId: string,
) {
  await writeGameState(roomCode, chooseEndgameTarget(game, playerId, targetPlayerId));
}

export async function devForceDisappearAndSync(roomCode: string, game: GameState, playerId: string) {
  await writeGameState(roomCode, devForceDisappear(game, playerId));
}

export async function devForceEndgameAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, devForceEndgame(game));
}

export async function devDrawCardAndSync(
  roomCode: string,
  game: GameState,
  deck: CardDeck,
) {
  await writeGameState(roomCode, devDrawCard(game, deck));
}

export async function devForceSkipTurnAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, devForceSkipTurn(game));
}

export async function devKickPlayerAndSync(roomCode: string, game: GameState, playerId: string) {
  await writeGameState(roomCode, devKickPlayer(game, playerId));
}

export async function devForceAutoPickPieceAndSync(
  roomCode: string,
  game: GameState,
  playerId: string,
) {
  await writeGameState(roomCode, devForceAutoPickPiece(game, playerId));
}

export async function afkSkipTurnAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, afkSkipTurn(game));
}

export async function confirmStillHereAndSync(roomCode: string, game: GameState, playerId: string) {
  await writeGameState(roomCode, confirmStillHere(game, playerId));
}

export async function rejoinFromAfkAndSync(roomCode: string, game: GameState, playerId: string) {
  await writeGameState(roomCode, rejoinFromAfk(game, playerId));
}
