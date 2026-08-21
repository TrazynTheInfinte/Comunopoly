import { useState, type FormEvent } from 'react';
import { NKVD_QUESTIONS } from '../data/nkvdQuestions';
import { answerNkvdQuizAndSync } from '../lib/gameSync';
import type { GameState } from '../types/game';

interface NkvdQuizPromptProps {
  questionIndex: number;
  roomCode: string;
  game: GameState;
}

function NkvdQuizPrompt({ questionIndex, roomCode, game }: NkvdQuizPromptProps) {
  const [answer, setAnswer] = useState('');
  const question = NKVD_QUESTIONS[questionIndex];

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void answerNkvdQuizAndSync(roomCode, game, answer);
  }

  return (
    <form className="purchase-prompt card-prompt" onSubmit={handleSubmit}>
      <p className="card-title">NKVD</p>
      <p>{question.question}</p>
      <input
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        placeholder="Your answer..."
        autoFocus
      />
      <button type="submit">Answer</button>
    </form>
  );
}

export default NkvdQuizPrompt;
