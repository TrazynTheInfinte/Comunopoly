import { useState } from 'react';
import { getTile } from '../data/board';
import { findCard } from '../data/cards';
import {
  useDenounceCollaboratorsAndSync,
  useSecretInformantAndSync,
  useShowTrialAndSync,
} from '../lib/gameSync';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';
import './Hand.css';

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
          <button
            key={key}
            type="button"
            className={`hand-card ${isExpanded ? 'is-expanded' : ''}`}
            onClick={() => toggle(key)}
          >
            <span className="hand-card-name">{tile.name}</span>
            {isExpanded && (
              <span className="hand-card-detail">
                {(tile.kind === 'property' || tile.kind === 'railroad') && `Price: ₽${tile.price}`}
                {tile.kind === 'utility' && 'Utility'}
              </span>
            )}
          </button>
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

  const relevantTargets =
    cardId === 'secretInformant'
      ? otherPlayers.filter((id) => game.players[id].position === me.position)
      : cardId === 'showTrial'
        ? otherPlayers.filter((id) => game.players[id].inJail)
        : otherPlayers;

  const [targetId, setTargetId] = useState(relevantTargets[0] ?? '');
  const effectiveTargetId = relevantTargets.includes(targetId) ? targetId : (relevantTargets[0] ?? '');

  async function use(verdict?: 'release' | 'disappear') {
    if (!effectiveTargetId) return;
    if (cardId === 'denounceCollaborators') {
      await useDenounceCollaboratorsAndSync(roomCode, game, playerId, effectiveTargetId);
    } else if (cardId === 'secretInformant') {
      await useSecretInformantAndSync(roomCode, game, playerId, effectiveTargetId);
    } else if (cardId === 'showTrial' && verdict) {
      await useShowTrialAndSync(roomCode, game, playerId, effectiveTargetId, verdict);
    }
    onUsed();
  }

  if (cardId === 'denounceCollaborators' && !me.inJail) {
    return <p className="hint">Usable while you're in jail.</p>;
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
            {room.players[id]?.name}
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
        <>
          <button type="button" onClick={() => use('release')}>
            Release
          </button>
          <button type="button" onClick={() => use('disappear')}>
            Disappear
          </button>
        </>
      )}
    </div>
  );
}

export default Hand;
