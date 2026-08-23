import { useEffect, useRef, useState } from 'react';
import { BOARD_SIZE } from '../data/board';
import type { GameState } from '../types/game';

const STEP_MS = 160;
// A normal roll (up to double sixes) or Thimble's single die. A bigger
// jump between the old and new position (jail, Disappear, a forced
// "advance to") is a teleport, not a walk - there's no way to tell the
// two apart just by comparing start/end tiles, so it snaps instead of
// animating a lap around the board.
const MAX_ANIMATED_STEPS = 12;
// Extra pause after a jail-redirect walk lands on the tile that actually
// triggered it (Go To Jail, an unaffordable STOY fee, etc.) before the
// piece is hauled off to jail - long enough to register as "you landed
// here, and THEN got sent to jail" rather than the walk and the jail
// snap blurring into one motion.
const JAIL_REVEAL_DELAY_MS = 500;

/**
 * Every landing (rent, cards, jail, Kremlin/NKVD visits, Chernobyl,
 * everything) is computed and written to Firestore as a single atomic
 * update - so without this, a card that Disappears the drawer would
 * seem to resolve before their token even finished moving, since every
 * viewer just receives the whole finished result in one snapshot.
 *
 * This hook returns a "staged" GameState for rendering: when the mover's
 * position changes by a normal move's worth of tiles, it holds every
 * OTHER field at its previous values while stepping the mover's
 * position through each intermediate tile, only adopting the full new
 * state (revealing the card prompt, updated Roubles, log entries,
 * everything at once) once the walk finishes. A teleport-sized jump (or
 * no movement at all - a vote, a Dev Panel edit, etc.) adopts the new
 * state immediately, no delay.
 */
export function useStagedGame(liveGame: GameState | undefined): GameState | undefined {
  const [staged, setStaged] = useState(liveGame);
  const prevLiveRef = useRef(liveGame);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const prevLive = prevLiveRef.current;
    prevLiveRef.current = liveGame;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    // No live state yet (still in the lobby), or nothing actually
    // changed, or this is the first time we've seen a real state
    // (nothing to compare against) - adopt it immediately either way.
    if (!liveGame || !prevLive || prevLive === liveGame) {
      setStaged(liveGame);
      return;
    }

    const moverId = liveGame.turnOrder.find(
      (id) => prevLive.players[id] && prevLive.players[id].position !== liveGame.players[id].position,
    );

    if (!moverId) {
      setStaged(liveGame);
      return;
    }

    const mover = liveGame.players[moverId];
    const prevPosition = prevLive.players[moverId].position;
    const backward = mover.movingBackward;

    // A Disappear resets position to 0 (STOY) unconditionally - that's
    // always a teleport, never a walk, but a plain distance check can't
    // tell it apart from a real short move that happened to land on
    // STOY (e.g. starting from tile 38, 2 tiles from STOY either way).
    // engine.ts's disappearPlayer stamps lastDisappearedPlayerId for
    // exactly this reason.
    if (liveGame.lastDisappearedPlayerId === moverId && mover.position === 0) {
      setStaged(liveGame);
      return;
    }

    // Landing on Go To Jail, or falling short on the STOY pass fee mid-
    // move, redirects the mover to jail *after* they've already moved
    // normally - but that redirect is baked into the same Firestore
    // write as the move itself, so comparing raw start/end position
    // alone sees one big jump straight to jail and (wrongly) snaps
    // instead of walking. sendToJail (engine.ts) records exactly which
    // tile the mover was actually standing on the instant it redirected
    // them - lastJailRedirect - so this walks there first rather than
    // trying to reverse-engineer it from the roll. Three-doubles-in-a-
    // row jails you with no preceding move, so that tile is just
    // wherever they already were - a 0-distance "walk," which the
    // distance===0 check below already treats as an immediate reveal.
    const justJailed = mover.inJail && !prevLive.players[moverId].inJail;
    const redirect = liveGame.lastJailRedirect;
    const jailRedirectFromTileId =
      justJailed && redirect && redirect.playerId === moverId ? redirect.fromTileId : null;
    const isJailRedirect = jailRedirectFromTileId !== null;

    const distance = isJailRedirect
      ? backward
        ? (prevPosition - jailRedirectFromTileId + BOARD_SIZE) % BOARD_SIZE
        : (jailRedirectFromTileId - prevPosition + BOARD_SIZE) % BOARD_SIZE
      : backward
        ? (prevPosition - mover.position + BOARD_SIZE) % BOARD_SIZE
        : (mover.position - prevPosition + BOARD_SIZE) % BOARD_SIZE;

    if (distance === 0 || distance > MAX_ANIMATED_STEPS) {
      setStaged(liveGame);
      return;
    }

    let pos = prevPosition;
    for (let step = 1; step <= distance; step++) {
      pos = backward ? (pos - 1 + BOARD_SIZE) % BOARD_SIZE : (pos + 1) % BOARD_SIZE;
      const tileId = pos;
      const isLastStep = step === distance;
      timersRef.current.push(
        setTimeout(() => {
          if (isLastStep) {
            if (isJailRedirect) {
              // Show the piece actually arriving on the tile that
              // triggered the redirect, hold there for a beat, then
              // reveal the jump to jail.
              setStaged((current) => {
                const base = current as GameState;
                return {
                  ...base,
                  players: {
                    ...base.players,
                    [moverId]: { ...base.players[moverId], position: tileId },
                  },
                };
              });
              timersRef.current.push(setTimeout(() => setStaged(liveGame), JAIL_REVEAL_DELAY_MS));
              return;
            }
            // The walk is done - reveal everything else about this update now.
            setStaged(liveGame);
          } else {
            // Safe to assume defined here - we only ever schedule these
            // steps after confirming both liveGame and prevLive exist,
            // so `staged` was already seeded with real data by now.
            setStaged((current) => {
              const base = current as GameState;
              return {
                ...base,
                players: {
                  ...base.players,
                  [moverId]: { ...base.players[moverId], position: tileId },
                },
              };
            });
          }
        }, step * STEP_MS),
      );
    }
  }, [liveGame]);

  useEffect(() => {
    const timersAtUnmount = timersRef.current;
    return () => {
      timersAtUnmount.forEach(clearTimeout);
    };
  }, []);

  return staged;
}
