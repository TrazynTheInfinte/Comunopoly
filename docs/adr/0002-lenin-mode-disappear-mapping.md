# Lenin Communism: Disappear becomes a Fine, Bankruptcy, or a Liquidation Choice - never a new Piece

Lenin Communism (the second Ruleset, alongside the original Stalin Communism) plays closer to classic Monopoly: no Piece Pool, no Score - the game ends in classic bankruptcy, last player standing. That's incompatible with Stalin mode's "Disappear" consequence, which assumes a Piece Pool exists to hand the player a replacement from.

Rather than removing the ~11 triggers that currently call Disappear (NKVD repeat visits, Great Purge, Bestseller, "an accident", Phone Call from Stalin, getting caught smuggling at Free Parking, Go Into Hiding discovery, rolling a 1 in jail, a Show Trial "Disappear" verdict, a correct Trotsky accusation, and an unpayable jail Bribe), every one of them still fires in Lenin mode - only the consequence changes:

- Ten of the eleven become a **Fine**: a fixed Rouble amount (roughly 200-500, scaled to how severe the trigger felt) instead of a full asset wipe. If the player can't afford it, they're jailed for it exactly like any other unpayable debt - not partially charged.
- The eleventh - an unpayable jail Bribe - gets a **Liquidation Choice** instead: sell houses, mortgage properties, or give up and declare Bankruptcy. This one is different because, unlike the others, it's already a real insolvency check (can they pay 100 Roubles or not?), which is exactly what classic Monopoly's bankruptcy liquidation step is for.
- Any unpayable debt in Lenin mode (rent, a STOY fee, a toll, an unaffordable Fine) sends the player to jail flagged for an **Insolvency Bailout**: their very next roll is one-shot - doubles escapes jail and pays a 100-Rouble lifeline, anything else is immediate Bankruptcy. This replaces jail's normal multi-attempt escape rules only for this specific kind of jailing.

We chose to keep every trigger rather than pruning the ones that feel Stalin-flavored (Trotsky hunts, NKVD, the Great Purge) because the user explicitly wanted them kept - Lenin mode swaps the ending, not the flavor of getting there. The fine amounts and the bailout mechanic's exact shape (one roll, not jail's usual multiple attempts) were worked out directly with the user rather than invented wholesale; see the plan this ADR accompanies for the full grilling trail.

If Lenin mode's fine amounts turn out to be poorly tuned in practice (too easy to shrug off, or too punishing), they're plain named constants at the top of `game/engine.ts` (`LENIN_FINE_*`) - safe to retune without touching any of the trigger call sites.
