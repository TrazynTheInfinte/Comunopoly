import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves a project site (not a user/org site) from
  // https://<user>.github.io/<repo-name>/, so every built asset URL needs
  // that repo name prefixed, or the deployed page loads a blank screen.
  base: '/Comunopoly/',
});
