import type { CSSProperties } from 'react';
import { findCard } from '../data/cards';
import { chooseCardAndSync } from '../lib/gameSync';
import type { CardDeck, GameState } from '../types/game';
import './CardChoicePrompt.css';

interface CardChoicePromptProps {
  deck: CardDeck;
  roomCode: string;
  game: GameState;
}

// Car's power ("choose a card when landing on Communist Test") and
// Dog's ("...on No Chance") both land here: instead of drawing blind,
// the player picks any card still in that deck's draw pile - laid out
// as a clickable fanned hand rather than a dropdown, so it feels like
// actually being dealt a hand to choose from.
function CardChoicePrompt({ deck, roomCode, game }: CardChoicePromptProps) {
  const pileKey = deck === 'communistTest' ? 'communistTestDrawPile' : 'noChanceDrawPile';
  const availableCardIds = game[pileKey];

  return (
    <div className="purchase-prompt card-prompt card-choice-prompt">
      <p className="card-title">Choose a card ({deck === 'communistTest' ? 'Communist Test' : 'No Chance'})</p>
      <div className="card-choice-fan">
        {availableCardIds.map((cardId, index) => {
          const card = findCard(cardId);
          const spread = availableCardIds.length > 1 ? -1 + (2 * index) / (availableCardIds.length - 1) : 0;
          return (
            <button
              key={cardId}
              type="button"
              className="card-choice-card"
              style={{ '--tilt': `${spread * 8}deg`, '--lift': `${Math.abs(spread) * 6}px` } as CSSProperties}
              onClick={() => chooseCardAndSync(roomCode, game, cardId)}
              title={card.text}
            >
              {card.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CardChoicePrompt;
