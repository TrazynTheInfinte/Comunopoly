import type { PieceId } from '../types/game';

interface PieceIconProps {
  pieceId: PieceId;
  className?: string;
}

// One small recognizable silhouette per Piece, drawn as plain SVG paths -
// no image assets. Since Room assignment never lets two active players
// hold the same Piece at once, the icon alone is enough to tell players
// apart on the board (the colored circle behind it is just a bit of
// extra at-a-glance seat color, not load-bearing for identity).
function PieceIcon({ pieceId, className }: PieceIconProps) {
  switch (pieceId) {
    case 'boot':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 3h4v8.5l4.5 3.2c1 .7 1.5 1.7 1.5 3.3H5.5c-.4 0-.7-.3-.7-.8 0-1.6.6-2.5 1.7-3.1L8 12.5V3Z" />
        </svg>
      );
    case 'battleship':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4 14 L20 14 L18 18 L6 18 Z" />
          <rect x="9" y="9" width="6" height="5" />
          <rect x="11" y="5" width="2" height="4" />
        </svg>
      );
    case 'car':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4 15 L5.5 9.5 C6 8.5 7 8 8 8 h8 c1 0 2 .5 2.5 1.5 L20 15 Z" />
          <rect x="9" y="4" width="6" height="4.5" />
          <circle cx="7.5" cy="16" r="2" fill="var(--color-paper)" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="16.5" cy="16" r="2" fill="var(--color-paper)" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      );
    case 'iron':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M4 17 C4 9 8 6 14 6 C18 6 20 8.5 20 12.5 C20 15.5 18 17 15 17 Z" />
          <path d="M9 6 C9 4.3 10.3 3 12 3 C13 3 13.8 3.4 14.4 4.1" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case 'thimble':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 10 C8 5.5 9.8 3 12 3 C14.2 3 16 5.5 16 10 L15 18 H9 Z" />
          <circle cx="10.5" cy="8" r="0.7" fill="var(--color-paper)" />
          <circle cx="13.5" cy="8" r="0.7" fill="var(--color-paper)" />
          <circle cx="12" cy="11" r="0.7" fill="var(--color-paper)" />
          <circle cx="10.5" cy="14" r="0.7" fill="var(--color-paper)" />
          <circle cx="13.5" cy="14" r="0.7" fill="var(--color-paper)" />
        </svg>
      );
    case 'dog':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M7 20 V13 C7 9 9.2 6.5 12.5 6.5 C15.5 6.5 17.5 8.6 17.5 11.5 V20 H14.5 V16 H10 V20 Z" />
          <path d="M6 8 L8.5 9.5 M18 8 L15.8 9.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="14.5" cy="10.2" r="0.8" fill="var(--color-paper)" />
        </svg>
      );
    case 'wheelBarrel':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 10 L16 10 L14.5 16 H7.5 Z" fill="currentColor" />
          <circle cx="6.5" cy="17.5" r="2.2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M16 10 L20 7 M6 16 L3 19 M14.5 16 L11 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'hat':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <rect x="4" y="16" width="16" height="2.2" />
          <rect x="7.5" y="5" width="9" height="11.5" />
          <rect x="7.5" y="9" width="9" height="1.6" fill="var(--color-paper)" />
        </svg>
      );
    case 'penguin':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 3 C16 3 18 7 18 12 C18 16.5 15.5 20 12 20 C8.5 20 6 16.5 6 12 C6 7 8 3 12 3 Z" />
          <path
            d="M12 6 C14.5 6 15.8 9 15.8 12.5 C15.8 16 14 18.5 12 18.5 C10 18.5 8.2 16 8.2 12.5 C8.2 9 9.5 6 12 6 Z"
            fill="var(--color-paper)"
          />
          <path d="M12 10 L14.5 11.3 L12 11.8 Z" fill="var(--color-red)" />
        </svg>
      );
    case 'cat':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6 20 V12 C6 8 8.7 5.5 12 5.5 C15.3 5.5 18 8 18 12 V20 Z" />
          <path d="M6 8 L4 3.5 L9 6.5 Z" />
          <path d="M18 8 L20 3.5 L15 6.5 Z" />
          <circle cx="9.5" cy="12.5" r="0.9" fill="var(--color-paper)" />
          <circle cx="14.5" cy="12.5" r="0.9" fill="var(--color-paper)" />
        </svg>
      );
    case 'rubberDuck':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6 18 C4.5 18 4 16.8 5 16 C4 15.3 4.3 14 5.5 14 C5.2 10 8 6.5 12 6.5 C15.5 6.5 18.5 9 18.5 13 C18.5 16 16 18 13 18 Z" />
          <circle cx="14" cy="9.5" r="2" fill="var(--color-paper)" />
          <path d="M15.5 9.2 L18 8.2 L16 10.4 Z" fill="var(--color-red)" />
        </svg>
      );
    case 'trex':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M8 20 V15 C6 14.5 5 12.8 5 11 C5 7 8.5 4 13 4 C16.5 4 19 6 19 8.8 C19 10 18.3 10.8 17 11 L18 13 L15.5 12.3 V20 H13 V16 H10.5 V20 Z" />
          <path d="M9 15 L7 16.5 M9.5 16.2 L7.8 18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="15.5" cy="7.5" r="0.8" fill="var(--color-paper)" />
        </svg>
      );
    default:
      return null;
  }
}

export default PieceIcon;
