import { getTile } from '../data/board';
import { NKVD_QUESTIONS } from '../data/nkvdQuestions';
import type { ColorGroup, GamePlayerState, GameState } from '../types/game';
import {
  acceptVolgaOfferAndSync,
  acknowledgeCardAndSync,
  answerNkvdQuizAndSync,
  buildHouseAndSync,
  buyPropertyAndSync,
  castShowTrialVoteAndSync,
  chooseCardAndSync,
  chooseEndgameTargetAndSync,
  chooseNewPieceAndSync,
  confirmLiquidationPaymentAndSync,
  declareBankruptcyAndSync,
  declineVolgaOfferAndSync,
  drawFromPileAndSync,
  endTurnAndSync,
  mortgagePropertyAndSync,
  resolveCardTargetAndSync,
  resolveCatRedirectAndSync,
  resolveSmuggleOfferAndSync,
  rollCardDieAndSync,
  rollDiceAndSync,
  sellHouseAndSync,
  skipPurchaseAndSync,
} from './gameSync';
import { getAvailablePieceIds } from '../game/engine';

export type BotDifficulty = 'easy' | 'normal' | 'hard';

function randomPick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function activeOpponents(game: GameState, botId: string): string[] {
  return game.turnOrder.filter((id) => id !== botId && !game.players[id].isSpectating);
}

function richestPlayerId(game: GameState, candidates: string[]): string {
  return candidates.reduce((richest, id) =>
    game.players[id].roubles > game.players[richest].roubles ? id : richest,
  );
}

function opponentOwnedTileIds(game: GameState, botId: string): number[] {
  return Object.entries(game.players)
    .filter(([id]) => id !== botId)
    .flatMap(([, player]) =>
      player.ownedTileIds.filter((tileId) => {
        const tile = getTile(tileId);
        return tile.kind === 'property' || tile.kind === 'railroad';
      }),
    );
}

function mostValuableTileId(tileIds: number[]): number {
  return tileIds.reduce((best, id) => {
    const tile = getTile(id);
    const bestTile = getTile(best);
    const price = tile.kind === 'property' || tile.kind === 'railroad' ? tile.price : 0;
    const bestPrice = bestTile.kind === 'property' || bestTile.kind === 'railroad' ? bestTile.price : 0;
    return price > bestPrice ? id : best;
  });
}

function anyPropertyTileIds(): number[] {
  return Array.from({ length: 40 }, (_, id) => id).filter((id) => {
    const tile = getTile(id);
    return tile.kind === 'property' || tile.kind === 'railroad';
  });
}

function shouldBuy(difficulty: BotDifficulty, roubles: number, price: number): boolean {
  if (roubles < price) return false;
  if (difficulty === 'easy') return Math.random() < 0.5;
  const buffer = difficulty === 'hard' ? 50 : 150;
  return roubles - price >= buffer;
}

function shouldTakeVolga(difficulty: BotDifficulty, player: GamePlayerState): boolean {
  if (difficulty === 'easy') return Math.random() < 0.5;
  // Giving away every property to claim a forced-ownership utility is
  // only a good deal when there's nothing to lose - otherwise decline.
  return player.ownedTileIds.length === 0;
}

function smuggleAmount(difficulty: BotDifficulty, maxAmount: number): number {
  if (difficulty === 'easy') return Math.floor(Math.random() * (maxAmount + 1));
  return Math.floor(maxAmount * 0.7);
}

function ownsFullColorGroup(game: GameState, playerId: string, group: ColorGroup): boolean {
  for (let id = 0; id < 40; id++) {
    const tile = getTile(id);
    if (tile.kind === 'property' && tile.colorGroup === group && !game.players[playerId].ownedTileIds.includes(id)) {
      return false;
    }
  }
  return true;
}

function colorGroupHasHouses(game: GameState, group: ColorGroup): boolean {
  for (let id = 0; id < 40; id++) {
    const tile = getTile(id);
    if (tile.kind === 'property' && tile.colorGroup === group && (game.propertyHouses[id] ?? 0) > 0) {
      return true;
    }
  }
  return false;
}

/** Normal/Hard only (see Easy's "no proactive house-building" scope boundary) - the first affordable house build on a fully-owned, unmortgaged group, or null if nothing qualifies right now. One build per call, same as a human clicking the button once. */
function pickHouseToBuild(game: GameState, botId: string, difficulty: BotDifficulty): number | null {
  const player = game.players[botId];
  const buffer = difficulty === 'hard' ? 50 : 200;
  for (const tileId of player.ownedTileIds) {
    const tile = getTile(tileId);
    if (tile.kind !== 'property') continue;
    if (game.mortgagedTileIds.includes(tileId)) continue;
    const current = game.propertyHouses[tileId] ?? 0;
    if (current >= 5) continue;
    if (player.roubles - tile.houseCost < buffer) continue;
    if (!ownsFullColorGroup(game, botId, tile.colorGroup)) continue;
    return tileId;
  }
  return null;
}

