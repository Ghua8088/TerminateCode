import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from 'pytron-ui/react'

const themes = {
  'vs-dark': {
    bg: '#1e1e1e',           // Main Window Background
    fg: '#cccccc',           // Main Text Color
    primary: '#0078d4',      // Primary Action Color (Grid, Buttons)
    primaryFg: '#ffffff',    // Text on Primary
    secondary: '#333333',    // Secondary Background (Hover states, etc)
    surface: '#252526',      // Panels, Menus, Dialogs
    border: '#333333',       // Borders
    danger: '#e81123',       // Destructive actions
    success: '#107c10',      // Success states
    warning: '#d83b01',      // Warning states
  },
  'light': {
    bg: '#ffffff',
    fg: '#000000',
    primary: '#005a9e',
    primaryFg: '#ffffff',
    secondary: '#f3f2f1',
    surface: '#faf9f8',
    border: '#edebe9',
    danger: '#d13438',
    success: '#107c10',
    warning: '#ff8c00',
  },
  'high-contrast': {
    bg: '#000000',
    fg: '#ffffff',
    primary: '#ffffff',
    primaryFg: '#000000',
    secondary: '#3c3c3c',
    surface: '#1f1f1f',
    border: '#ffffff',
    danger: '#ff0000',
    success: '#00ff00',
    warning: '#ffff00',
  }
};

const resizeObserverMessages = [
  'ResizeObserver loop completed with undelivered notifications.',
  'ResizeObserver loop limit exceeded',
];

const handleWindowError = (event) => {
  if (resizeObserverMessages.some(msg => event?.message?.includes(msg))) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
};

const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args[0]?.message || args[0] || '';
  if (typeof message === 'string' && resizeObserverMessages.some(msg => message.includes(msg))) {
    return;
  }
  originalConsoleError(...args);
};

window.addEventListener('error', handleWindowError);

const Main = () => {
  const [currentTheme, setCurrentTheme] = useState('vs-dark');

  return (
    <StrictMode>
      <ThemeProvider theme={themes[currentTheme]}>
        <App currentTheme={currentTheme} onThemeChange={setCurrentTheme} />
      </ThemeProvider>
    </StrictMode>
  );
};

createRoot(document.getElementById('root')).render(<Main />);
