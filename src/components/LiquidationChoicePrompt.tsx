import { getTile } from '../data/board';
import { confirmLiquidationPaymentAndSync, declareBankruptcyAndSync, mortgagePropertyAndSync, sellHouseAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';

interface LiquidationChoicePromptProps {
  playerId: string;
  amountOwed: number;
  roomCode: string;
  game: GameState;
}

const HOUSE_LABELS = ['', '1 house', '2 houses', '3 houses', '4 houses', 'Hotel'];

/**
 * Lenin mode only: shown when a player can't afford the jail bribe but
 * has something left to sell/mortgage - sellHouse/mortgageProperty are
 * unrestricted by any pendingDecision, so this just exposes them
 * directly, with a running "can you afford it yet" check and a Pay
 * button that only lights up once you can. Declare Bankruptcy is
 * always available as an opt-out from selling everything.
 */
function LiquidationChoicePrompt({ playerId, amountOwed, roomCode, game }: LiquidationChoicePromptProps) {
  const player = game.players[playerId];
  const housesToSell = player.ownedTileIds
    .map((tileId) => ({ tileId, houses: game.propertyHouses[tileId] ?? 0 }))
    .filter(({ houses }) => houses > 0);
  const mortgageableTiles = player.ownedTileIds.filter((tileId) => {
    const tile = getTile(tileId);
    return (tile.kind === 'property' || tile.kind === 'railroad') && !game.mortgagedTileIds.includes(tileId);
  });
  const canPay = player.roubles >= amountOwed;

  return (
    <div className="purchase-prompt card-prompt">
      <p className="card-title">Can't Afford the Jail Bribe</p>
      <p>
        You owe ₽{amountOwed} but only have ₽{player.roubles}. Sell houses or mortgage properties to raise
        cash, or declare bankruptcy.
      </p>

      {housesToSell.length > 0 && (
        <div className="liquidation-choice-group">
          <p className="hint">Sell a house:</p>
          {housesToSell.map(({ tileId, houses }) => (
            <button key={tileId} onClick={() => sellHouseAndSync(roomCode, game, playerId, tileId)}>
              {getTile(tileId).name} ({HOUSE_LABELS[houses]})
            </button>
          ))}
        </div>
      )}

      {mortgageableTiles.length > 0 && (
        <div className="liquidation-choice-group">
          <p className="hint">Mortgage a property:</p>
          {mortgageableTiles.map((tileId) => (
            <button key={tileId} onClick={() => mortgagePropertyAndSync(roomCode, game, playerId, tileId)}>
              {getTile(tileId).name}
            </button>
          ))}
        </div>
      )}

      <div className="purchase-prompt-actions">
        <button disabled={!canPay} onClick={() => confirmLiquidationPaymentAndSync(roomCode, game)}>
          Pay ₽{amountOwed}
        </button>
        <button onClick={() => declareBankruptcyAndSync(roomCode, game)}>Declare Bankruptcy</button>
      </div>
    </div>
  );
}

export default LiquidationChoicePrompt;
