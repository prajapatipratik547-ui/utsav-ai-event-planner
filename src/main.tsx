import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { AnnouncerProvider, PlansProvider } from './state/PlansContext.js';
import './styles.css';

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