async function resolveLiquidation(
  roomCode: string,
  game: GameState,
  botId: string,
  amountOwed: number,
  forceFallback: boolean,
): Promise<void> {
  if (forceFallback) {
    await declareBankruptcyAndSync(roomCode, game);
    return;
  }

  const player = game.players[botId];
  if (player.roubles >= amountOwed) {
    await confirmLiquidationPaymentAndSync(roomCode, game);
    return;
  }

  // Real Monopoly liquidation order: sell houses in a group before
  // mortgaging anything in it (mortgageProperty itself refuses otherwise).
  const withHouse = player.ownedTileIds.find((id) => (game.propertyHouses[id] ?? 0) > 0);
  if (withHouse !== undefined) {
    await sellHouseAndSync(roomCode, game, botId, withHouse);
    return;
  }

  const mortgageable = player.ownedTileIds.find((id) => {
    const tile = getTile(id);
    if (tile.kind !== 'property' && tile.kind !== 'railroad') return false;
    if (game.mortgagedTileIds.includes(id)) return false;
    return tile.kind !== 'property' || !colorGroupHasHouses(game, tile.colorGroup);
  });
  if (mortgageable !== undefined) {
    await mortgagePropertyAndSync(roomCode, game, botId, mortgageable);
    return;
  }

  await declareBankruptcyAndSync(roomCode, game);
}

/**
 * Runs one bot decision and writes it to Firestore - called by
 * useBotDriver, host-only, on a "thinking delay" timer per tick. Always
 * takes exactly one action per call, same granularity as a human clicking
 * one button, so the UI can visibly show a bot's turn unfolding rather
 * than resolving it all at once.
 *
 * `forceFallback`, set by the caller's stuck-action safety net when the
 * previous tick's attempt against this exact decision didn't change
 * game.log.length (a no-op write - a mismatched guard here versus
 * engine.ts), skips every heuristic and takes the one response that's
 * always guaranteed to actually resolve the decision.
 */
