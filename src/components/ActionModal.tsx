import type { ReactNode } from 'react';
import './ActionModal.css';

interface ActionModalProps {
  children: ReactNode;
}

/**
 * A centered, full-screen overlay for anything the game is genuinely
 * waiting on a specific player to resolve - buy/skip, a card reveal, a
 * card choice/target, an NKVD quiz, picking a new Piece, an Endgame
 * target. Playtest feedback was that these were too easy to miss
 * sitting inline in the sidebar if you were looking at the board.
 *
 * Deliberately NOT used for the routine Roll Dice/End Turn buttons
 * (not a "decision" - just the normal per-turn flow, and popping a
 * modal every single turn would be far more annoying than helpful),
 * or for things that are optional/not gated to one specific player
 * (Rubber duck's jail offer, accusing someone of being Trotsky, a Show
 * Trial vote) - those stay as inline banners.
 */
function ActionModal({ children }: ActionModalProps) {
  return (
    <div className="action-modal-overlay">
      <div className="action-modal">{children}</div>
    </div>
  );
}

export default ActionModal;
