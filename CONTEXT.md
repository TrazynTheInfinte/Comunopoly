# Comunopoly

A browser-based, rules-enforcing remake of *Comunopoly*, a communist-themed Monopoly variant. This file is the glossary for the game's domain vocabulary — the fictional/rules concepts, not the software architecture.

## Language

### Ruleset

**Ruleset**:
Set once by the host at room creation - which of the two games a Room actually plays. Independent of Room Mode (Piece assignment, "beginner"/"experienced"), which applies under either Ruleset.
_Avoid_: game mode, variant (use Ruleset for this specific choice, to keep it distinct from "Room Mode")

**Stalin Communism**:
The original Ruleset: the Piece Pool/Endgame/Score apparatus, and Disappearing wipes a player's assets and hands them a fresh Piece from the Pool. Everything in this glossary describes Stalin Communism unless a term's own entry says otherwise.

**Lenin Communism**:
The second Ruleset - closer to classic Monopoly. No Piece Pool or Score: the game ends in classic Bankruptcy (last player standing wins). Piece Special Powers are unchanged. Every Disappear trigger from Stalin Communism still triggers, but its consequence changes - see Fine, Bankruptcy, Insolvency Bailout, and Liquidation Choice below. Trading is available in both Rulesets.

**Fine**:
Lenin Communism only. What replaces a Disappear at every trigger except an unpayable jail Bribe (see Liquidation Choice): the player pays a fixed Rouble amount instead of losing everything, scaled to how severe the original trigger felt. If they can't afford the Fine, they're jailed for it exactly like any other unpayable debt (see Destitute) - not partially charged.

**Bankruptcy** / **Eliminated**:
Lenin Communism only. The real "lose" state, replacing Disappear's "pick a new Piece" outcome: the player is permanently out (reusing the same "permanently out, skipped in turn order forever" state a Stalin-mode Disappear-with-empty-Pool already uses), their properties/houses return to the bank, and their Roubles are simply gone - always to the bank, never to a specific creditor. The match ends the instant only one player is left un-Eliminated; that player wins.
_Avoid_: Disappear (a materially different consequence - no new Piece, no return to play)

**Insolvency Bailout**:
Lenin Communism only. What happens on a player's very next roll after being jailed for an unpayable debt (rent, a toll, an unaffordable Fine - not a STOY/GO fee, which doesn't exist in Lenin mode): rolling doubles escapes jail and pays out a 100-Rouble bailout; anything else is immediate Bankruptcy. A one-shot exception to jail's normal multi-attempt escape rules, used only for this specific kind of jailing.

**Liquidation Choice**:
Lenin Communism only. The one Disappear trigger that doesn't become a flat Fine: failing to afford the jail Bribe. The player is offered the choice of selling houses/mortgaging properties to try to cover it (or declaring Bankruptcy outright instead) - real Monopoly liquidation, rather than a Fine they may not be able to pay either.

**Trade**:
A player-to-player exchange of properties and/or Roubles, proposed to a specific player who accepts or declines - available in both Rulesets. Neither side can offer a property with houses on it (sell those first) or one exempt from ownership transfers (Chernobyl Power, a Siege of Stalingrad lock).

### Currency & the State

**Rouble**:
The in-game currency. All players start a piece's life with 1000.
_Avoid_: dollar, cash

**The State**:
The entity that confiscates a Disappeared player's Roubles, properties, and West stash, and that receives certain payments (e.g. Telegraph Union tolls, jail Bribes).
_Avoid_: bank, treasury, the house

**Seize / Seizure**:
The act of the State confiscating assets, either from a Disappearing player or via a card effect (e.g. Siege of Stalingrad permanently seizes a property).

**Bribe**:
The payment a jailed player must make at the end of each of their turns to avoid Disappearing (Stalin Communism) or facing a Liquidation Choice (Lenin Communism) - 100 Roubles in Stalin Communism, 50 in Lenin Communism (real Bankruptcy is already a harsher backstop, so the Bribe itself doesn't need to deter as much). Distinct from rolling doubles, which is how a player leaves jail outright.

**Hoarding Limit**:
Stalin Communism only. House rule: a player who ever ends up with over 1000 Roubles is sent straight to jail. This also blocks leaving jail by any means (rolling doubles, Denounce Your Collaborators, a Show Trial release) while still over the limit — it sends them straight back in instead. Mirrored at the bottom end by Destitute: hitting exactly 0 Roubles (even via a payment they could afford) has the same jailing/no-leaving-jail effect. Lenin Communism drops the over-1000 half entirely (Destitute still applies in both) — accumulating Roubles is the whole point of solving Lenin mode's "lack of money" problem, so a rule that jails you for having *too much* would work against that.

**Repeat Doubles**:
House rule: a player who rolls doubles three times total is sent to jail instead of moving on that third roll. Unlike classic Monopoly, these three doubles don't need to be consecutive or within the same turn — the count only resets when it actually triggers this jailing, or when the player Disappears. Every other route to jail (the Go To Jail tile, cards, NKVD, The Kremlin, etc.) leaves the count untouched.

### Pieces, players & the endgame

**Piece**:
One of the (eventually 15) selectable tokens a player plays as. Each Piece has a Title, a Special Power, and a Win Condition.
_Avoid_: token, character, avatar, mascot

**Title**:
The in-fiction name for a Piece's role (e.g. Boot's Title is "Member of the Proletariat").

**Special Power**:
A Piece's unique passive or triggered ability (e.g. Battleship's rail stations are half price).

**Win Condition**:
The Piece-specific scoring formula applied to that Piece's holder once the Endgame is reached. Formulas vary wildly per Piece — some multiply Roubles by property counts, some redistribute Score between players.
_Avoid_: victory condition, endgame condition (use Win Condition for the formula itself; Endgame for the phase)

