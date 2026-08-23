export interface NkvdQuestion {
  question: string;
  answer: string;
  /** Wrong answers shown alongside the correct one - NkvdQuizPrompt renders these plus `answer` as a dropdown rather than a free-text field, so answering doesn't come down to guessing exact wording/spelling. */
  distractors: string[];
}

// Add more questions here any time - NKVD's card draw picks one at
// random from this list.
export const NKVD_QUESTIONS: NkvdQuestion[] = [
  {
    question:
      'What actor, known as "The Duke," appeared in the movie True Grit?',
    answer: 'John Wayne',
    distractors: ['Clint Eastwood', 'Gary Cooper', 'Henry Fonda'],
  },
  {
    question: "What was John Wayne's real name?",
    answer: 'Marion Robert Morrison',
    distractors: ['Charles Carter', 'Robert Wayne Morrison', 'Leonard Slye'],
  },
  {
    question: "What is John Wayne's character's name in Sands of Iwo Jima?",
    answer: 'Sgt. Striker',
    distractors: ['Cpl. Hicks', 'Lt. Dan', 'Sgt. Rock'],
  },
  {
    question: 'What did Stalin like to do in his free time?',
    answer: 'Reading',
    distractors: ['Painting', 'Chess', 'Gardening'],
  },
  {
    question: 'What is the foundational text of our scientific worldview?',
    answer: 'The Communist Manifesto',
    distractors: ['Das Kapital', 'The Little Red Book', 'War and Peace'],
  },
  {
    question:
      'Who is the supreme architect of the Soviet state and the guide for global revolution?',
    answer: 'Josef Stalin',
    distractors: ['Vladimir Lenin', 'Leon Trotsky', 'Nikita Khrushchev'],
  },
  {
    question:
      'What is your view on private property and the means of production?',
    answer:
      'Private property must be abolished. The state must own all factories, land, and resources on behalf of the people.',
    distractors: [
      'Private property is a natural right that must be protected.',
      'The state should stay out of economic matters entirely.',
      'Property should be owned by local communes, not the state.',
    ],
  },
];
