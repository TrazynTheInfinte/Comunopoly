import { useEffect, useState } from 'react';

// Matches the 900px breakpoint GameBoard.css/Board.css already use for
// their (CSS-only) responsive layout everywhere else. This one's JS
// rather than CSS because GameBoard needs to know which single spot to
// actually mount the DiceRoller in (see the desktop-only dice/banner
// swap) - CSS alone can hide/show, but can't relocate one live
// component instance between two different parent containers, and
// mounting it in both would double its sound effects.
const DESKTOP_QUERY = '(min-width: 901px)';

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY);
    const handler = () => setIsDesktop(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}
