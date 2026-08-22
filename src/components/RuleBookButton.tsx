import { useState } from 'react';
import './RuleBookButton.css';

interface RuleBookSection {
  title: string;
  body: string[];
}

// Deliberately a condensed quick-reference, not the full rules PDF - the
// core loop plus this project's own house rules, but no per-Piece
// Special Power/Win Condition list (those stay a surprise until you've
// actually picked one - see LobbyScreen/PieceInfoPanel) and no full
// card list (drawing one is the whole point).
const SECTIONS: RuleBookSection[] = [
  {
    title: 'I. The Goal',
    body: [
      "Every player starts with 1000 Roubles and a secret Piece - each with its own hidden Special Power and Win Condition, revealed once you've actually picked it. Buy properties, collect Rent, and build up Collections. Once the Piece Pool runs dry (every Piece is either in play or permanently retired), the Endgame begins.",
    ],
  },
  {
    title: 'II. Taking Your Turn',
    body: [
      "Roll two dice and move that many spaces clockwise. Rolling doubles lets you roll again immediately - but roll three doubles total (they don't have to be in a row) and you're sent straight to jail instead of moving.",
    ],
  },
  {
    title: 'III. Properties & Rent',
    body: [
      "Land on an unowned property or railroad and you can buy it. Land on one someone else owns and you owe them Rent - more if they own the whole Collection, more still if they've built houses or a hotel on it.",
    ],
  },
  {
    title: 'IV. Jail',
    body: [
      "You can end up in jail from the Go To Jail tile, three cumulative doubles, several cards, or being unable to afford a debt (Destitute). Get out by paying a 100-Rouble Bribe at the end of each turn you're still in, or by rolling doubles on your turn.",
    ],
  },
  {
    title: 'V. House Rules',
    body: [
      "This edition adds a Hoarding Limit: end up with over 1000 Roubles and you're sent straight to jail - and you can't leave jail by any means while you're still over it. The mirror image is Destitute: hit exactly 0 Roubles and the same thing happens.",
    ],
  },
  {
    title: 'VI. Cards',
    body: [
      'Land on a Communist Test or No Chance space and click the pile to draw - anything from a windfall to a trip to jail.',
    ],
  },
  {
    title: 'VII. The West',
    body: [
      "Land on Free Parking (or on your own property) and you can Smuggle Roubles into your West stash, safe from an opponent - unless you Disappear, or someone else lands on Free Parking before you make it back around the board.",
    ],
  },
  {
    title: 'VIII. Disappearing',
    body: [
      "Can't pay a debt, fail a card, whatever the cause - and your Piece Disappears: everything's Seized by the State, and you pick a fresh Piece from the Piece Pool and start again with 1000 Roubles. If the Pool's already empty, you're out for good, spectating the rest of the match.",
    ],
  },
  {
    title: 'IX. The Endgame',
    body: [
      "Once the Piece Pool has no Pieces left to hand out, everyone still playing gets exactly one final turn. Then each Piece's own Win Condition is calculated - some reward Roubles, some steal from a neighbor, some flip everything on its head. Whoever ends up with the highest Score wins.",
    ],
  },
];

function RuleBookButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="rule-book-toggle" onClick={() => setOpen(true)}>
        📖 Rule Book
      </button>

      {open && (
        <div className="rule-book-overlay" onClick={() => setOpen(false)}>
          <div className="rule-book" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="rule-book-close"
              onClick={() => setOpen(false)}
              aria-label="Close rule book"
            >
              ✕
            </button>

            <p className="rule-book-eyebrow">A Spectre Is Haunting the Board...</p>
            <h1 className="rule-book-title">Rules of Comunopoly</h1>

            <div className="rule-book-sections">
              {SECTIONS.map((section) => (
                <section key={section.title}>
                  <h2>{section.title}</h2>
                  {section.body.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </section>
              ))}
            </div>

            <p className="rule-book-closing">Comrades of All Boards, Unite!</p>
          </div>
        </div>
      )}
    </>
  );
}

export default RuleBookButton;
