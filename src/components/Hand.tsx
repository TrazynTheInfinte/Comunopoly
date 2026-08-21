import { useState } from 'react';
import { BOARD, getTile } from '../data/board';
import { findCard } from '../data/cards';
import {
  buildHouseAndSync,
  callShowTrialAndSync,
  sellHouseAndSync,
  useDenounceCollaboratorsAndSync,
  useSecretInformantAndSync,
} from '../lib/gameSync';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';
import './Hand.css';

function houseCountLabel(count: number): string {
  if (count === 5) return 'Hotel';
  if (count === 0) return 'No houses';
  return `${count} house${count === 1 ? '' : 's'}`;
}

interface HandProps {
  room: Room;
  roomCode: string;
  playerId: string;
  game: GameState;
}

/**
 * Everything the viewing player is holding - owned properties and kept
 * special cards (Denounce Your Collaborators, Secret Informant, Show
 * Trial) - shown as a strip of cards along the bottom of the screen.
 * Click a card to expand it (full details, and a use-action if
 * applicable); click again to collapse. This is also where a future
 * "buy house"/"buy hotel" action will live, once that system exists -
 * right there on the relevant property's card.
 */
function Hand({ room, roomCode, playerId, game }: HandProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const me = game.players[playerId];
  if (!me || (me.ownedTileIds.length === 0 && me.heldCardIds.length === 0)) {
    return null;
  }

  function toggle(key: string) {
    setExpandedKey((current) => (current === key ? null : key));
  }

  return (
    <div className="hand">
      {me.ownedTileIds.map((tileId) => {
        const tile = getTile(tileId);
        const key = `property-${tileId}`;
        const isExpanded = expandedKey === key;
        return (
          <div key={key} className={`hand-card hand-card-special ${isExpanded ? 'is-expanded' : ''}`}>
            <button type="button" className="hand-card-header" onClick={() => toggle(key)}>
              <span className="hand-card-name">{tile.name}</span>
            </button>
            {isExpanded && (
              <div className="hand-card-detail">
                {tile.kind === 'property' ? (
                  <>
                    <p>
                      Price: ₽{tile.price}
                      <br />
                      {houseCountLabel(game.propertyHouses[tileId] ?? 0)}
                    </p>
                    <HouseControls roomCode={roomCode} playerId={playerId} game={game} tileId={tileId} />
                  </>
                ) : (
                  <p>
                    {tile.kind === 'railroad' && `Price: ₽${tile.price}`}
                    {tile.kind === 'utility' && 'Utility'}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {me.heldCardIds.map((cardId, index) => {
        const card = findCard(cardId);
        const key = `card-${cardId}-${index}`;
        const isExpanded = expandedKey === key;
        return (
          <div key={key} className={`hand-card hand-card-special ${isExpanded ? 'is-expanded' : ''}`}>
            <button type="button" className="hand-card-header" onClick={() => toggle(key)}>
              <span className="hand-card-name">{card.title}</span>
            </button>
            {isExpanded && (
              <div className="hand-card-detail">
                <p>{card.text}</p>
                <HandCardActions
                  cardId={cardId}
                  room={room}
                  roomCode={roomCode}
                  playerId={playerId}
                  game={game}
                  onUsed={() => setExpandedKey(null)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface HouseControlsProps {
  roomCode: string;
  playerId: string;
  game: GameState;
  tileId: number;
}

// Build/sell houses on a property card - only shown once the viewing
// player owns every property in that color group (standard Monopoly
// rule; no even-building requirement across the group in this variant).
function HouseControls({ roomCode, playerId, game, tileId }: HouseControlsProps) {
  const tile = getTile(tileId);
  if (tile.kind !== 'property') return null;

  const me = game.players[playerId];
  const ownsFullGroup = BOARD.filter(
    (t) => t.kind === 'property' && t.colorGroup === tile.colorGroup,
  ).every((t) => me.ownedTileIds.includes(t.id));

  if (!ownsFullGroup) {
    return <p className="hint">Own the whole collection to build.</p>;
  }

  const houses = game.propertyHouses[tileId] ?? 0;
  const isHotel = houses === 5;
  const canBuild =
    !isHotel &&
    me.roubles >= tile.houseCost &&
    (houses === 4 ? game.hotelsRemaining > 0 : game.housesRemaining > 0);
  const canSell = houses > 0 && !(isHotel && game.housesRemaining < 4);

  return (
    <div className="hand-card-action">
      <button
        type="button"
        onClick={() => buildHouseAndSync(roomCode, game, playerId, tileId)}
        disabled={!canBuild}
      >
        {houses === 4 ? `Build Hotel (₽${tile.houseCost})` : `Build House (₽${tile.houseCost})`}
      </button>
      <button
        type="button"
        onClick={() => sellHouseAndSync(roomCode, game, playerId, tileId)}
        disabled={!canSell}
      >
        Sell {isHotel ? 'Hotel' : 'House'} (₽{Math.floor(tile.houseCost / 2)})
      </button>
    </div>
  );
}

interface HandCardActionsProps {
  cardId: string;
  room: Room;
  roomCode: string;
  playerId: string;
  game: GameState;
  onUsed: () => void;
}

function HandCardActions({ cardId, room, roomCode, playerId, game, onUsed }: HandCardActionsProps) {
  const me = game.players[playerId];
  const otherPlayers = game.turnOrder.filter((id) => id !== playerId);

  // Show Trial can put yourself on trial too (that's exactly when you'd
  // want to call it), so its target pool includes the holder, unlike
  // Secret Informant/Denounce Your Collaborators which only ever act on
  // someone else.
  const relevantTargets =
    cardId === 'secretInformant'
      ? otherPlayers.filter((id) => game.players[id].position === me.position)
      : cardId === 'showTrial'
        ? game.turnOrder.filter((id) => game.players[id].inJail)
        : otherPlayers;

  const [targetId, setTargetId] = useState(relevantTargets[0] ?? '');
  const effectiveTargetId = relevantTargets.includes(targetId) ? targetId : (relevantTargets[0] ?? '');

  async function use() {
    if (!effectiveTargetId) return;
    if (cardId === 'denounceCollaborators') {
      await useDenounceCollaboratorsAndSync(roomCode, game, playerId, effectiveTargetId);
    } else if (cardId === 'secretInformant') {
      await useSecretInformantAndSync(roomCode, game, playerId, effectiveTargetId);
    } else if (cardId === 'showTrial') {
      await callShowTrialAndSync(roomCode, game, playerId, effectiveTargetId);
    }
    onUsed();
  }

  if (cardId === 'denounceCollaborators' && !me.inJail) {
    return <p className="hint">Usable while you're in jail.</p>;
  }
  if (cardId === 'showTrial' && game.activeVote) {
    return <p className="hint">A Show Trial is already in progress.</p>;
  }
  if (cardId !== 'denounceCollaborators' && relevantTargets.length === 0) {
    return (
      <p className="hint">
        {cardId === 'secretInformant'
          ? 'Usable when someone shares your square.'
          : 'Usable when someone is in jail.'}
      </p>
    );
  }

  return (
    <div className="hand-card-action">
      <select value={effectiveTargetId} onChange={(event) => setTargetId(event.target.value)}>
        {relevantTargets.map((id) => (
          <option key={id} value={id}>
            {id === playerId ? `${room.players[id]?.name} (you)` : room.players[id]?.name}
          </option>
        ))}
      </select>
      {cardId === 'denounceCollaborators' && (
        <button type="button" onClick={() => use()}>
          Swap Places
        </button>
      )}
      {cardId === 'secretInformant' && (
        <button type="button" onClick={() => use()}>
          Send to Jail
        </button>
      )}
      {cardId === 'showTrial' && (
        <button type="button" onClick={() => use()}>
          Call Vote
        </button>
      )}
    </div>
  );
}

export default Hand;