export async function runBotStep(
  roomCode: string,
  game: GameState,
  botId: string,
  difficulty: BotDifficulty,
  forceFallback: boolean,
): Promise<void> {
  const player = game.players[botId];
  if (!player) return;

  if (game.pendingPieceChoices.includes(botId)) {
    const options = getAvailablePieceIds(game, botId);
    if (options.length === 0) return;
    await chooseNewPieceAndSync(roomCode, game, botId, randomPick(options));
    return;
  }

  if (game.endgame?.pendingTargetChoices.includes(botId)) {
    const candidates = activeOpponents(game, botId);
    if (candidates.length === 0) return;
    const target = difficulty === 'easy' ? randomPick(candidates) : richestPlayerId(game, candidates);
    await chooseEndgameTargetAndSync(roomCode, game, botId, target);
    return;
  }

  // A Show Trial vote isn't turn- or decision-gated - anyone can vote
  // anytime - but it also doesn't resolve until EVERY active player has,
  // so a bot that never votes leaves it stuck forever. Checked before
  // the turn/decision logic below since it can happen regardless of
  // whose turn it actually is.
  if (game.activeVote && !(botId in game.activeVote.votes)) {
    const vote: 'release' | 'disappear' = Math.random() < 0.5 ? 'release' : 'disappear';
    await castShowTrialVoteAndSync(roomCode, game, botId, vote);
    return;
  }

  const decision = game.pendingDecision;
  const isBotTurn = game.turnOrder[game.currentTurnIndex] === botId;

  if (decision) {
    const decisionIsForBot =
      'forPlayerId' in decision ? decision.forPlayerId === botId : isBotTurn;
    if (!decisionIsForBot) return;

    switch (decision.type) {
      case 'purchase': {
        if (forceFallback) {
          await skipPurchaseAndSync(roomCode, game);
          return;
        }
        const tile = getTile(decision.tileId);
        if (tile.kind !== 'property' && tile.kind !== 'railroad') {
          await skipPurchaseAndSync(roomCode, game);
          return;
        }
        const price =
          tile.kind === 'railroad' && player.pieceId === 'battleship' ? Math.floor(tile.price / 2) : tile.price;
        if (shouldBuy(difficulty, player.roubles, price)) {
          await buyPropertyAndSync(roomCode, game);
        } else {
          await skipPurchaseAndSync(roomCode, game);
        }
        return;
      }

      case 'volgaOffer': {
        if (forceFallback) {
          await declineVolgaOfferAndSync(roomCode, game);
          return;
        }
        if (shouldTakeVolga(difficulty, player)) {
          await acceptVolgaOfferAndSync(roomCode, game);
        } else {
          await declineVolgaOfferAndSync(roomCode, game);
        }
        return;
      }

      case 'awaitingCardDraw':
        await drawFromPileAndSync(roomCode, game);
        return;

      case 'cardChoice': {
        const pile = decision.deck === 'communistTest' ? game.communistTestDrawPile : game.noChanceDrawPile;
        if (pile.length === 0) return;
        await chooseCardAndSync(roomCode, game, randomPick(pile));
        return;
      }

      case 'catRedirect':
        // Always kept, never handed off - proposing/negotiating handoffs
        // to a specific opponent is out of scope, same as trading.
        await resolveCatRedirectAndSync(roomCode, game, null);
        return;

      case 'cardTarget': {
        if (decision.cardId === 'doubleAgent') {
          const candidates = activeOpponents(game, botId);
          if (candidates.length === 0) {
            await resolveCardTargetAndSync(roomCode, game, {});
            return;
          }
          await resolveCardTargetAndSync(roomCode, game, { targetPlayerId: randomPick(candidates) });
          return;
        }
        if (decision.cardId === 'siegeOfStalingrad') {
          const options = opponentOwnedTileIds(game, botId);
          if (options.length === 0) {
            await resolveCardTargetAndSync(roomCode, game, {});
            return;
          }
          const tileId = difficulty === 'easy' ? randomPick(options) : mostValuableTileId(options);
          await resolveCardTargetAndSync(roomCode, game, { targetTileId: tileId });
          return;
        }
        // phoneCallFromStalin: any tile, free either way.
        const options = anyPropertyTileIds();
        const tileId = difficulty === 'easy' ? randomPick(options) : mostValuableTileId(options);
        await resolveCardTargetAndSync(roomCode, game, { targetTileId: tileId });
        return;
      }

      case 'cardDiceRoll':
        await rollCardDieAndSync(roomCode, game);
        return;

      case 'nkvdQuiz': {
        // Always random regardless of difficulty - there's no way for a
        // bot to "know" real-world trivia.
        const question = NKVD_QUESTIONS[decision.questionIndex];
        await answerNkvdQuizAndSync(roomCode, game, randomPick([question.answer, ...question.distractors]));
        return;
      }

      case 'cardDrawn':
        await acknowledgeCardAndSync(roomCode, game);
        return;

      case 'smuggleOffer': {
        if (forceFallback) {
          await resolveSmuggleOfferAndSync(roomCode, game, 0);
          return;
        }
        await resolveSmuggleOfferAndSync(roomCode, game, smuggleAmount(difficulty, decision.maxAmount));
        return;
      }

      case 'liquidationChoice':
        await resolveLiquidation(roomCode, game, botId, decision.amountOwed, forceFallback);
        return;
    }
    return;
  }

  if (!isBotTurn) return;

  if (!game.lastRoll || game.lastRollWasDoubles) {
    await rollDiceAndSync(roomCode, game);
    return;
  }

  if (!forceFallback && difficulty !== 'easy') {
    const houseTileId = pickHouseToBuild(game, botId, difficulty);
    if (houseTileId !== null) {
      await buildHouseAndSync(roomCode, game, botId, houseTileId);
      return;
    }
  }

  await endTurnAndSync(roomCode, game);
}

/** A fingerprint for "what runBotStep is about to attempt" - used by useBotDriver's stuck-action safety net alongside gameProgressSignature to detect a repeat attempt against unchanged state (a no-op write) and force a fallback next time. Doesn't need to be exhaustive per-option, just fine-grained enough that a genuinely different situation gets a different fingerprint. */
export function botDecisionFingerprint(game: GameState, botId: string): string {
  if (game.pendingPieceChoices.includes(botId)) return 'pieceChoice';
  if (game.endgame?.pendingTargetChoices.includes(botId)) return 'endgameTarget';
  if (game.activeVote && !(botId in game.activeVote.votes)) return 'showTrialVote';
  if (game.pendingDecision) return game.pendingDecision.type;
  if (game.turnOrder[game.currentTurnIndex] === botId) {
    return !game.lastRoll || game.lastRollWasDoubles ? 'roll' : 'endTurn';
  }
  return 'idle';
}

/**
 * A signature of every part of GameState that a bot's decision could
 * possibly change - used by useBotDriver both to know when to re-check
 * what a bot should do next, and (paired with botDecisionFingerprint) to
 * detect a genuine no-op write. Deliberately does NOT use game.log for
 * either purpose: logEvent caps the log at its last 20 entries
 * (game/engine.ts), so in any game past its first ~20 events, log.length
 * stops changing at all - relying on it here would silently stop
 * re-triggering the bot driver entirely partway through a normal game.
 */
export function gameProgressSignature(game: GameState): string {
  return JSON.stringify(game);
}
