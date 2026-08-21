import { resolveRubberDuckEncounterAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';
import type { Room } from '../types/room';

interface RubberDuckEncounterBannerProps {
  room: Room;
  roomCode: string;
  playerId: string;
  game: GameState;
}

// Rubber duck's Special Power: shown only to Rubber duck, only when
// their own move just landed them on another player's square (see
// rubberDuckEncounter in game/engine.ts). Independent of whose turn it
// technically is to resolve, since it's always Rubber duck's own move
// that triggers it.
function RubberDuckEncounterBanner({ room, roomCode, playerId, game }: RubberDuckEncounterBannerProps) {
  const encounter = game.rubberDuckEncounter;
  if (!encounter || encounter.rubberDuckPlayerId !== playerId) return null;

  const targetName = room.players[encounter.targetPlayerId]?.name ?? 'them';

  return (
    <div className="purchase-prompt card-prompt">
      <p>
        You landed on {targetName}. Send them to jail? (Stalin's body-double)
      </p>
      <button onClick={() => resolveRubberDuckEncounterAndSync(roomCode, game, true)}>Yes</button>
      <button onClick={() => resolveRubberDuckEncounterAndSync(roomCode, game, false)}>No</button>
    </div>
  );
}

export default RubberDuckEncounterBanner;
