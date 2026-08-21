import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Missing #root element in index.html');
}

// createRoot hands React the real DOM node it's allowed to control.
// From here on, React (not us) decides when and how to update the page -
// we just describe what things should look like via <App />, and React
// figures out the actual DOM changes needed to match.
createRoot(rootElement).render(
  // StrictMode is a development-only helper: it deliberately double-runs
  // some code to help surface bugs (e.g. code that isn't safe to run
  // twice). It has zero effect on the production build.
  <StrictMode>
    <App />
  </StrictMode>,
);
