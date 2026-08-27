import { useState, type CSSProperties } from 'react';
import { getTile } from '../data/board';
import { findCard } from '../data/cards';
import { resolveCardTargetAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';

// The tile's color group as a real background color on its <option> -
// with a dozen-plus properties in one flat dropdown, picking a target
// by name alone meant cross-checking the board to know what you were
// actually about to seize. Most browsers do respect background-color/
// color on <option> (Windows and Android reliably; Safari/iOS mostly
// ignores it and falls back to the default list style - a graceful,
// harmless degradation, not a broken one). Railroads have no color
// group on the board itself, so they're left unstyled here too.
function tileOptionStyle(tileId: number): CSSProperties {
  const tile = getTile(tileId);
  if (tile.kind !== 'property') return {};
  return { backgroundColor: `var(--group-${tile.colorGroup})`, color: 'var(--color-paper)' };
}

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
  const otherPlayers = game.turnOrder.filter((id) => id !== playerId && !game.players[id].isSpectating);

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
              <option key={tileId} value={tileId} style={tileOptionStyle(tileId)}>
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
            <option key={tile.id} value={tile.id} style={tileOptionStyle(tile.id)}>
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
