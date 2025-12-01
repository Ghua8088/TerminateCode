import React, { useState, useCallback, useEffect, Suspense } from 'react';

import Sidebar from './components/Sidebar';
const CodeEditor = React.lazy(() => import('./components/Editor'));
import TabsBar from './components/TabsBar';
import StatusBar from './components/StatusBar';
import CommandPalette from './components/CommandPalette';
import './App.css';

import TerminalPanel from './components/TerminalPanel';

import SettingsModal from './components/SettingsModal';

function App() {
  const [openFiles, setOpenFiles] = useState([]);
  const [activePath, setActivePath] = useState(null);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, column: 1 });
  const [showPalette, setShowPalette] = useState(false);
  const [showTerminal, setShowTerminal] = useState(true);
  const [pendingCommand, setPendingCommand] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ fontSize: 14 });

  const openFile = useCallback((file) => {
    console.log('[App] openFile called', file.path);
    setOpenFiles((prev) => {
      const exists = prev.find((f) => f.path === file.path);
      const next = exists ? prev : [...prev, file];
      console.log('[App] openFile - next openFiles:', next.map(f => f.path));
      setActivePath(file.path);
      return next;
    });
  }, []);

  const closeFile = useCallback((path) => {
    console.log('[App] closeFile called', path);
    setOpenFiles((prev) => {
      const next = prev.filter((f) => f.path !== path);
      console.log('[App] closeFile - next openFiles:', next.map(f => f.path));
      setActivePath((curr) => {
        if (curr !== path) return curr;
        return next.length > 0 ? next[next.length - 1].path : null;
      });
      return next;
    });
  }, []);

  const handleRun = useCallback(() => {
    if (!activePath) return;

    let command = '';
    if (activePath.endsWith('.py')) {
      command = `python "${activePath}"`;
    } else if (activePath.endsWith('.js')) {
      command = `node "${activePath}"`;
    } else {
      console.log('Unknown file type for running');
      return;
    }

    setPendingCommand(command);
    setShowTerminal(true);
  }, [activePath]);

  useEffect(() => {
    console.log('[App] activePath changed', activePath);
  }, [activePath]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowPalette((s) => !s);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '`') { // Toggle terminal
        e.preventDefault();
        setShowTerminal((s) => !s);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') { // Settings
        e.preventDefault();
        setShowSettings(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#1e1e1e', color: '#ccc' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar onFileOpen={openFile} onOpenSettings={() => setShowSettings(true)} activePath={activePath} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TabsBar
            files={openFiles}
            activePath={activePath}
            onActivate={(p) => setActivePath(p)}
            onClose={closeFile}
            onRun={handleRun}
          />
          <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }}>
            <Suspense fallback={<div style={{ padding: 16, color: '#ccc' }}>Loading editor...</div>}>
              <CodeEditor activePath={activePath} onCursorChange={setCursorInfo} fontSize={settings.fontSize} />
            </Suspense>
          </div>
          {showTerminal && (
            <TerminalPanel
              onClose={() => setShowTerminal(false)}
              pendingCommand={pendingCommand}
              onCommandHandled={() => setPendingCommand(null)}
            />
          )}
          <StatusBar cursor={cursorInfo} onToggleTerminal={() => setShowTerminal(s => !s)} />
        </div>
      </div>
      {showPalette && <CommandPalette onOpen={(file) => { openFile(file); setShowPalette(false); }} onClose={() => setShowPalette(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} settings={settings} onUpdateSettings={setSettings} />}
    </div>
  );
}

export default App;
