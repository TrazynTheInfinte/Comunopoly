import type { RulesetMode } from '../types/room';

/**
 * Lenin mode is meant to feel closer to real Monopoly - "STOY" (the
 * Stalin-mode renamed Go tile) reads as GO there instead. Board/card
 * text itself stays Soviet-flavored either way (only this one tile's
 * name changes) - this is purely a display-time substitution, not a
 * different tile or a change to engine.ts, which still logs/knows it
 * as STOY internally regardless of ruleset.
 */
export function leninizeText(text: string, rulesetMode: RulesetMode): string {
  if (rulesetMode !== 'lenin') return text;
  return text.replace(/\bSTOY\b/g, 'GO');
}
