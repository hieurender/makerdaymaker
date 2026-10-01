import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  if (response.status === 401 && (await response.clone().json().catch(() => ({}))).code === 'token_expired') {
    window.location.reload();
  }
  return response;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
