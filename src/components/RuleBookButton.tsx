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
      "Every comrade begins equal: 1000 Roubles and a secret Piece, its Special Power and Win Condition sealed until you've actually claimed it. Acquire property in the name of the People, collect what's owed to you, and complete your Collections. The instant the Piece Pool runs dry - every Piece either claimed or struck from the record for good - the Endgame begins.",
    ],
  },
  {
    title: 'II. Taking Your Turn',
    body: [
      "Roll two dice and advance that many spaces clockwise. Doubles earn you the State's favor - roll again immediately - but favor has its limits: three doubles total, in a row or spread across the whole match, and the State decides you've been moving too freely. Straight to jail, no further movement.",
    ],
  },
  {
    title: 'III. Properties & Rent',
    body: [
      "Land on unclaimed property or a railroad and it's yours for the taking, provided you can afford it. Land on ground someone else has already claimed and you owe them Rent for the privilege - more if they hold the entire Collection, more still if they've built housing or a hotel on it.",
    ],
  },
  {
    title: 'IV. Jail',
    body: [
      "The Go To Jail tile, three doubles, an unpaid debt (Destitute), or any number of cards can land you behind bars. Rolling doubles on your own turn is the only way to actually walk free. Until then, the guards don't work for nothing - a 100-Rouble Bribe every turn just to stay put and stay alive. Run out of Roubles to pay it and you Disappear instead.",
    ],
  },
  {
    title: 'V. House Rules',
    body: [
      "This edition adds a Hoarding Limit: no honest worker comes by over 1000 Roubles honestly. Cross that line and the State suspects you've been hoarding illegally - you're hauled in for questioning, jailed on suspicion, and you won't be released by any means while you're still over the limit. The mirror image is Destitute: turn up with exactly 0 Roubles and you look just as suspicious - questioned and jailed all the same.",
    ],
  },
  {
    title: 'VI. Cards',
    body: [
      "Land on a Communist Test or No Chance space and click the pile - the State has prepared something for you. Could be a windfall, could be a summons. Draw it and find out.",
    ],
  },
  {
    title: 'VII. The West',
    body: [
      "Land on Free Parking, or on a property you already hold, and you may Smuggle Roubles out to the West - beyond the State's reach, for now. It isn't safe until you've made a full lap of the board since; and it's never safe if your Piece Disappears, or if another comrade reaches Free Parking before you complete that lap.",
    ],
  },
  {
    title: 'VIII. Disappearing',
    body: [
      "Fail to pay what you owe, draw the wrong card, run afoul of the wrong tile - and your Piece Disappears. Everything you held is Seized by the State. If the Piece Pool still has something to offer, you're issued a replacement Piece and 1000 fresh Roubles to start again. If the Pool is empty, there's nothing left to issue - you're out for good, watching the rest of the match unfold.",
    ],
  },
  {
    title: 'IX. The Endgame',
    body: [
      "Once the Piece Pool has nothing left to give out, every comrade still standing gets one final turn. Then the books are settled: each Piece's own Win Condition is calculated - some reward Roubles, some steal from a neighbor, some flip everything on its head, rules only revealed now. Whoever the State judges to have served best - the highest Score - wins.",
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
