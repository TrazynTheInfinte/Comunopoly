/// <reference types="vite/client" />

// Augments Vite's built-in ImportMetaEnv type with our own VITE_* variables,
// so `import.meta.env.VITE_FIREBASE_API_KEY` etc. is type-checked and
// autocompletes instead of being typed `any`.
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected by vite.config.ts's `define` at build time - the short git
// commit hash the running code was built from.
declare const __BUILD_SHA__: string;
