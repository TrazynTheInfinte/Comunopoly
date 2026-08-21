import { useState } from 'react';
import { findCard } from '../data/cards';
import { resolveCatRedirectAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';

interface CatRedirectPromptProps {
  cardId: string;
  room: Room;
  roomCode: string;
  playerId: string;
  game: GameState;
}

// Cat's Special Power: after reading a drawn card, choose to keep it
// (effects apply to Cat) or hand its whole effect to another player
// instead (including any follow-up target-selection/quiz it opens).
function CatRedirectPrompt({ cardId, room, roomCode, playerId, game }: CatRedirectPromptProps) {
  const card = findCard(cardId);
  const otherPlayers = game.turnOrder.filter((id) => id !== playerId);
  const [selectedPlayerId, setSelectedPlayerId] = useState(otherPlayers[0] ?? '');

  return (
    <div className="purchase-prompt card-prompt">
      <p className="card-title">{card.title}</p>
      <p>{card.text}</p>
      <p className="hint">Keep this card, or hand its effects to someone else?</p>

      <button onClick={() => resolveCatRedirectAndSync(roomCode, game, null)}>Keep</button>

      {otherPlayers.length > 0 && (
        <>
          <select value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.target.value)}>
            {otherPlayers.map((id) => (
              <option key={id} value={id}>
                {room.players[id]?.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => resolveCatRedirectAndSync(roomCode, game, selectedPlayerId)}
            disabled={!selectedPlayerId}
          >
            Give To Them
          </button>
        </>
      )}
    </div>
  );
}

export default CatRedirectPrompt;
