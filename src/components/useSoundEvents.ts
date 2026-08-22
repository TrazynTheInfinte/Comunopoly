import { useEffect, useRef } from 'react';
import { playCash, playDisappear, playJail, playSeize } from '../lib/sound';

// Kulak's/T-Rex's auto-seize, Siege of Stalingrad, and The Volga all
// force a property to change hands with no roubles involved, so none
// of them match playCash's "roubles" check below - this is their own
// catch, checked first so they don't also (redundantly) match anything
// else. See useRecentTileFlashes for the matching tile-flash.
const SEIZE_PATTERN =
  /^Seized |^Automatically took .+ for free \(Kulak's power\)\.$|claimed The Volga|^Forced to surrender everything you own/;

/**
 * Watches the shared event log for newly-appended entries and plays a
 * matching sound - covers money changing hands, forced seizures (no
 * money involved), jail, and Disappearing, for every viewer (not just
 * whoever caused it), since the log is shared game state. Dice and
 * card sounds are handled separately (DiceRoller, the card-reveal
 * banner) since those already have their own more precise animation-
 * synced triggers - and so is a Chernobyl explosion (useDestructionBursts),
 * since that one needs to play once per destroyed tile, staggered, not
 * once per log line.
 *
 * Diffs by comparing log CONTENT (finding where the previous log's last
 * entry still appears), not array reference - Firestore reconstructs
 * the whole document from scratch on every snapshot, so log would
 * otherwise look "new" on every unrelated update too (the same trap
 * that broke the dice tumble animation before it was fixed).
 */
export function useSoundEvents(log: string[]): void {
  const prevLogRef = useRef<string[]>(log);

  useEffect(() => {
    const prevLog = prevLogRef.current;
    prevLogRef.current = log;

    if (log === prevLog) return;

    const lastPrevEntry = prevLog[prevLog.length - 1];
    const matchIndex = lastPrevEntry ? log.lastIndexOf(lastPrevEntry) : -1;
    // If nothing matches, either this is the very first real log (fine
    // to skip - nothing to announce yet) or the whole previous tail got
    // evicted by the log's 20-entry cap (rare) - either way, falling
    // back to "no new entries" beats replaying a huge backlog of sound.
    const newEntries = matchIndex === -1 ? [] : log.slice(matchIndex + 1);

    for (const entry of newEntries) {
      if (/Disappeared/i.test(entry)) {
        playDisappear();
      } else if (/to jail/i.test(entry)) {
        playJail();
      } else if (SEIZE_PATTERN.test(entry)) {
        playSeize();
      } else if (/roubles/i.test(entry)) {
        playCash();
      }
    }
  }, [log]);
}
