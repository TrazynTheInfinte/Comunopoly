export interface NkvdQuestion {
  question: string;
  answer: string;
}

// Add more questions here any time - NKVD's card draw picks one at
// random from this list.
export const NKVD_QUESTIONS: NkvdQuestion[] = [
  {
    question: 'What actor, known as "The Duke," appeared in the movie True Grit?',
    answer: 'John Wayne',
  },
  {
    question: "What was John Wayne's real name?",
    answer: 'Marion Robert Morrison',
  },
  {
    question: "What is John Wayne's character's name in Sands of Iwo Jima?",
    answer: 'Sgt. Striker',
  },
];
