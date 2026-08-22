import { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  durationMs?: number;
}

/**
 * Counts up/down to a new value instead of snapping instantly - used
 * anywhere a rouble amount changes, so a payment/payout reads as
 * something actually happening rather than a number silently being
 * different on the next render.
 *
 * `currentRef` tracks whatever's currently on screen (not just the
 * value an animation started from) so an interruption - a second
 * payment landing mid-count - restarts smoothly from there instead of
 * snapping back to the previous animation's start point.
 */
function AnimatedNumber({ value, durationMs = 600 }: AnimatedNumberProps) {
  const [displayed, setDisplayed] = useState(value);
  const currentRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (currentRef.current === value) return;
    const from = currentRef.current;
    const to = value;
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(from + (to - from) * eased);
      currentRef.current = next;
      setDisplayed(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, durationMs]);

  return <>{displayed}</>;
}

export default AnimatedNumber;
