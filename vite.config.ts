import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

// Reads the current commit hash at build time, so the deployed site can
// display exactly which commit it was built from - no manual version
// bumping to forget. Falls back to 'dev' if git isn't available for some
// reason (e.g. a build outside a git checkout).
function getBuildSha(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves a project site (not a user/org site) from
  // https://<user>.github.io/<repo-name>/, so every built asset URL needs
  // that repo name prefixed, or the deployed page loads a blank screen.
  base: '/Comunopoly/',
  define: {
    __BUILD_SHA__: JSON.stringify(getBuildSha()),
  },
});
