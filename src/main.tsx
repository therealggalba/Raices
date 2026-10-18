import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fonts are bundled (no Google Fonts request): works offline inside the APK.
import '@fontsource-variable/inter';
import './styles/global.scss';
import App from './App.tsx';
import { applySeason } from './utils/season';

// The colours follow the season (checked again every hour, in case the app
// stays open across the change).
applySeason();
setInterval(() => applySeason(), 60 * 60 * 1000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