**Score**:
The final tally computed by a Win Condition at the Endgame. Distinct from Roubles — Score is calculated once, at the end, and can move between players independently of in-game Roubles.
_Avoid_: points

**Disappear**:
Stalin Communism only. A Piece's permanent removal from play: its Roubles, properties, and West stash are all Seized by the State, and the human player who held it selects a new, unclaimed Piece from the Piece Pool and rejoins with a fresh 1000 Roubles. The old Piece is gone for good — "your old piece never existed." In Lenin Communism, the same triggers fire, but the consequence is a Fine or Bankruptcy instead — see the Ruleset section above.
_Avoid_: bankrupt, eliminated, lose, die, knocked out — none of these fit, since the human player keeps playing under a new Piece. (Lenin Communism's Bankruptcy/Eliminated is the real exception to this.)

**Destitute**:
The state of having run out of Roubles — either because a payment couldn't be afforded at all (the debt is forgiven), or because an affordable payment drained the player down to exactly 0. Either way sends the player to jail. In Stalin Communism, a precursor that can lead to Disappearing (if they can't pay the jail Bribe), but is not itself Disappearing. In Lenin Communism, being sent to jail this way triggers an Insolvency Bailout on the player's next roll instead of jail's normal escape rules.
_Avoid_: bankrupt (except when specifically discussing Lenin Communism, where it's the correct term)

**Piece Pool**:
The set of Pieces not currently claimed by an active player — available to be picked when a new player joins, or when a player Disappears and needs a replacement Piece.

**Endgame**:
The phase triggered once the Piece Pool has no unclaimed Pieces left to hand out. Win Conditions are then calculated for whichever Piece each remaining player currently holds. If a player Disappears after the Piece Pool is already empty (no replacement Piece available), they are out — they receive no Score and cannot win, but the game continues to Endgame for the remaining players.

### Board & tiles

**Smuggling**:
Moving Roubles into a player's West stash by landing on Free Parking or on a property that player owns.

**The West**:
A Piece's protected Rouble stash, seeded by Smuggling. Safe from being taken by an opponent only once its owner lands exactly back on the specific tile they Smuggled from (Free Parking, or - Penguin's power - whichever owned property) - merely passing through anywhere, even through STOY, doesn't count. By default, safe or not, it is fully Seized if the Piece Disappears. A room-level house rule (set at room creation, "Keep money in the West when you Disappear") can override this for every Disappear in that room, letting the West stash carry over into the player's next Piece instead.
_Avoid_: stash, savings, off-shore account

**STOY**:
Stalin Communism only. The renamed Go tile. Landing on it collects 200 Roubles; passing it costs 50 Roubles (a "bribe" to pass, distinct from the jail Bribe). Lenin Communism displays and plays this tile as GO instead - real Monopoly's actual rule (passing or landing both just pay out 200, no fee) rather than the inverted Stalin-mode version, and the display name changes too (see lib/leninText.ts) - solving Lenin mode's "lack of money" problem was the whole point.

**The Kremlin**:
The renamed Park Place tile ("Visit Stalin!"). First landing collects 200 Roubles; second landing sends the player to jail.

**NKVD Headquarters**:
The renamed Boardwalk tile. Escalates on repeat landings: 1st miss a turn, 2nd go to jail, 3rd Disappear.

**Chernobyl Nuclear Reactor**:
The renamed Electric Company tile. Forced ownership (whoever lands on it unowned must take it) with an explosion countdown tied to ownership of the Volga — see the rules PDF for the full interaction.

**The Volga**:
The renamed Water Works tile. Can only be acquired by giving away all of a player's properties; its owner can force anyone who lands on it to hand over all their properties (or, if they have none, receive the Volga instead).

### Cards

**Communist Test**:
One of the two special-card decks (12 cards, plus 5 Trotsky-reveal prop cards used only by the Fourth International card). Canonical card list confirmed from `CommunistTest.pdf` + `CommunistTest2.pdf`.

**No Chance**:
The other special-card deck (10 cards). Canonical card list confirmed from `NoChance1.pdf`.
_Note: cards from the older `rulesPrintable.pdf` list that don't appear in either labeled deck (Party Favor, Proper Permits, Seige of Leningrad, Chinese Delegation, Five Year Plan, Congress of People's Deputies, Nikolai Semashko, US Cultural Exchange, Inheritence, You've Been Noticed By Stalin, Communism is Socialism + Electricity, Pravada Editorial) are dropped — the two labeled PDFs are the official source._

**Collection**:
A complete set of same-color properties.
_Avoid_: monopoly, color group, set

### Multiplayer

**Room**:
A single multiplayer game session, identified by a Room Code, that players join by entering a display name — no account required.

**Room Code**:
The short shareable code identifying a Room.

**Bot**:
A computer-controlled player, added by the host in the Lobby (before Start Game) with a chosen Difficulty, to help fill out a Room. Driven entirely by the host's own browser (lib/botAi.ts, useBotDriver) - there's no server to run it independently, so if the host disconnects, every Bot in that Room freezes until they reconnect. Gets a random unclaimed Piece immediately, like Experienced Room Mode, regardless of the Room's actual mode. Never proposes or responds to a Trade, accuses anyone of being Trotsky, or votes in a Show Trial - deliberately out of scope, since none of those block the game from continuing.

**Difficulty**:
Chosen per Bot when it's added: Easy, Normal, or Hard. Changes only the heuristics behind a Bot's decisions (cash buffers before buying/building, how much to Smuggle, whether to target the richest opponent) - every Difficulty still resolves every decision a real player could face. Some decisions stay random at every Difficulty regardless (which specific card to draw, NKVD's trivia answer, which new Piece to pick after Disappearing) - there's no meaningful way for a Bot to "know" the right answer to those.
