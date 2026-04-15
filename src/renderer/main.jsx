import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

function render() {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

if (typeof window !== 'undefined' && typeof window.electronAPI === 'undefined') {
  import('./web/browser.js').then(({ browserAPI }) => {
    window.electronAPI = browserAPI;
    render();
  });
} else {
  render();
}
