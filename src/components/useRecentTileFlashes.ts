import { useEffect, useRef, useState } from 'react';
import { BOARD } from '../data/board';

export interface TileFlash {
  key: number;
  tileId: number;
  kind: 'buy' | 'rent';
}

const FLASH_LIFETIME_MS = 900;
let nextFlashKey = 0;

const NAME_TO_TILE_ID = new Map(BOARD.map((tile) => [tile.name, tile.id]));

const BUY_PATTERN = /^Bought (.+) for \d+ roubles\.$/;
const RENT_PATTERN = /^Paid \d+ roubles rent on (.+)\.$/;

/**
 * Diffs game.log by content (see useSoundEvents for why - Firestore
 * gives every array a new reference on every snapshot regardless of
 * whether it actually changed) to find newly-added "Bought X" / "Paid
 * rent on X" lines, and returns which tiles should currently be
 * flashing because of one. Log-text matching is the right tool here
 * (unlike useBoardStamps' jail/Disappear detection) because these two
 * messages reliably embed the tile's own name, and the flourish is
 * about the tile, not about who's involved.
 */
export function useRecentTileFlashes(log: string[]): TileFlash[] {
  const previousLogRef = useRef<string[]>([]);
  const [flashes, setFlashes] = useState<TileFlash[]>([]);

  useEffect(() => {
    const previous = previousLogRef.current;
    previousLogRef.current = log;
    if (previous.length === 0) return; // don't flash for pre-existing history on first load

    const lastPrevEntry = previous[previous.length - 1];
    const matchIndex = log.lastIndexOf(lastPrevEntry);
    const newEntries = matchIndex === -1 ? [] : log.slice(matchIndex + 1);

    const fresh: TileFlash[] = [];
    for (const entry of newEntries) {
      const buyMatch = entry.match(BUY_PATTERN);
      const rentMatch = entry.match(RENT_PATTERN);
      const name = buyMatch?.[1] ?? rentMatch?.[1];
      if (!name) continue;
      const tileId = NAME_TO_TILE_ID.get(name);
      if (tileId === undefined) continue;
      fresh.push({ key: nextFlashKey++, tileId, kind: buyMatch ? 'buy' : 'rent' });
    }
    if (fresh.length === 0) return;

    setFlashes((current) => [...current, ...fresh]);
    for (const flash of fresh) {
      setTimeout(() => {
        setFlashes((current) => current.filter((f) => f.key !== flash.key));
      }, FLASH_LIFETIME_MS);
    }
  }, [log]);

  return flashes;
}
