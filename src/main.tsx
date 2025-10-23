import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { SimulationProvider } from './state/SimulationContext';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <SimulationProvider>
        <App />
      </SimulationProvider>
    </React.StrictMode>
  );
}

