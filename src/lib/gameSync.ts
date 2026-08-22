import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { CardDeck, GameState, PieceId } from '../types/game';
import {
  acceptVolgaOffer,
  accuseOfTrotsky,
  acknowledgeCard,
  answerNkvdQuiz,
  buildHouse,
  buyProperty,
  callShowTrial,
  castShowTrialVote,
  chooseCard,
  chooseEndgameTarget,
  chooseNewPiece,
  createInitialGameState,
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
) {
  await writeGameState(roomCode, createInitialGameState(playerAssignments));
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

export async function rollDiceAndSync(roomCode: string, game: GameState) {
  await writeGameState(roomCode, rollDice(game));
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
