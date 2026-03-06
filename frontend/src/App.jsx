import React, { useState, useCallback, useEffect, Suspense } from 'react';

import Sidebar from './components/Sidebar';
import { Layout, PanelLeft, PanelBottom, PanelRight, Bot } from 'lucide-react';
const CodeEditor = React.lazy(() => import('./components/Editor'));
import TabsBar from './components/TabsBar';
import StatusBar from './components/StatusBar';
import CommandPalette from './components/CommandPalette';
import WebPreview from './components/WebPreview';
import RegexLab from './components/RegexLab';
import CodeMetrics from './components/CodeMetrics';
import ImportLens from './components/ImportLens';
import BytecodeViewer from './components/BytecodeViewer';
import MarkdownPreview from './components/MarkdownPreview';
import AIPanel from './components/AIPanel';
import './App.css';
import { PytronTitleBar, PytronMenuBar, ToastProvider, useToast } from 'pytron-ui/react';
import pytron from 'pytron-client';
import TerminalPanel from './components/TerminalPanel';
import SettingsModal from './components/SettingsModal';
import { useTheme } from 'pytron-ui/react';
import ResizeHandle from './components/ResizeHandle';

function MainApp({ currentTheme, onThemeChange }) {
  const [openFiles, setOpenFiles] = useState([]);
  const [activePath, setActivePath] = useState(null);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, column: 1 });
  const [showPalette, setShowPalette] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [pendingCommand, setPendingCommand] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({ fontSize: 14, wordWrap: 'off', minimap: false, theme: 'vs-dark' });
  const [showWebPreview, setShowWebPreview] = useState(false);
  const [showRegexLab, setShowRegexLab] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showImports, setShowImports] = useState(false);
  const [showBytecode, setShowBytecode] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [toolWidth, setToolWidth] = useState(300);
  const [sideWidth, setSideWidth] = useState(350);
  const [isInitialized, setIsInitialized] = useState(false);
  const { addToast } = useToast();
  const theme = useTheme();

  // 1. LOAD Workspace State on Mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const res = await pytron.load_workspace_state();
        if (res.success && res.state) {
          const s = res.state;
          if (s.openFiles) setOpenFiles(s.openFiles);
          if (s.activePath) setActivePath(s.activePath);
          if (typeof s.showSidebar === 'boolean') setShowSidebar(s.showSidebar);
          if (typeof s.showTerminal === 'boolean') setShowTerminal(s.showTerminal);
          if (typeof s.showAI === 'boolean') setShowAI(s.showAI);
          if (s.terminalHeight) setTerminalHeight(s.terminalHeight);
          if (s.toolWidth) setToolWidth(s.toolWidth);
          if (s.sideWidth) setSideWidth(s.sideWidth);
          if (s.settings) setSettings(s.settings);
          if (s.aiMessages) setAiMessages(s.aiMessages);
        }
      } catch (e) {
        console.error("Failed to load session", e);
      } finally {
        setIsInitialized(true);
      }
    };
    loadSession();
  }, []);

  // 2. SAVE Workspace State on Change
  useEffect(() => {
    if (!isInitialized) return;

    const saveSession = async () => {
      try {
        await pytron.save_workspace_state({
          openFiles,
          activePath,
          showSidebar,
          showTerminal,
          showAI,
          terminalHeight,
          toolWidth,
          sideWidth,
          settings,
          aiMessages
        });
      } catch (e) {
        console.error("Failed to save session", e);
      }
    };

    const timer = setTimeout(saveSession, 1000); // 1s Debounce
    return () => clearTimeout(timer);
  }, [openFiles, activePath, showSidebar, showTerminal, showAI, terminalHeight, toolWidth, settings, aiMessages, isInitialized]);

  const openFile = useCallback((file) => {
    setOpenFiles((prev) => {
      const exists = prev.find((f) => f.path === file.path && (!file.type || f.type === file.type));
      if (exists) {
        setActivePath(file.path);
        return prev;
      }
      return [...prev, file];
    });
    setActivePath(file.path);
  }, []);

  const openDiff = useCallback((path) => {
    const diffPath = `diff:${path}`;
    const fileObj = {
      path: diffPath,
      realPath: path,
      name: `${path.split(/[\\/]/).pop()} (Diff)`,
      type: 'diff'
    };
    openFile(fileObj);
  }, [openFile]);

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

  const cycleTabs = useCallback(() => {
    console.log('[App] cycleTabs called - count:', openFiles.length);
    if (openFiles.length <= 1) return;
    const currentIndex = openFiles.findIndex(f => f.path === activePath);
    const nextIndex = (currentIndex + 1) % openFiles.length;
    const nextPath = openFiles[nextIndex].path;
    setActivePath(nextPath);
  }, [openFiles, activePath]);

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
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { // Swap Tabs
        e.preventDefault();
        cycleTabs();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') { // Close Tab
        e.preventDefault();
        if (activePath) closeFile(activePath);
      }
      // Ctrl + 1-9 to switch tabs
      if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (openFiles[index]) {
          e.preventDefault();
          setActivePath(openFiles[index].path);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cycleTabs, closeFile, activePath, openFiles]);

  const handleOpenTool = async (toolId) => {
    if (toolId === 'regex') setShowRegexLab(true);
    if (toolId === 'metrics') setShowMetrics(true);
    if (toolId === 'imports') setShowImports(true);
    if (toolId === 'preview') setShowWebPreview(true);
    if (toolId === 'bytecode') setShowBytecode(true);
    if (toolId === 'ai' || toolId === 'gemini') setShowAI(true);
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
      <PytronTitleBar title="" icon={<img src="favicon.png" alt="icon" style={{ height: "16px", width: "16px" }} />} variant="windows" onClose={() => window.close()}>
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{ height: '100%', display: 'flex', alignItems: 'center', marginLeft: '-8px', flex: 1 }}
        >
          <PytronMenuBar menus={menuConfig} style={{ background: 'transparent' }} />

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', paddingRight: '12px' }}>
            <div
              onClick={() => setShowSidebar(s => !s)}
              className={`titlebar-toggle ${showSidebar ? 'active' : ''}`}
              style={{ padding: '4px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Toggle Sidebar"
            >
              <PanelLeft size={16} />
            </div>
            <div
              onClick={() => setShowTerminal(s => !s)}
              className={`titlebar-toggle ${showTerminal ? 'active' : ''}`}
              style={{ padding: '4px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Toggle Bottom Panel"
            >
              <PanelBottom size={16} />
            </div>
            <div
              onClick={() => setShowAI(s => !s)}
              className={`titlebar-toggle ${showAI ? 'active' : ''}`}
              style={{ padding: '4px', cursor: 'pointer', borderRadius: '4px', display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}
              title="Toggle AI Assistant"
            >
              <PanelRight size={16} />
              <Bot size={14} />
            </div>
          </div>
        </div>
      </PytronTitleBar>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {showSidebar && (
          <Sidebar
            onFileOpen={openFile}
            onDiffOpen={openDiff}
            onOpenSettings={() => setShowSettings(true)}
            activePath={activePath}
            onOpenTool={handleOpenTool}
            settings={settings}
          />
        )}
        <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <TabsBar
            files={openFiles}
            activePath={activePath}
            onActivate={(p) => setActivePath(p)}
            onClose={closeFile}
            onRun={handleRun}
          />
          <div style={{ flex: 1, position: 'relative', display: 'flex', minHeight: 0, overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: '100px', overflow: 'hidden' }}>
              <Suspense fallback={<div style={{ padding: 16, color: theme.fg }}>Loading editor...</div>}>
                <CodeEditor
                  activeFile={openFiles.find(f => f.path === activePath)}
                  onCursorChange={setCursorInfo}
                  settings={settings}
                />
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
        {showAI && (
          <div style={{
            width: sideWidth,
            minWidth: '250px',
            position: 'relative',
            borderLeft: `1px solid ${theme.border}`,
            background: theme.bg,
            flexShrink: 0  // Critical for pushing the editor instead of overlaying
          }}>
            <ResizeHandle
              orientation="vertical"
              onResize={(e) => setSideWidth(Math.max(250, window.innerWidth - e.clientX))}
              style={{ position: 'absolute', left: '-2px', top: 0, bottom: 0, width: '4px', zIndex: 100, cursor: 'col-resize' }}
            />
            <AIPanel
              activePath={activePath}
              onClose={() => setShowAI(false)}
              messages={aiMessages}
              setMessages={setAiMessages}
            />
          </div>
        )}
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
