import { useEffect, useRef } from 'react';
import { COMMUNIST_TEST_CARDS } from '../data/cards';
import type { CardDeck, GameState } from '../types/game';

const DECK_SELECTOR: Record<CardDeck, string> = {
  communistTest: '.board-center-deck-communist',
  noChance: '.board-center-deck-nochance',
};

/**
 * Watches game.pendingDecision for a fresh 'cardDrawn' and reports the
 * matching deck pile's on-screen position, so GameBoard can fly a card
 * from there to the reveal panel. Driven by the synced GameState (not a
 * DOM click event, the previous approach) specifically so this fires
 * for every viewer watching a draw, not just whoever clicked the pile -
 * a plain onClick handler only ever runs on the clicker's own browser.
 * Reads the pile's position by class name rather than needing a ref
 * threaded down from Board, since which pile matters is determined by
 * the drawn card's own deck, not by anything Board.tsx knows locally.
 */
export function useCardFlight(
  game: GameState | undefined,
  targetEl: HTMLElement | null,
  onFlight: (deck: CardDeck, from: DOMRect, to: DOMRect) => void,
) {
  const seenCardIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!game || game.pendingDecision?.type !== 'cardDrawn') return;
    const cardId = game.pendingDecision.cardId;
    if (seenCardIdRef.current === cardId) return;
    seenCardIdRef.current = cardId;

    const deck: CardDeck = COMMUNIST_TEST_CARDS.some((card) => card.id === cardId) ? 'communistTest' : 'noChance';
    const pileEl = document.querySelector(DECK_SELECTOR[deck]);
    if (!pileEl || !targetEl) return;

    onFlight(deck, pileEl.getBoundingClientRect(), targetEl.getBoundingClientRect());
  }, [game, targetEl, onFlight]);
}
