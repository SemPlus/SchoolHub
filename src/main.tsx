import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
// First: catches the browser's install offer before anything else renders.
import './lib/install';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { AppDataProvider } from './context/AppData';
import ClassroomMode from './components/ClassroomMode';
import { AULA_PREFIX } from './lib/aula';
import LegalPage from './components/LegalPage';
import { legalPageFor } from './lib/legal';
import SchoolsPage from './components/SchoolsPage';
import DemoPanelPage from './components/DemoPanelPage';
import { DEMO_PANEL_PATH } from './lib/demo';
import './fonts';
import './index.css';
import { applyReadability, loadReadability } from './lib/readability';

// Readability options chosen on this device (own profile → Readability), before the first paint.
applyReadability(loadReadability());

const legalPage = legalPageFor(window.location.pathname);
const path = window.location.pathname.replace(/\/+$/, '') || '/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {/* Legal pages (/legal/privacy…), the page for schools (/scuole, /scuole/demo) and
          classroom links (/aula/SCHOOL-4G): their own screens, no sign-in, none of the app's data loading */}
      {legalPage ? (
        <LegalPage page={legalPage} />
      ) : path === '/scuole' ? (
        <SchoolsPage />
      ) : path === DEMO_PANEL_PATH ? (
        <DemoPanelPage />
      ) : window.location.pathname.startsWith(AULA_PREFIX) ? (
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
