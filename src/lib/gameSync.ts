import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { GameState, PieceId } from '../types/game';
import {
  acceptVolgaOffer,
  buyProperty,
  createInitialGameState,
  declineVolgaOffer,
  devSetForcedRoll,
  devSetRoubles,
  endTurn,
  rollDice,
  skipPurchase,
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
