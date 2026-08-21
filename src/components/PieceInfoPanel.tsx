import { STARTING_PIECES } from '../data/pieces';
import type { PieceId } from '../types/game';
import './PieceInfoPanel.css';

interface PieceInfoPanelProps {
  pieceId: PieceId;
}

// Shows the viewing player's own Piece once the game has actually
// started - the Special Power and Win Condition stay hidden during
// beginner-mode selection (LobbyScreen only shows name/title), but once
// play begins everyone already knows their own Piece, so there's no
// reason to keep hiding it from them here.
function PieceInfoPanel({ pieceId }: PieceInfoPanelProps) {
  const piece = STARTING_PIECES.find((p) => p.id === pieceId);
  if (!piece) return null;

  return (
    <aside className="piece-info-panel">
      <p className="piece-info-name">{piece.name}</p>
      <p className="piece-info-title">{piece.title}</p>
      <p className="piece-info-label">Power</p>
      <p className="piece-info-text">{piece.powerDescription}</p>
      <p className="piece-info-label">Win Condition</p>
      <p className="piece-info-text">{piece.winConditionDescription}</p>
    </aside>
  );
}

export default PieceInfoPanel;
