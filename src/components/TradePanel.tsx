import { useState } from 'react';
import { getTile } from '../data/board';
import { acceptTradeAndSync, declineTradeAndSync, proposeTradeAndSync, withdrawTradeAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';
import './TradePanel.css';

interface TradePanelProps {
  playerId: string;
  roomCode: string;
  room: Room;
  game: GameState;
}

/** Which of playerId's owned tiles can actually go into a trade right now - no houses on it (sell those first), not exempt from ownership transfers (Chernobyl, a Siege of Stalingrad lock). Mirrors engine.ts's canIncludeInTrade, just for deciding what to show as selectable here. */
function tradeableOwnedTileIds(game: GameState, playerId: string): number[] {
  return game.players[playerId].ownedTileIds.filter((tileId) => {
    if ((game.propertyHouses[tileId] ?? 0) > 0) return false;
    if (game.lockedTileIds.includes(tileId)) return false;
    return getTile(tileId).kind !== 'utility';
  });
}

function toggleInSet(set: Set<number>, value: number): Set<number> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

/**
 * Player-to-player trading (both modes, not turn-gated) - always
 * visible rather than an ActionModal, since trading isn't something
 * the game is waiting on anyone to resolve. A "Propose Trade" builder
 * (pick a player, pick tiles/roubles on each side) plus a list of
 * trades already on the table involving this player, with Accept/
 * Decline (as recipient) or Withdraw (as proposer).
 */
function TradePanel({ playerId, roomCode, room, game }: TradePanelProps) {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [targetPlayerId, setTargetPlayerId] = useState('');
  const [myTileIds, setMyTileIds] = useState<Set<number>>(new Set());
  const [myRoubles, setMyRoubles] = useState(0);
  const [theirTileIds, setTheirTileIds] = useState<Set<number>>(new Set());
  const [theirRoubles, setTheirRoubles] = useState(0);

  const otherPlayerIds = game.turnOrder.filter((id) => id !== playerId && !game.players[id].isSpectating);
  const effectiveTargetId = otherPlayerIds.includes(targetPlayerId) ? targetPlayerId : (otherPlayerIds[0] ?? '');
  const myTradeableTileIds = tradeableOwnedTileIds(game, playerId);
  const theirTradeableTileIds = effectiveTargetId ? tradeableOwnedTileIds(game, effectiveTargetId) : [];

  const myTrades = game.activeTrades.filter((t) => t.fromPlayerId === playerId || t.toPlayerId === playerId);

  function resetBuilder() {
    setMyTileIds(new Set());
    setMyRoubles(0);
    setTheirTileIds(new Set());
    setTheirRoubles(0);
    setIsBuilderOpen(false);
  }

  async function handlePropose() {
    if (!effectiveTargetId) return;
    await proposeTradeAndSync(
      roomCode,
      game,
      playerId,
      effectiveTargetId,
      { tileIds: [...myTileIds], roubles: myRoubles },
      { tileIds: [...theirTileIds], roubles: theirRoubles },
    );
    resetBuilder();
  }

  return (
    <div className="trade-panel">
      <button type="button" onClick={() => setIsBuilderOpen((open) => !open)}>
        {isBuilderOpen ? 'Cancel Trade' : 'Propose Trade'}
      </button>

      {isBuilderOpen && (
        <div className="trade-builder">
          <label>
            Trade with:
            <select value={effectiveTargetId} onChange={(event) => setTargetPlayerId(event.target.value)}>
              {otherPlayerIds.map((id) => (
                <option key={id} value={id}>
                  {room.players[id]?.name}
                </option>
              ))}
            </select>
          </label>

          <div className="trade-builder-columns">
            <fieldset>
              <legend>You give</legend>
              {myTradeableTileIds.map((tileId) => (
                <label key={tileId}>
                  <input
                    type="checkbox"
                    checked={myTileIds.has(tileId)}
                    onChange={() => setMyTileIds((current) => toggleInSet(current, tileId))}
                  />
                  {getTile(tileId).name}
                </label>
              ))}
              <label>
                Roubles:
                <input
                  type="number"
                  min={0}
                  max={game.players[playerId].roubles}
                  value={myRoubles}
                  onChange={(event) => setMyRoubles(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
            </fieldset>

            <fieldset>
              <legend>You get</legend>
              {theirTradeableTileIds.map((tileId) => (
                <label key={tileId}>
                  <input
                    type="checkbox"
                    checked={theirTileIds.has(tileId)}
                    onChange={() => setTheirTileIds((current) => toggleInSet(current, tileId))}
                  />
                  {getTile(tileId).name}
                </label>
              ))}
              <label>
                Roubles:
                <input
                  type="number"
                  min={0}
                  value={theirRoubles}
                  onChange={(event) => setTheirRoubles(Math.max(0, Number(event.target.value) || 0))}
                />
              </label>
            </fieldset>
          </div>

          <button type="button" disabled={!effectiveTargetId} onClick={handlePropose}>
            Send Offer
          </button>
        </div>
      )}

      {myTrades.length > 0 && (
        <ul className="trade-list">
          {myTrades.map((trade) => {
            const isRecipient = trade.toPlayerId === playerId;
            const otherId = isRecipient ? trade.fromPlayerId : trade.toPlayerId;
            const giveTileIds = isRecipient ? trade.offerTileIds : trade.requestTileIds;
            const giveRoubles = isRecipient ? trade.offerRoubles : trade.requestRoubles;
            const getTileIds = isRecipient ? trade.requestTileIds : trade.offerTileIds;
            const getRoubles = isRecipient ? trade.requestRoubles : trade.offerRoubles;
            return (
              <li key={trade.id}>
                <p>
                  {isRecipient ? `${room.players[otherId]?.name} offers you:` : `You offered ${room.players[otherId]?.name}:`}
                </p>
                <p className="trade-side">
                  Them: {[...giveTileIds.map((id) => getTile(id).name), giveRoubles > 0 ? `₽${giveRoubles}` : null]
                    .filter(Boolean)
                    .join(', ') || 'nothing'}
                </p>
                <p className="trade-side">
                  You: {[...getTileIds.map((id) => getTile(id).name), getRoubles > 0 ? `₽${getRoubles}` : null]
                    .filter(Boolean)
                    .join(', ') || 'nothing'}
                </p>
                {isRecipient ? (
                  <div className="purchase-prompt-actions">
                    <button onClick={() => acceptTradeAndSync(roomCode, game, trade.id)}>Accept</button>
                    <button onClick={() => declineTradeAndSync(roomCode, game, trade.id)}>Decline</button>
                  </div>
                ) : (
                  <button onClick={() => withdrawTradeAndSync(roomCode, game, trade.id)}>Withdraw</button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default TradePanel;
