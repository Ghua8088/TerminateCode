import React, { useState, useCallback, useEffect, Suspense } from 'react';

import Sidebar from './components/Sidebar';
import { Layout, PanelLeft, PanelBottom, PanelRight, Bot, Compass, FolderOpen, Trash2, Settings as SettingsIcon, RefreshCcw, Layers, Package, LayoutGrid } from 'lucide-react';
const CodeEditor = React.lazy(() => import('./components/Editor'));
const NotebookEditor = React.lazy(() => import('./components/NotebookEditor'));
import TabsBar from './components/TabsBar';
import StatusBar from './components/StatusBar';
import CommandPalette from './components/CommandPalette';
const WebPreview = React.lazy(() => import('./components/WebPreview'));
const RegexLab = React.lazy(() => import('./components/RegexLab'));
const CodeMetrics = React.lazy(() => import('./components/CodeMetrics'));
const ImportLens = React.lazy(() => import('./components/ImportLens'));
const BytecodeViewer = React.lazy(() => import('./components/BytecodeViewer'));
const MarkdownPreview = React.lazy(() => import('./components/MarkdownPreview'));
const AIPanel = React.lazy(() => import('./components/AIPanel'));
const AgentLab = React.lazy(() => import('./components/AgentLab'));
const ConceptBoard = React.lazy(() => import('./components/ConceptBoard'));
const ExtensionStore = React.lazy(() => import('./components/ExtensionStore'));
import './App.css';
import { PytronTitleBar, PytronMenuBar, ToastProvider, useToast, ContextMenu } from 'pytron-ui/react';
import pytron from 'pytron-client';
const TerminalPanel = React.lazy(() => import('./components/TerminalPanel'));
const SettingsModal = React.lazy(() => import('./components/SettingsModal'));
import Breadcrumbs from './components/Breadcrumbs';
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
  const [settings, setSettings] = useState({
    fontSize: 14,
    wordWrap: 'off',
    minimap: false,
    theme: 'vs-dark',
    customEndpoint: '',
    customModel: ''
  });
  const [showWebPreview, setShowWebPreview] = useState(false);
  const [showRegexLab, setShowRegexLab] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showImports, setShowImports] = useState(false);
  const [showBytecode, setShowBytecode] = useState(false);
  const [showAgentLab, setShowAgentLab] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [toolWidth, setToolWidth] = useState(300);
  const [aiWidth, setAiWidth] = useState(380);
  const [projectPath, setProjectPath] = useState(null);
  const [showExtensions, setShowExtensions] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [architectureSidebarState, setArchitectureSidebarState] = useState(null);
  
  const showConceptBoard = activePath === 'pytron://architecture';

  useEffect(() => {
    if (projectPath) {
      pytron.sync_backend_cwd(projectPath);
    }
  }, [projectPath]);

  const { addToast } = useToast();
  const theme = useTheme();

  const handleSelectDirectory = useCallback(async () => {
    console.log('[App] Requesting directory selection...');
    try {
      const res = await pytron.select_directory();
      console.log('[App] select_directory result:', res);
      if (res.success) {
        setProjectPath(res.path);
      }
    } catch (e) {
      console.error('[App] select_directory failed:', e);
      addToast('Select Directory error: ' + e, { type: 'error' });
    }
  }, [addToast]);

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
          if (s.terminalHeight) setTerminalHeight(s.terminalHeight);
          if (s.toolWidth) setToolWidth(s.toolWidth);
          if (typeof s.showAI === 'boolean') setShowAI(s.showAI);
          if (s.aiWidth) setAiWidth(s.aiWidth);
          if (s.projectPath) setProjectPath(s.projectPath);
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
          terminalHeight,
          toolWidth,
          showAI,
          aiWidth,
          projectPath,
          settings,
          aiMessages
        });
      } catch (e) {
        console.error("Failed to save session", e);
      }
    };

    const timer = setTimeout(saveSession, 1000); // 1s Debounce
    return () => clearTimeout(timer);
  }, [openFiles, activePath, showSidebar, showTerminal, terminalHeight, toolWidth, showAI, aiWidth, settings, aiMessages, isInitialized]);

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
    setOpenFiles((prev) => {
      const next = prev.filter((f) => f.path !== path);
      if (activePath === path) {
        setActivePath(next.length > 0 ? next[next.length - 1].path : null);
      }
      return next;
    });
  }, [activePath]);

  const closeOthers = useCallback((path) => {
    setOpenFiles((prev) => prev.filter(f => f.path === path));
    setActivePath(path);
  }, []);

  const closeAll = useCallback(() => {
    setOpenFiles([]);
    setActivePath(null);
  }, []);

  const closeRight = useCallback((path) => {
    setOpenFiles((prev) => {
      const idx = prev.findIndex(f => f.path === path);
      if (idx === -1) return prev;
      const next = prev.slice(0, idx + 1);
      if (!next.find(f => f.path === activePath)) {
        setActivePath(path);
      }
      return next;
    });
  }, [activePath]);

  const handleReorderFiles = useCallback((newFiles) => {
    console.log('[DEBUG] App: handleReorderFiles triggered with:', newFiles.map(f => f.name));
    setOpenFiles(newFiles);
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

  const handleLaunchCliProvider = useCallback(async (providerId, action = 'launch') => {
    try {
      const res = await pytron.get_cli_provider_command(providerId, action);
      if (!res.success) {
        addToast(res.error || 'Failed to prepare CLI command.', { type: 'error' });
        return;
      }

      setPendingCommand(res.command);
      setShowTerminal(true);

      const providerName = res.provider?.name || providerId;
      addToast(
        action === 'install'
          ? `Queued install command for ${providerName}.`
          : `Opening ${providerName} in the terminal.`,
        { type: 'info' },
      );
    } catch (e) {
      addToast('Failed to launch CLI provider: ' + e, { type: 'error' });
    }
  }, [addToast]);

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
      if (e.ctrlKey && e.key === 'Tab') { // Cycle Tabs via standard shortcut
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
  }, [cycleTabs, closeFile, activePath, openFiles, setShowSidebar]);

  useEffect(() => {
    const handleTerminalOpenPath = (e) => {
      const pathStr = e.detail?.path;
      if (pathStr) {
        // Strip trailing slashes or quotes if accidentally matched
        const cleanPath = pathStr.replace(/["']/g, '');
        const name = cleanPath.split(/[\\/]/).pop();
        openFile({ path: cleanPath, name: name, is_dir: false });
      }
    };
    window.addEventListener('terminal:openPath', handleTerminalOpenPath);
    return () => window.removeEventListener('terminal:openPath', handleTerminalOpenPath);
  }, [openFile]);

  const handleOpenTool = async (toolId) => {
    if (toolId === 'regex') setShowRegexLab(true);
    if (toolId === 'metrics') setShowMetrics(true);
    if (toolId === 'imports') setShowImports(true);
    if (toolId === 'preview') setShowWebPreview(true);
    if (toolId === 'bytecode') setShowBytecode(true);
    if (toolId === 'ai' || toolId === 'gemini') {
      setShowAI(true);
    }
    if (toolId === 'agent_lab') setShowAgentLab(true); // 3. Update handleOpenTool to open AgentLab
    if (toolId === 'extensions') setShowExtensions(true);
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
        {
          label: 'Open Folder...', onClick: handleSelectDirectory
        },
        { label: 'Close Folder', onClick: () => setProjectPath(null), enabled: !!projectPath },
        { separator: true },
        { label: 'Save', shortcut: 'Ctrl+S', onClick: () => addToast('Saved (Simulation)', { type: 'success' }) },
        { label: 'Save As...', onClick: () => { } },
        { separator: true },
        { label: 'Marketplace', icon: <Package size={14} />, onClick: () => setShowExtensions(true) },
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
        { label: 'Regex Lab', onClick: () => setShowRegexLab(true) },
        { label: 'Inspector', onClick: async () => await pytron.inspector() }
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
        { label: 'New Terminal', onClick: () => setShowTerminal(true) },
        { label: 'Clear Terminal', onClick: () => window.dispatchEvent(new CustomEvent('terminal:clear')) }
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

  const defaultContextMenuItems = React.useMemo(() => [
    {
      label: 'Command Palette',
      shortcut: 'Ctrl+P',
      icon: <Layers size={14} />,
      onClick: () => setShowPalette(true)
    },
    {
      label: 'Open Folder',
      icon: <FolderOpen size={14} />,
      onClick: handleSelectDirectory
    },
    {
      label: 'Extensions',
      icon: <LayoutGrid size={14} />,
      onClick: () => setShowExtensions(true)
    },
    { type: 'divider' },
    {
      label: 'Close All Tabs',
      icon: <Trash2 size={14} />,
      onClick: closeAll
    },
    {
      label: 'Settings',
      shortcut: 'Ctrl+,',
      icon: <SettingsIcon size={14} />,
      onClick: () => setShowSettings(true)
    },
    { type: 'divider' },
    {
      label: 'Reload Window',
      shortcut: 'F5',
      icon: <RefreshCcw size={14} />,
      onClick: () => window.location.reload()
    }
  ], [handleSelectDirectory, closeAll]);

  const [contextMenuItems, setContextMenuItems] = useState(defaultContextMenuItems);

  useEffect(() => {
    const handleSetMenu = (e) => {
      if (e.detail && e.detail.items) {
        setContextMenuItems(e.detail.items);
      } else {
        setContextMenuItems(defaultContextMenuItems);
      }
    };
    
    // Also reset to default if they click somewhere else to clear context menu
    const handleResetMenu = () => {
      setContextMenuItems(defaultContextMenuItems);
    };

    window.addEventListener('contextmenu:set', handleSetMenu);
    window.addEventListener('click', handleResetMenu);

    return () => {
      window.removeEventListener('contextmenu:set', handleSetMenu);
      window.removeEventListener('click', handleResetMenu);
    };
  }, [defaultContextMenuItems]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: theme.bg, color: theme.fg }}>
      <ContextMenu items={contextMenuItems} variant="windows" />
      <PytronTitleBar title="" icon={<img src="favicon.png" alt="icon" style={{ height: "16px", width: "16px" }} />} variant="windows" onClose={() => window.close()}>
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{ height: '100%', display: 'flex', alignItems: 'center', marginLeft: '-8px', flex: 1 }}
        >
          <PytronMenuBar menus={menuConfig} style={{ background: 'transparent' }} />

          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', paddingRight: '12px' }}>
            <div
              onClick={() => {
                if (showConceptBoard) {
                  closeFile('pytron://architecture');
                } else {
                  openFile({
                    path: 'pytron://architecture',
                    name: 'Architecture',
                    type: 'tool',
                    isUnsaved: false
                  });
                }
              }}
              className={`titlebar-toggle ${showConceptBoard ? 'active' : ''}`}
              style={{ padding: '4px', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Toggle Workspace Orchestrator"
            >
              <Compass size={16} />
            </div>
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
              className="titlebar-toggle"
              style={{ padding: '4px', cursor: 'pointer', borderRadius: '4px', display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}
              title="Toggle AI Sidebar"
            >
              <PanelRight size={16} />
              <Bot size={14} />
            </div>
          </div>
        </div>
      </PytronTitleBar>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minWidth: 0 }}>
        {showSidebar && (
          <Sidebar
            onFileOpen={openFile}
            onFolderOpen={setProjectPath}
            onDiffOpen={openDiff}
            onOpenSettings={() => setShowSettings(true)}
            activePath={activePath}
            onOpenTool={handleOpenTool}
            onLaunchCliProvider={handleLaunchCliProvider}
            settings={settings}
            projectPath={projectPath}
            onOpenAI={() => setShowAI(true)}
            architectureState={architectureSidebarState}
            showConceptBoard={showConceptBoard}
          />
        )}

        <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <TabsBar
              files={openFiles}
              activePath={activePath}
              onActivate={(p) => setActivePath(p)}
              onClose={closeFile}
              onCloseOthers={closeOthers}
              onCloseAll={closeAll}
              onCloseRight={closeRight}
              onRun={handleRun}
              onReorderFiles={handleReorderFiles}
            />

            <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
              {showConceptBoard ? (
                <Suspense fallback={<div>Loading Board...</div>}><ConceptBoard onSidebarStateChange={setArchitectureSidebarState} /></Suspense>
              ) : (
                <div style={{ display: 'flex', width: '100%', height: '100%', minWidth: 0, overflow: 'hidden' }}>
                  <div style={{ flex: 1, position: 'relative', display: 'flex', minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: '100px', overflow: 'hidden' }}>
                      <Suspense fallback={<div style={{ padding: 16, color: theme.fg }}>Loading editor...</div>}>
                        {activePath && !activePath.startsWith('diff:') && <Breadcrumbs path={activePath} projectPath={projectPath} onFileOpen={openFile} />}
                        {activePath && activePath.endsWith('.ipynb') ? (
                          <NotebookEditor path={activePath} onClose={() => closeFile(activePath)} />
                        ) : (
                          <CodeEditor
                            activeFile={openFiles.find(f => f.path === activePath)}
                            onCursorChange={setCursorInfo}
                            settings={settings}
                          />
                        )}
                      </Suspense>
                    </div>

                    {showWebPreview && (
                      <div style={{ width: toolWidth, minWidth: '200px', position: 'relative', borderLeft: `1px solid ${theme.border}` }}>
                        <ResizeHandle orientation="vertical" onResize={(e) => setToolWidth(Math.max(200, window.innerWidth - e.clientX))} style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }} />
                        <Suspense fallback={<div>Loading Preview...</div>}><WebPreview onClose={() => setShowWebPreview(false)} /></Suspense>
                      </div>
                    )}
                    {showRegexLab && (
                      <div style={{ width: toolWidth, minWidth: '200px', position: 'relative', borderLeft: `1px solid ${theme.border}` }}>
                        <ResizeHandle orientation="vertical" onResize={(e) => setToolWidth(Math.max(200, window.innerWidth - e.clientX))} style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }} />
                        <Suspense fallback={<div>Loading Lab...</div>}><RegexLab onClose={() => setShowRegexLab(false)} /></Suspense>
                      </div>
                    )}
                    {showMetrics && (
                      <div style={{ width: toolWidth, minWidth: '200px', position: 'relative', borderLeft: `1px solid ${theme.border}` }}>
                        <ResizeHandle orientation="vertical" onResize={(e) => setToolWidth(Math.max(200, window.innerWidth - e.clientX))} style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }} />
                        <Suspense fallback={<div>Loading Metrics...</div>}><CodeMetrics activePath={activePath} onClose={() => setShowMetrics(false)} /></Suspense>
                      </div>
                    )}
                    {showImports && (
                      <div style={{ width: toolWidth, minWidth: '200px', position: 'relative', borderLeft: `1px solid ${theme.border}` }}>
                        <ResizeHandle orientation="vertical" onResize={(e) => setToolWidth(Math.max(200, window.innerWidth - e.clientX))} style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }} />
                        <Suspense fallback={<div>Loading Lens...</div>}><ImportLens activePath={activePath} onClose={() => setShowImports(false)} /></Suspense>
                      </div>
                    )}
                    {showBytecode && (
                      <div style={{ width: toolWidth, minWidth: '200px', position: 'relative', borderLeft: `1px solid ${theme.border}` }}>
                        <ResizeHandle orientation="vertical" onResize={(e) => setToolWidth(Math.max(200, window.innerWidth - e.clientX))} style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }} />
                        <Suspense fallback={<div>Loading Bytecode...</div>}><BytecodeViewer activePath={activePath} onClose={() => setShowBytecode(false)} /></Suspense>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {showTerminal && (
              <div style={{ height: terminalHeight, minHeight: '100px', maxHeight: '70vh', position: 'relative', zIndex: 10, borderTop: `1px solid ${theme.border}` }}>
                <ResizeHandle orientation="horizontal" onResize={(e) => setTerminalHeight(Math.max(100, window.innerHeight - e.clientY))} style={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
                <Suspense fallback={<div>Loading Terminal...</div>}>
                  <TerminalPanel
                    onClose={() => setShowTerminal(false)}
                    pendingCommand={pendingCommand}
                    onCommandHandled={() => setPendingCommand(null)}
                    projectPath={projectPath}
                  />
                </Suspense>
              </div>
            )}
          </div>

          {showAI && (
            <div style={{ width: aiWidth, minWidth: '320px', maxWidth: '620px', position: 'relative', zIndex: 30, borderLeft: `1px solid ${theme.border}`, background: 'linear-gradient(180deg, rgba(22,22,24,0.98), rgba(12,12,14,0.98))', flexShrink: 0, height: '100%', boxShadow: '-14px 0 28px rgba(0,0,0,0.2)' }}>
              <ResizeHandle
                orientation="vertical"
                onResize={(e) => setAiWidth(Math.max(320, window.innerWidth - e.clientX))}
                style={{ position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 40, cursor: 'col-resize' }}
              />
              <Suspense fallback={<div>Loading AI...</div>}>
                <AIPanel
                  activePath={activePath}
                  onClose={() => setShowAI(false)}
                  messages={aiMessages}
                  setMessages={setAiMessages}
                  cursorInfo={cursorInfo}
                />
              </Suspense>
            </div>
          )}
        </div>
      </div>
      <StatusBar cursor={cursorInfo} onToggleTerminal={() => setShowTerminal(s => !s)} projectPath={projectPath} />
      {showPalette && <CommandPalette onOpen={(file) => { openFile(file); setShowPalette(false); }} onClose={() => setShowPalette(false)} />}
      {showAgentLab && <Suspense fallback={null}><AgentLab onClose={() => setShowAgentLab(false)} /></Suspense>}
      {showExtensions && <Suspense fallback={null}><ExtensionStore onClose={() => setShowExtensions(false)} /></Suspense>}
      {showSettings && <Suspense fallback={null}><SettingsModal onClose={() => setShowSettings(false)} settings={settings} onUpdateSettings={setSettings} currentTheme={currentTheme} onThemeChange={onThemeChange} /></Suspense>}
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
