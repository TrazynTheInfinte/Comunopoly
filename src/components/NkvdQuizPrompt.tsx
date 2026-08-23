import { useState, type FormEvent } from 'react';
import { NKVD_QUESTIONS } from '../data/nkvdQuestions';
import { answerNkvdQuizAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';

interface NkvdQuizPromptProps {
  questionIndex: number;
  roomCode: string;
  game: GameState;
}

// Fisher-Yates - a plain module-level function (not from game/engine.ts's
// own seeded `shuffle`, which needs a deterministic rng for replay/sync;
// this is purely local display order, never written to GameState).
function shuffled<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function NkvdQuizPrompt({ questionIndex, roomCode, game }: NkvdQuizPromptProps) {
  const question = NKVD_QUESTIONS[questionIndex];
  // Shuffled once per question (not on every re-render), so the correct
  // answer isn't always in the same slot but the options don't jump
  // around while the player is still deciding.
  const [options] = useState(() => shuffled([question.answer, ...question.distractors]));
  const [answer, setAnswer] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!answer) return;
    void answerNkvdQuizAndSync(roomCode, game, answer);
  }

  return (
    <form className="purchase-prompt card-prompt" onSubmit={handleSubmit}>
      <p className="card-title">NKVD</p>
      <p>{question.question}</p>
      <select value={answer} onChange={(event) => setAnswer(event.target.value)} autoFocus>
        <option value="" disabled>
          Choose an answer...
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <button type="submit" disabled={!answer}>
        Answer
      </button>
    </form>
  );
}

export default NkvdQuizPrompt;
