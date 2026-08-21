export interface NkvdQuestion {
  question: string;
  answer: string;
}

// Add more questions here any time - NKVD's card draw picks one at
// random from this list.
export const NKVD_QUESTIONS: NkvdQuestion[] = [
  {
    question:
      'What actor, known as "The Duke," appeared in the movie True Grit?',
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
  {
    question: 'What did Stalin like to do in his free time?',
    answer: 'Reading',
  },
  {
    question: 'What is the foundational text of our scientific worldview?',
    answer: 'The Communist Manifesto',
  },
  {
    question:
      'Who is the supreme architect of the Soviet state and the guide for global revolution?',
    answer: 'Josef Stalin',
  },
  {
    question:
      'What is your view on private property and the means of production?',
    answer:
      'Private property must be abolished. The state must own all factories, land, and resources on behalf of the people.',
  },
];
