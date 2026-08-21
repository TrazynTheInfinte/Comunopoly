import { defineConfig } from 'vitest/config';

// A separate config from vite.config.ts on purpose: the app build needs
// the React plugin and GitHub Pages base path, neither of which tests
// (which run in plain Node, not a browser) have any use for.
export default defineConfig({
  test: {
    environment: 'node',
  },
});
