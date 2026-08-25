import type { RoomPlayer } from '../types/room';

// A Firestore-only (Spark plan, no Cloud Functions/Realtime DB) stand-in
// for real presence: every connected client just writes "I'm still here"
// every HEARTBEAT_INTERVAL_MS. Anyone whose last heartbeat is older than
// AWAY_THRESHOLD_MS - a couple of missed beats' worth of tolerance for
// ordinary network jitter - is shown as away. There's no true "offline"
// detection (nothing fires the moment a tab actually closes), just this
// polling-by-writes approximation.
export const HEARTBEAT_INTERVAL_MS = 15_000;
// Doubled from the original 40s after early playtest feedback that the
// AFK system overall was too trigger-happy.
const AWAY_THRESHOLD_MS = 80_000;

/** True if this player's last heartbeat is stale enough to show as away. A player who's never sent one (joined before this existed, or hasn't had a chance to yet) is treated as present rather than immediately flagged away. */
export function isPlayerAway(player: RoomPlayer): boolean {
  if (player.isBot) return false;
  if (player.lastSeenAt === undefined) return false;
  return Date.now() - player.lastSeenAt > AWAY_THRESHOLD_MS;
}
