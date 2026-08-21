import { useState } from 'react';
import { chooseEndgameTargetAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';

interface EndgameTargetPromptProps {
  playerId: string;
  room: Room;
  roomCode: string;
  game: GameState;
}

// Shown once everyone's had their final turn, to whichever active
// player(s) still need to pick an Endgame target (Iron, Thimble,
// Penguin) before Scores can be computed - always their own choice.
function EndgameTargetPrompt({ playerId, room, roomCode, game }: EndgameTargetPromptProps) {
  const otherActive = game.turnOrder.filter((id) => id !== playerId && !game.players[id].isSpectating);
  const [targetId, setTargetId] = useState(otherActive[0] ?? '');
  const effectiveTargetId = otherActive.includes(targetId) ? targetId : (otherActive[0] ?? '');

  return (
    <div className="purchase-prompt card-prompt">
      <p>Choose your Endgame target:</p>
      <select value={effectiveTargetId} onChange={(event) => setTargetId(event.target.value)}>
        {otherActive.map((id) => (
          <option key={id} value={id}>
            {room.players[id]?.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => chooseEndgameTargetAndSync(roomCode, game, playerId, effectiveTargetId)}
        disabled={!effectiveTargetId}
      >
        Confirm
      </button>
    </div>
  );
}

export default EndgameTargetPrompt;
