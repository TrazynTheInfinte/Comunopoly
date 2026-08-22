import { useEffect, useRef, useState } from 'react';
import { BOARD } from '../data/board';

export interface TileFlash {
  key: number;
  tileId: number;
  kind: 'buy' | 'rent' | 'seize';
}

const FLASH_LIFETIME_MS = 900;
let nextFlashKey = 0;

const NAME_TO_TILE_ID = new Map(BOARD.map((tile) => [tile.name, tile.id]));

const BUY_PATTERN = /^Bought (.+) for \d+ roubles\.$/;
const RENT_PATTERN = /^Paid \d+ roubles rent on (.+)\.$/;
// Kulak's/T-Rex's auto-seize and Siege of Stalingrad all embed the
// tile's own name the same way Bought/rent do. The Volga's forced
// transfers don't - they move a whole hand of properties at once, not
// one named tile - so there's nothing for those to flash here (see
// useSoundEvents' SEIZE_PATTERN for the sound, which doesn't need a
// tile at all).
const SEIZE_PATTERNS = [
  /^Automatically took (.+) for free \(Kulak's power\)\.$/,
  /^Seized (.+) for free - no rent paid \(Kulak's power\)\.$/,
  /^Seized (.+) - no rent paid \(T-Rex's power\)\.$/,
  /^Seized (.+) permanently\.$/,
];

/**
 * Diffs game.log by content (see useSoundEvents for why - Firestore
 * gives every array a new reference on every snapshot regardless of
 * whether it actually changed) to find newly-added "Bought X" / "Paid
 * rent on X" / a forced seizure of X, and returns which tiles should
 * currently be flashing because of one. Log-text matching is the right
 * tool here (unlike useBoardStamps' jail/Disappear detection) because
 * these messages reliably embed the tile's own name, and the flourish
 * is about the tile, not about who's involved.
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
      const seizeMatch = SEIZE_PATTERNS.map((pattern) => entry.match(pattern)).find(Boolean);
      const name = buyMatch?.[1] ?? rentMatch?.[1] ?? seizeMatch?.[1];
      if (!name) continue;
      const tileId = NAME_TO_TILE_ID.get(name);
      if (tileId === undefined) continue;
      const kind = buyMatch ? 'buy' : rentMatch ? 'rent' : 'seize';
      fresh.push({ key: nextFlashKey++, tileId, kind });
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
