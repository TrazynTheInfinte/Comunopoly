import { useState } from 'react';
import { findCard } from '../data/cards';
import { chooseCardAndSync } from '../lib/gameSync';
import type { CardDeck, GameState } from '../types/game';

interface CardChoicePromptProps {
  deck: CardDeck;
  roomCode: string;
  game: GameState;
}

// Car's power ("choose a card when landing on Communist Test") and
// Dog's ("...on No Chance") both land here: instead of drawing blind,
// the player picks any card still in that deck's draw pile.
function CardChoicePrompt({ deck, roomCode, game }: CardChoicePromptProps) {
  const pileKey = deck === 'communistTest' ? 'communistTestDrawPile' : 'noChanceDrawPile';
  const availableCardIds = game[pileKey];
  const [selectedCardId, setSelectedCardId] = useState(availableCardIds[0] ?? '');

  return (
    <div className="purchase-prompt card-prompt">
      <p className="card-title">Choose a card ({deck === 'communistTest' ? 'Communist Test' : 'No Chance'})</p>
      <select value={selectedCardId} onChange={(event) => setSelectedCardId(event.target.value)}>
        {availableCardIds.map((cardId) => (
          <option key={cardId} value={cardId}>
            {findCard(cardId).title}
          </option>
        ))}
      </select>
      <button
        onClick={() => chooseCardAndSync(roomCode, game, selectedCardId)}
        disabled={!selectedCardId}
      >
        Take It
      </button>
    </div>
  );
}

export default CardChoicePrompt;
