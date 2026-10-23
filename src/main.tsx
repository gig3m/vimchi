import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LESSONS } from './lessons';
import { parseKeys } from './vim/keys';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Dev only: the visual harness (scripts/look.mjs) reads rounds and solutions from here.
if (import.meta.env.DEV) (window as unknown as { __vimchi: object }).__vimchi = { LESSONS, parseKeys };
