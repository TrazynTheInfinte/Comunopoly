import { useState } from 'react';
import { PROPAGANDA_ADS } from '../data/propagandaAds';

interface PropagandaAdProps {
  turnCount: number;
}

/**
 * Fills the propaganda-banner slot (see GameBoard.css) that used to be
 * one static image - now rotates through PROPAGANDA_ADS, picking one by
 * turnCount so every viewer sees the same ad at the same time, and it
 * changes each time the turn actually passes to someone else. Falls
 * back to nothing (rather than a broken-image icon) if a given ad's
 * file hasn't actually been dropped into public/images/ads/ yet.
 */
function PropagandaAd({ turnCount }: PropagandaAdProps) {
  // Tracks the specific file that failed to load, not just a plain
  // boolean - otherwise one missing ad image would keep hiding every
  // ad that rotates in after it, even ones whose files are fine.
  const [brokenFile, setBrokenFile] = useState<string | null>(null);
  const ad = PROPAGANDA_ADS[turnCount % PROPAGANDA_ADS.length];

  if (!ad || brokenFile === ad.file) return null;

  return (
    <img
      key={ad.file}
      className="propaganda-banner"
      src={`${import.meta.env.BASE_URL}images/ads/${ad.file}`}
      alt={ad.alt}
      onError={() => setBrokenFile(ad.file)}
    />
  );
}

export default PropagandaAd;
