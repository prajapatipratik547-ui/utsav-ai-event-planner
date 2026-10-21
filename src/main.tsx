import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { AnnouncerProvider, PlansProvider } from './state/PlansContext.js';
import './styles.css';

// Web fonts are attached after first paint so they never block rendering;
// `display=swap` shows text in the fallback font until they arrive.
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
const fonts = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: FONTS_URL });
document.head.append(fonts);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <AnnouncerProvider>
      <PlansProvider>
        <App />
      </PlansProvider>
    </AnnouncerProvider>
  </StrictMode>,
);
