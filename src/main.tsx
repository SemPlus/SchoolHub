import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { AppDataProvider } from './context/AppData';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppDataProvider>
        <App />
      </AppDataProvider>
    </ErrorBoundary>
  </StrictMode>,
);
