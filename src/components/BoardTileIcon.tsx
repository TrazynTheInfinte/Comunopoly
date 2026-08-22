// Small inline-SVG icon set for board tiles, echoing the icon language
// from the source board.pdf (a hammer for Communist Test, a crescent
// for No Chance, a train silhouette for railroads, etc.) without
// needing any image assets - everything here is drawn with paths.

interface IconProps {
  className?: string;
}

export function HammerIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20 L11 13 M9.5 9 L14 4.5 L19.5 10 L15 14.5 L9.5 9 Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChanceIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M16 4a8 8 0 1 0 0 16 7 7 0 0 1 0-16Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M18 3 L19 6 L22 7 L19 8 L18 11 L17 8 L14 7 L17 6 Z" fill="currentColor" />
    </svg>
  );
}

export function TrainIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M5 11 H19 M8 4 V16 M16 4 V16" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8.5" cy="19" r="1.4" fill="currentColor" />
      <circle cx="15.5" cy="19" r="1.4" fill="currentColor" />
      <path d="M6 16 L4 20 M18 16 L20 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function BulbIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3a6 6 0 0 0-3.5 10.9c.6.45 1 1.2 1 2.1v.5h5v-.5c0-.9.4-1.65 1-2.1A6 6 0 0 0 12 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9.5 19 h5 M10 21 h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function DropletIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 C 8 9, 5 12.5, 5 15.5 A 7 7 0 0 0 19 15.5 C 19 12.5, 16 9, 12 3 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2 L14.6 9 L22 9.5 L16.3 14.2 L18.2 21.5 L12 17.4 L5.8 21.5 L7.7 14.2 L2 9.5 L9.4 9 Z" />
    </svg>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12 C 5 6, 19 6, 22 12 C 19 18, 5 18, 2 12 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
}

export function ParkingIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9 17 V7 h4 a3.5 3.5 0 0 1 0 7 H9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CuffsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="16" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
      <path d="M11 12 h2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function BarsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" stroke="currentColor" strokeWidth="2" />
      <path d="M8 3 v18 M12 3 v18 M16 3 v18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12 H4 M10 5 L3 12 L10 19"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A simplified radiation trefoil - three rotationally-symmetric blades around a center dot, built from plain triangles/rotate() rather than true arcs (close enough at this size, and avoids hand-computing arc paths). Marks a Chernobyl-destroyed tile - see .tile-destroyed in Board.css. */
export function RadiationIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 10 L7.77 2.94 L16.23 2.94 Z" />
      <path d="M12 10 L7.77 2.94 L16.23 2.94 Z" transform="rotate(120 12 12)" />
      <path d="M12 10 L7.77 2.94 L16.23 2.94 Z" transform="rotate(240 12 12)" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}
