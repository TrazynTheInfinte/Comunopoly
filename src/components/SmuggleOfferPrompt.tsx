import { useState } from 'react';
import { resolveSmuggleOfferAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';

interface SmuggleOfferPromptProps {
  maxAmount: number;
  roomCode: string;
  game: GameState;
}

// Shown on landing on Free Parking (everyone), or on any owned
// property/railroad (Penguin's Special Power). Smuggled roubles sit at
// risk at Free Parking until this player either lands back on it or
// reaches STOY - if anyone else lands on Free Parking first, they keep
// it and this player Disappears.
function SmuggleOfferPrompt({ maxAmount, roomCode, game }: SmuggleOfferPromptProps) {
  const [amount, setAmount] = useState(0);

  return (
    <div className="purchase-prompt card-prompt">
      <p>Smuggle how much to the West? (up to ₽{maxAmount})</p>
      <input
        type="number"
        min={0}
        max={maxAmount}
        value={amount}
        onChange={(event) => {
          const value = Number(event.target.value);
          setAmount(Number.isNaN(value) ? 0 : Math.max(0, Math.min(maxAmount, Math.floor(value))));
        }}
      />
      <button onClick={() => resolveSmuggleOfferAndSync(roomCode, game, amount)}>
        Smuggle ₽{amount}
      </button>
      <button onClick={() => resolveSmuggleOfferAndSync(roomCode, game, 0)}>Skip</button>
    </div>
  );
}

export default SmuggleOfferPrompt;
