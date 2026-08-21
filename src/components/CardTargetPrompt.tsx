import { useState } from 'react';
import { getTile } from '../data/board';
import { findCard } from '../data/cards';
import { resolveCardTargetAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';

interface CardTargetPromptProps {
  cardId: string;
  room: Room;
  roomCode: string;
  playerId: string;
  game: GameState;
}

// Shown while a drawn card (Siege of Stalingrad, Double Agent, Phone
// Call from Stalin) is waiting on a target before it can resolve - see
// the cardTarget pending decision in game/engine.ts.
function CardTargetPrompt({ cardId, room, roomCode, playerId, game }: CardTargetPromptProps) {
  const card = findCard(cardId);
  const otherPlayers = game.turnOrder.filter((id) => id !== playerId);

  const opponentTileOptions = Object.entries(game.players)
    .filter(([id]) => id !== playerId)
    .flatMap(([ownerId, player]) =>
      player.ownedTileIds
        .filter((tileId) => {
          const tile = getTile(tileId);
          return tile.kind === 'property' || tile.kind === 'railroad';
        })
        .map((tileId) => ({ tileId, ownerId })),
    );

  const anyPropertyOptions = Array.from({ length: 40 }, (_, id) => getTile(id)).filter(
    (tile) => tile.kind === 'property' || tile.kind === 'railroad',
  );

  const [selectedTileId, setSelectedTileId] = useState<number | null>(
    cardId === 'siegeOfStalingrad'
      ? (opponentTileOptions[0]?.tileId ?? null)
      : (anyPropertyOptions[0]?.id ?? null),
  );
  const [selectedPlayerId, setSelectedPlayerId] = useState(otherPlayers[0] ?? '');

  async function handleConfirm() {
    if (cardId === 'doubleAgent') {
      await resolveCardTargetAndSync(roomCode, game, { targetPlayerId: selectedPlayerId });
    } else if (selectedTileId !== null) {
      await resolveCardTargetAndSync(roomCode, game, { targetTileId: selectedTileId });
    }
  }

  return (
    <div className="purchase-prompt card-prompt">
      <p className="card-title">{card.title}</p>
      <p>{card.text}</p>

      {cardId === 'siegeOfStalingrad' &&
        (opponentTileOptions.length === 0 ? (
          <p className="hint">No opponent properties to seize.</p>
        ) : (
          <select
            value={selectedTileId ?? ''}
            onChange={(event) => setSelectedTileId(Number(event.target.value))}
          >
            {opponentTileOptions.map(({ tileId, ownerId }) => (
              <option key={tileId} value={tileId}>
                {getTile(tileId).name} ({room.players[ownerId]?.name})
              </option>
            ))}
          </select>
        ))}

      {cardId === 'phoneCallFromStalin' && (
        <select
          value={selectedTileId ?? ''}
          onChange={(event) => setSelectedTileId(Number(event.target.value))}
        >
          {anyPropertyOptions.map((tile) => (
            <option key={tile.id} value={tile.id}>
              {tile.name}
            </option>
          ))}
        </select>
      )}

      {cardId === 'doubleAgent' && (
        <select value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.target.value)}>
          {otherPlayers.map((id) => (
            <option key={id} value={id}>
              {room.players[id]?.name}
            </option>
          ))}
        </select>
      )}

      <button onClick={handleConfirm}>Confirm</button>
    </div>
  );
}

export default CardTargetPrompt;
