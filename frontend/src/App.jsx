import React, { useState, useCallback, useEffect, Suspense } from 'react';

import Sidebar from './components/Sidebar';
const CodeEditor = React.lazy(() => import('./components/Editor'));
import TabsBar from './components/TabsBar';
import StatusBar from './components/StatusBar';
import CommandPalette from './components/CommandPalette';
import WebPreview from './components/WebPreview';
import RegexLab from './components/RegexLab';
import CodeMetrics from './components/CodeMetrics';
import ImportLens from './components/ImportLens';
import BytecodeViewer from './components/BytecodeViewer';
import './App.css';
import { TitleBar, MenuBar, ToastProvider, useToast } from 'pytron-ui';
import pytron from 'pytron-client'; 
import TerminalPanel from './components/TerminalPanel';
import SettingsModal from './components/SettingsModal';
import { useTheme } from 'pytron-ui';
import ResizeHandle from './components/ResizeHandle';

function MainApp({ currentTheme, onThemeChange }) {
  const [openFiles, setOpenFiles] = useState([]);
  const [activePath, setActivePath] = useState(null);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, column: 1 });
  const [showPalette, setShowPalette] = useState(false);
  const [showTerminal, setShowTerminal] = useState(true);
  const [pendingCommand, setPendingCommand] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ fontSize: 14, wordWrap: 'off', minimap: false, theme: 'vs-dark' });
  const [showWebPreview, setShowWebPreview] = useState(false);
  const [showRegexLab, setShowRegexLab] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showImports, setShowImports] = useState(false);
  const [showBytecode, setShowBytecode] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [toolWidth, setToolWidth] = useState(300);
  const { addToast } = useToast();
  const theme = useTheme();

  const openFile = useCallback((file) => {
    console.log('[App] openFile called', file.path);
    setOpenFiles((prev) => {
      const exists = prev.find((f) => f.path === file.path);
      if (exists) {
        setActivePath(file.path);
        return prev;
      }
      const next = [...prev, file];
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
    if (!activePath) {
      addToast('No active file to run', { type: 'warning' });
      return;
    }

    let command = '';
    if (activePath.endsWith('.py')) {
      command = `python "${activePath}"`;
    } else if (activePath.endsWith('.js')) {
      command = `node "${activePath}"`;
    } else {
      console.log('Unknown file type for running');
      addToast('Unknown file type. Cannot run.', { type: 'error' });
      return;
    }

    setPendingCommand(command);
    setShowTerminal(true);
    addToast(`Running ${activePath.split(/[\\/]/).pop()}...`, { type: 'info', duration: 2000 });
  }, [activePath, addToast]);

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

  const handleOpenTool = async (toolId) => {
    if (toolId === 'regex') setShowRegexLab(true);
    if (toolId === 'metrics') setShowMetrics(true);
    if (toolId === 'imports') setShowImports(true);
    if (toolId === 'preview') setShowWebPreview(true);
    if (toolId === 'bytecode') setShowBytecode(true);
    if (toolId === 'format') {
      if (!activePath || !activePath.endsWith('.py')) {
        addToast('Please select a Python file to format.', { type: 'warning' });
        return;
      }
      try {
        const res = await pytron.format_code(activePath);
        if (res.success) {
          addToast('Code formatted successfully!', { type: 'success' });
          // Reload the file content - Editor should detect change ideally, or we force reload
          // Currently simple reload:
          window.location.reload();
        } else {
          addToast('Format failed: ' + res.error, { type: 'error' });
        }
      } catch (e) {
        addToast('Error formatting: ' + e, { type: 'error' });
      }
    }
  };

  const menuConfig = [
    {
      label: 'File',
      items: [
        { label: 'New File', onClick: () => addToast('New File not implemented', { type: 'info' }) },
        { label: 'Open File...', onClick: () => setShowPalette(true), shortcut: 'Ctrl+P' },
        { separator: true },
        { label: 'Save', shortcut: 'Ctrl+S', onClick: () => addToast('Saved (Simulation)', { type: 'success' }) },
        { label: 'Save As...', onClick: () => { } },
        { separator: true },
        { label: 'Exit', onClick: () => { window.close(); } }
      ]
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z' },
        { label: 'Redo', shortcut: 'Ctrl+Y' },
        { separator: true },
        { label: 'Cut', shortcut: 'Ctrl+X' },
        { label: 'Copy', shortcut: 'Ctrl+C' },
        { label: 'Paste', shortcut: 'Ctrl+V' }
      ]
    },
    {
      label: 'Selection',
      items: [
        { label: 'Select All', shortcut: 'Ctrl+A' },
        { label: 'Expand Selection' }
      ]
    },
    {
      label: 'View',
      items: [
        { label: 'Command Palette', shortcut: 'Ctrl+P', onClick: () => setShowPalette(true) },
        { separator: true },
        { label: 'Terminal', shortcut: 'Ctrl+`', onClick: () => setShowTerminal(s => !s) },
        { label: 'Web Preview', onClick: () => setShowWebPreview(true) },
        { label: 'Regex Lab', onClick: () => setShowRegexLab(true) }
      ]
    },
    {
      label: 'Go',
      items: [
        { label: 'Go to File...', shortcut: 'Ctrl+P' },
        { label: 'Go to Symbol...' }
      ]
    },
    {
      label: 'Run',
      items: [
        { label: 'Start Debugging', shortcut: 'F5', onClick: handleRun },
        { label: 'Run Without Debugging', shortcut: 'Ctrl+F5', onClick: handleRun }
      ]
    },
    {
      label: 'Terminal',
      items: [
        { label: 'New Terminal', onClick: () => setShowTerminal(true) }
      ]
    },
    {
      label: 'Help',
      items: [
        { label: 'Welcome' },
        { label: 'Documentation' },
        { label: 'About', onClick: () => addToast('TerminateCode v1.0', { title: 'About' }) }
      ]
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: theme.bg, color: theme.fg }}>
      <TitleBar title="" icon={<img src="favicon.png" alt="icon" style={{height:"16px",width:"16px"}}/>} variant="windows" onClose={() => window.close()}>
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{ height: '100%', display: 'flex', alignItems: 'center', marginLeft: '-8px' }}
        >
          <MenuBar menus={menuConfig} style={{ background: 'transparent' }} />
        </div>
      </TitleBar>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          onFileOpen={openFile}
          onOpenSettings={() => setShowSettings(true)}
          activePath={activePath}
          onOpenTool={handleOpenTool}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TabsBar
            files={openFiles}
            activePath={activePath}
            onActivate={(p) => setActivePath(p)}
            onClose={closeFile}
            onRun={handleRun}
          />
          <div style={{ flex: 1, position: 'relative', display: 'flex', minHeight: 0 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: '300px', overflow: 'hidden' }}>
                <Suspense fallback={<div style={{ padding: 16, color: theme.fg }}>Loading editor...</div>}>
                <CodeEditor activePath={activePath} onCursorChange={setCursorInfo} settings={settings} />
              </Suspense>
            </div>
            {showWebPreview && (
              <div style={{ width: toolWidth, minWidth: '200px', position: 'relative', borderLeft: `1px solid ${theme.border}` }}>
                <ResizeHandle orientation="vertical" onResize={(e) => setToolWidth(Math.max(200, window.innerWidth - e.clientX))} style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }} />
                <WebPreview onClose={() => setShowWebPreview(false)} />
              </div>
            )}
            {showRegexLab && (
              <div style={{ width: toolWidth, minWidth: '200px', position: 'relative', borderLeft: `1px solid ${theme.border}` }}>
                <ResizeHandle orientation="vertical" onResize={(e) => setToolWidth(Math.max(200, window.innerWidth - e.clientX))} style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }} />
                <RegexLab onClose={() => setShowRegexLab(false)} />
              </div>
            )}
            {showMetrics && (
              <div style={{ width: toolWidth, minWidth: '200px', position: 'relative', borderLeft: `1px solid ${theme.border}` }}>
                <ResizeHandle orientation="vertical" onResize={(e) => setToolWidth(Math.max(200, window.innerWidth - e.clientX))} style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }} />
                <CodeMetrics activePath={activePath} onClose={() => setShowMetrics(false)} />
              </div>
            )}
            {showImports && (
              <div style={{ width: toolWidth, minWidth: '200px', position: 'relative', borderLeft: `1px solid ${theme.border}` }}>
                <ResizeHandle orientation="vertical" onResize={(e) => setToolWidth(Math.max(200, window.innerWidth - e.clientX))} style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }} />
                <ImportLens activePath={activePath} onClose={() => setShowImports(false)} />
              </div>
            )}
            {showBytecode && (
              <div style={{ width: toolWidth, minWidth: '200px', position: 'relative', borderLeft: `1px solid ${theme.border}` }}>
                <ResizeHandle orientation="vertical" onResize={(e) => setToolWidth(Math.max(200, window.innerWidth - e.clientX))} style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }} />
                <BytecodeViewer activePath={activePath} onClose={() => setShowBytecode(false)} />
              </div>
            )}
          </div>
          {showTerminal && (
            <div style={{ height: terminalHeight, minHeight: '100px', maxHeight: '70vh', position: 'relative', borderTop: `1px solid ${theme.border}` }}>
              <ResizeHandle orientation="horizontal" onResize={(e) => setTerminalHeight(Math.max(100, window.innerHeight - e.clientY))} style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
              <TerminalPanel
                onClose={() => setShowTerminal(false)}
                pendingCommand={pendingCommand}
                onCommandHandled={() => setPendingCommand(null)}
              />
            </div>
          )}
        </div>
      </div>
      <StatusBar cursor={cursorInfo} onToggleTerminal={() => setShowTerminal(s => !s)} />
      {showPalette && <CommandPalette onOpen={(file) => { openFile(file); setShowPalette(false); }} onClose={() => setShowPalette(false)} />}
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} settings={settings} onUpdateSettings={setSettings} currentTheme={currentTheme} onThemeChange={onThemeChange} />}
    </div>
  );
}

function App() {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}

export default App;
