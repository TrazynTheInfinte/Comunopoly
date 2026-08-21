import { useState } from 'react';
import { STARTING_PIECES } from '../data/pieces';
import { getAvailablePieceIds } from '../game/engine';
import { chooseNewPieceAndSync } from '../lib/gameSync';
import type { GameState, PieceId } from '../types/game';

interface PieceChoicePromptProps {
  playerId: string;
  roomCode: string;
  game: GameState;
}

// Shown to a Disappeared player who needs to pick their next Piece from
// whatever's left in the Piece Pool - name only, same as Beginner-mode's
// initial picker, no peeking at the power/win condition before
// committing. Independent of pendingDecision/turn order - the rest of
// the table keeps playing while this resolves (see pendingPieceChoices).
function PieceChoicePrompt({ playerId, roomCode, game }: PieceChoicePromptProps) {
  const availableIds = getAvailablePieceIds(game, playerId);
  const [selectedId, setSelectedId] = useState<PieceId | ''>(availableIds[0] ?? '');
  const effectiveId = availableIds.includes(selectedId as PieceId) ? selectedId : (availableIds[0] ?? '');

  return (
    <div className="purchase-prompt card-prompt">
      <p>You Disappeared - choose your next Piece:</p>
      <select value={effectiveId} onChange={(event) => setSelectedId(event.target.value as PieceId)}>
        {availableIds.map((id) => (
          <option key={id} value={id}>
            {STARTING_PIECES.find((p) => p.id === id)?.name ?? id}
          </option>
        ))}
      </select>
      <button
        onClick={() => effectiveId && chooseNewPieceAndSync(roomCode, game, playerId, effectiveId)}
        disabled={!effectiveId}
      >
        Confirm
      </button>
    </div>
  );
}

export default PieceChoicePrompt;
