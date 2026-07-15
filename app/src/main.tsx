import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import { store } from './state/useStore';
import './styles.css';

// Debug/automation hook: lets the console (and smoke tests) inspect the store.
(window as unknown as { hasiStore: typeof store }).hasiStore = store;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
