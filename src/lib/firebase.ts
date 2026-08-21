import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// This config identifies which Firebase project we're talking to. It's
// safe to ship in the built JS bundle (anyone can see it in devtools) -
// it is NOT a secret credential. What actually protects your data is the
// Firestore security rules configured in the Firebase console, not the
// secrecy of these values. See docs/adr/0001-client-authoritative-sync.md
// for why we're relying on rules + trust instead of a validating server.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Firestore is the database: game state lives in documents (one per
// Room), and every player's browser subscribes to that document so
// everyone's screen updates together in real time.
export const db = getFirestore(app);
