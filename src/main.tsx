import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fonts are bundled (no Google Fonts request): works offline inside the APK.
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './styles/global.scss';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
