# Comunopoly

A browser-based, rules-enforcing remake of *Comunopoly*, a communist-themed Monopoly variant. This file is the glossary for the game's domain vocabulary — the fictional/rules concepts, not the software architecture.

## Language

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
The 100-Rouble payment a jailed player must make at the end of each of their turns to avoid Disappearing. Distinct from rolling doubles, which is how a player leaves jail outright.

**Hoarding Limit**:
House rule: a player who ever ends up with over 1000 Roubles is sent straight to jail. This also blocks leaving jail by any means (rolling doubles, Denounce Your Collaborators, a Show Trial release) while still over the limit — it sends them straight back in instead.

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
A Piece's permanent removal from play: its Roubles, properties, and West stash are all Seized by the State, and the human player who held it selects a new, unclaimed Piece from the Piece Pool and rejoins with a fresh 1000 Roubles. The old Piece is gone for good — "your old piece never existed."
_Avoid_: bankrupt, eliminated, lose, die, knocked out — none of these fit, since the human player keeps playing under a new Piece.

**Destitute**:
The state of having run out of Roubles. Sends the player to jail. A precursor that can lead to Disappearing (if they can't pay the jail Bribe), but is not itself Disappearing.
_Avoid_: bankrupt

**Piece Pool**:
The set of Pieces not currently claimed by an active player — available to be picked when a new player joins, or when a player Disappears and needs a replacement Piece.

**Endgame**:
The phase triggered once the Piece Pool has no unclaimed Pieces left to hand out. Win Conditions are then calculated for whichever Piece each remaining player currently holds. If a player Disappears after the Piece Pool is already empty (no replacement Piece available), they are out — they receive no Score and cannot win, but the game continues to Endgame for the remaining players.

### Board & tiles

**Smuggling**:
Moving Roubles into a player's West stash by landing on Free Parking or on a property that player owns.

**The West**:
A Piece's protected Rouble stash, seeded by Smuggling. Safe from being taken by an opponent once its owner has completed one full lap of the board since smuggling it; safe or not, it is always fully Seized if the Piece Disappears.
_Avoid_: stash, savings, off-shore account

**STOY**:
The renamed Go tile. Landing on it collects 200 Roubles; passing it costs 50 Roubles (a "bribe" to pass, distinct from the jail Bribe).

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
