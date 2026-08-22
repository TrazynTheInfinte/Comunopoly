import { useEffect } from 'react';
import { HEARTBEAT_INTERVAL_MS } from '../lib/presence';
import { sendHeartbeat } from '../lib/rooms';

/** Sends "I'm still here" for this player on an interval, for as long as this is mounted - see lib/presence.ts for how that's turned into an away indicator on everyone else's screen. Fires once immediately on mount too, rather than waiting a full interval for the first one. */
export function usePresenceHeartbeat(roomCode: string, playerId: string): void {
  useEffect(() => {
    sendHeartbeat(roomCode, playerId);
    const interval = setInterval(() => sendHeartbeat(roomCode, playerId), HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [roomCode, playerId]);
}
