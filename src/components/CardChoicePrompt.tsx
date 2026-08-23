import type { CSSProperties } from 'react';
import { findCard } from '../data/cards';
import { chooseCardAndSync } from '../lib/gameSync';
import type { CardDeck, GameState } from '../types/game';
import './CardChoicePrompt.css';

interface CardChoicePromptProps {
  deck: CardDeck;
  roomCode: string;
  game: GameState;
  /** Whether the current viewer is the one actually choosing (Car/Dog's own power) - everyone else still sees this modal (so it's clear something's happening, not a silent pause), just with the cards face-down and unclickable, since seeing the real titles would hand them the same look-ahead advantage the Piece's power is supposed to be exclusive to. */
  isMine: boolean;
  /** The chooser's display name, shown to everyone else while they wait. */
  chooserName?: string;
}

// Car's power ("choose a card when landing on Communist Test") and
// Dog's ("...on No Chance") both land here: instead of drawing blind,
// the player picks any card still in that deck's draw pile - laid out
// as a clickable fanned hand rather than a dropdown, so it feels like
// actually being dealt a hand to choose from.
function CardChoicePrompt({ deck, roomCode, game, isMine, chooserName }: CardChoicePromptProps) {
  const pileKey = deck === 'communistTest' ? 'communistTestDrawPile' : 'noChanceDrawPile';
  const availableCardIds = game[pileKey];
  const deckLabel = deck === 'communistTest' ? 'Communist Test' : 'No Chance';

  return (
    <div className="purchase-prompt card-prompt card-choice-prompt">
      <p className="card-title">
        {isMine ? `Choose a card (${deckLabel})` : `${chooserName ?? 'Someone'} is choosing a card (${deckLabel})`}
      </p>
      <div className="card-choice-fan">
        {availableCardIds.map((cardId, index) => {
          const card = isMine ? findCard(cardId) : null;
          const spread = availableCardIds.length > 1 ? -1 + (2 * index) / (availableCardIds.length - 1) : 0;
          const style = { '--tilt': `${spread * 8}deg`, '--lift': `${Math.abs(spread) * 6}px` } as CSSProperties;
          if (!card) {
            return <span key={cardId} className="card-choice-card card-choice-card-back" style={style} />;
          }
          return (
            <button
              key={cardId}
              type="button"
              className="card-choice-card"
              style={style}
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
