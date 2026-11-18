import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
// First: catches the browser's install offer before anything else renders.
import './lib/install';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { AppDataProvider } from './context/AppData';
import ClassroomMode from './components/ClassroomMode';
import { AULA_PREFIX } from './lib/aula';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Classroom link (/aula/SCHOOL-4G): its own screen, no sign-in, none of the app's data loading */}
      {window.location.pathname.startsWith(AULA_PREFIX) ? (
        <ClassroomMode />
      ) : (
        <AppDataProvider>
          <App />
        </AppDataProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
);

// Installed app: keep working without a connection (production builds only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => console.warn('Service worker registration failed:', error));
  });
}
