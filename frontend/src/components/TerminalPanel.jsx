import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { Trash2, X, Search, Plus, SquareTerminal, Sparkles } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import pytron from 'pytron-client';

const TerminalInstance = ({ id, active, onData, onResize, pendingCommand, onCommandHandled, projectPath, onCommandRun }) => {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);
    const searchAddonRef = useRef(null);
    const isInitialized = useRef(false);

    const initTerminal = useCallback(async (cwd = null) => {
        try {
            const term = xtermRef.current;
            if (!term) return;
            term.clear();

            if (id === 'debug') {
                term.write('\x1b[35m[Pytron Internal Debug Console Attached]\x1b[0m\r\n');
                isInitialized.current = true;
                return;
            }

            const cols = term.cols || 80;
            const rows = term.rows || 24;
            const res = await pytron.terminal_init(cwd, cols, rows, id);
            if (res.success) {
                isInitialized.current = true;
            }
        } catch (err) { }
    }, [id]);

    useEffect(() => {
        if (active && xtermRef.current) {
            xtermRef.current.focus();
            setTimeout(() => {
                if (fitAddonRef.current) fitAddonRef.current.fit();
            }, 50);
        }
    }, [active]);

    useEffect(() => {
        if (pendingCommand && isInitialized.current && active) {
            pytron.terminal_write(pendingCommand + '\r\n', id);
            onCommandRun?.(pendingCommand);
            onCommandHandled();
        }
    }, [pendingCommand, onCommandHandled, id, active, onCommandRun]);

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: '#0a0a0c',
                foreground: '#e4e4e7',
                cursor: '#3b82f6',
                selectionBackground: 'rgba(59, 130, 246, 0.4)',
                black: '#1f2937', red: '#ef4444', green: '#10b981', yellow: '#f59e0b',
                blue: '#3b82f6', magenta: '#8b5cf6', cyan: '#06b6d4', white: '#f4f4f5',
                brightBlack: '#4b5563', brightRed: '#f87171', brightGreen: '#34d399',
                brightYellow: '#fbbf24', brightBlue: '#60a5fa', brightMagenta: '#a78bfa',
                brightCyan: '#22d3ee', brightWhite: '#ffffff',
            },
            fontSize: 12,
            fontFamily: '"JetBrains Mono", monospace',
            scrollback: 3000,
            allowProposedApi: true,
            convertEol: true
        });

        const fitAddon = new FitAddon();
        fitAddonRef.current = fitAddon;
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());
        const searchAddon = new SearchAddon();
        searchAddonRef.current = searchAddon;
        term.loadAddon(searchAddon);

        term.registerLinkProvider({
            provideLinks: (bufferLineNumber, callback) => {
                const line = term.buffer.active.getLine(bufferLineNumber);
                if (!line) { callback(undefined); return; }
                const lineStr = line.translateToString(true);
                const links = [];
                // Simple linear-time regex to avoid ReDoS on long terminal output strings
                const regex = /(?:[A-Za-z]:[\\/]|(?:\.\.?\/|\/))[a-zA-Z0-9.\-_\\/]+/g;
                let match;
                while ((match = regex.exec(lineStr)) !== null) {
                    const text = match[0];
                    if (text.length > 3) {
                       links.push({
                           range: {
                               start: { x: match.index + 1, y: bufferLineNumber },
                               end: { x: match.index + text.length, y: bufferLineNumber }
                           },
                           text: text,
                           activate: (e, text) => {
                               if (e.ctrlKey || e.metaKey || e.altKey) {
                                   window.dispatchEvent(new CustomEvent('terminal:openPath', { detail: { path: text } }));
                               }
                           },
                           hoverTooltip: 'Ctrl+Click or Alt+Click to open file in IDE'
                       });
                    }
                }
                callback(links);
            }
        });

        term.open(terminalRef.current);
        xtermRef.current = term;

        const filterEcho = (dataStr) => {
            if (typeof dataStr === 'string' && dataStr.includes('[?1;2c')) {
                return dataStr.replace(/\x1b\[\?1;2c/g, '').replace(/\[\?1;2c/g, '');
            }
            return dataStr;
        };

        const handleOutput = (e) => {
            const payload = e.detail || e;
            let dataStr = typeof payload === 'object' ? payload.data : payload;
            
            if (typeof dataStr === 'string') {
                dataStr = filterEcho(dataStr);
                // Truncate extreme payloads to strictly protect Xterm parser limits (keep last ~100kb)
                if (dataStr.length > 150000) {
                    dataStr = "\x1b[33m\r\n[... Output Truncated by IDE to preserve memory ...]\x1b[0m\r\n" + dataStr.substring(dataStr.length - 150000);
                }
            }
            
            const targetId = typeof payload === 'object' ? payload.sessionId : 'default';
            if (targetId === id && dataStr) {
                term.write(dataStr);
            }
        };

        const handleDebugLog = (e) => {
            const payload = e.detail || e;
            if (payload && payload.data && id === 'debug') {
                let formatted = payload.data.replace(/\n/g, '\r\n');
                term.write(formatted);
            }
        };

        let unlisten;
        if (id === 'debug') {
            unlisten = pytron.on('debug:log', handleDebugLog);
        } else {
            unlisten = pytron.on('terminal:output', handleOutput);
        }

        const init = async () => {
            setTimeout(() => fitAddon.fit(), 100);
            if (id === 'debug') {
                initTerminal();
                return;
            }
            await initTerminal(projectPath);
            const sync = await pytron.terminal_read(id);
            if (sync.success && sync.output) {
                let outStr = sync.output;
                if (outStr.length > 250000) {
                    outStr = "\x1b[33m\r\n[... History Truncated by IDE to preserve memory ...]\x1b[0m\r\n" + outStr.substring(outStr.length - 250000);
                }
                term.write(filterEcho(outStr));
            }
        };
        init();

        term.onData(data => {
            if (id !== 'debug' && isInitialized.current) pytron.terminal_write(data, id);
        });
        term.onResize(({ cols, rows }) => {
            if (id !== 'debug' && isInitialized.current) pytron.terminal_resize(cols, rows, id);
        });

        const resizeObserver = new ResizeObserver(() => {
            if (active) setTimeout(() => fitAddon.fit(), 50);
        });
        resizeObserver.observe(terminalRef.current);

        const clearHandler = () => {
            if (active && term) term.reset();
        };
        window.addEventListener('terminal:clear', clearHandler);

        return () => {
            unlisten?.();
            window.removeEventListener('terminal:clear', clearHandler);
            resizeObserver.disconnect();
            term.dispose();
            if (id !== 'debug') pytron.terminal_close(id);
        };
    }, [id, initTerminal]);

    useEffect(() => {
        if (isInitialized.current) {
            initTerminal(projectPath);
        }
    }, [projectPath, initTerminal]);

    return (
        <div
            ref={terminalRef}
            style={{
                display: active ? 'block' : 'none',
                height: '100%',
                width: '100%',
                background: '#0a0a0c',
                padding: '4px 0 0 8px'
            }}
        />
    );
};

const TerminalPanel = ({ onClose, pendingCommand, onCommandHandled, projectPath }) => {
    const [tabs, setTabs] = useState([
        { id: 'default', name: 'pwsh', type: 'shell' },
        { id: 'debug', name: 'Debug Console', type: 'debug' }
    ]);
    const [activeTabId, setActiveTabId] = useState('default');
    const [showSearch, setShowSearch] = useState(false);
    const [dragIndex, setDragIndex] = useState(null);
    const [isHealing, setIsHealing] = useState(false);
    const [healPopup, setHealPopup] = useState(null);

    const checkAutoHeal = async () => {
        setIsHealing(true);
        try {
            const res = await pytron.terminal_auto_heal(activeTabId);
            if (res.success && res.analysis) {
                setHealPopup(res.analysis);
            } else {
                setHealPopup(res.error || "No errors detected.");
                setTimeout(() => setHealPopup(null), 3000);
            }
        } catch (e) {
            setHealPopup("Error calling Auto-Heal: " + e.message);
            setTimeout(() => setHealPopup(null), 3000);
        }
        setIsHealing(false);
    };

    const addTab = () => {
        const id = 'term_' + Date.now();
        setTabs(prev => [...prev, { id, name: 'pwsh-' + (prev.length + 1), type: 'shell' }]);
        setActiveTabId(id);
    };

    const closeTab = (e, id) => {
        e.stopPropagation();
        const remaining = tabs.filter(t => t.id !== id);
        if (remaining.length === 0) {
            onClose();
            return;
        }
        setTabs(remaining);

        if (activeTabId === id) {
            const nextActive = remaining[remaining.length - 1].id;
            setActiveTabId(nextActive);
        }
    };

    const handleSwitchTab = (id) => {
        setActiveTabId(id);
    };

    const handleMouseDown = (idx) => {
        console.log('[DRAG-TERM] Grab started at index:', idx);
        setDragIndex(idx);
        
        const handleGlobalMouseUp = () => {
            console.log('[DRAG-TERM] Released');
            setDragIndex(null);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
    };

    const handleMouseEnter = (idx) => {
        if (dragIndex !== null && dragIndex !== idx) {
            console.log('[DRAG-TERM] Swapping index', dragIndex, 'with', idx);
            const newTabs = [...tabs];
            const item = newTabs.splice(dragIndex, 1)[0];
            newTabs.splice(idx, 0, item);
            setTabs(newTabs);
            setDragIndex(idx);
        }
    };

    const updateTabName = useCallback((command) => {
        if (!command) return;
        console.log('[RENAME-TERM] Command:', command);
        
        setTabs(prev => prev.map(t => {
            if (t.id === activeTabId) {
                let name = '';
                // Handle complex commands and extract the main filename
                const parts = command.trim().split(/\s+/);
                if (parts[0].toLowerCase() === 'python' && parts.length > 1) {
                    name = parts[parts.length - 1].replace(/["']/g, '').split(/[\\/]/).pop();
                } else {
                    name = parts[0].split(/[\\/]/).pop();
                }
                
                if (name.length > 20) name = name.substring(0, 18) + '..';
                console.log('[RENAME-TERM] Extracted Name:', name);
                return { ...t, name };
            }
            return t;
        }));
    }, [activeTabId]);

    useEffect(() => {
        if (pendingCommand && activeTabId) {
            updateTabName(pendingCommand);
        }
    }, [pendingCommand, activeTabId, updateTabName]);

    return (
        <div style={{ height: '100%', background: '#0a0a0c', display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)' }}>
            {/* Tab Bar */}
            <div style={{
                height: '34px',
                background: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                gap: '2px',
                borderBottom: '1px solid var(--border)',
                userSelect: 'none'
            }}>
                <div style={{ display: 'flex', flex: 1, overflowX: 'auto', gap: '2px', height: '100%', alignItems: 'center' }}>
                    {tabs.map((tab, idx) => {
                        const active = activeTabId === tab.id;
                        return (
                            <div
                                key={tab.id}
                                onMouseDown={() => handleMouseDown(idx)}
                                onMouseEnter={() => handleMouseEnter(idx)}
                                onClick={() => handleSwitchTab(tab.id)}
                                style={{
                                    height: '100%',
                                    padding: '0 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: active ? '#0a0a0c' : (dragIndex === idx ? 'rgba(59, 130, 246, 0.1)' : 'transparent'),
                                    borderTop: active ? '1px solid #3b82f6' : (dragIndex === idx ? '1px solid #3b82f6' : '1px solid transparent'),
                                    cursor: 'grab',
                                    color: active ? '#fff' : '#858585',
                                    fontSize: '11px',
                                    minWidth: '100px',
                                    maxWidth: '160px',
                                    borderRight: '1px solid var(--border)',
                                    opacity: dragIndex === idx ? 0.7 : 1,
                                    position: 'relative',
                                    zIndex: dragIndex === idx ? 100 : 1,
                                    transform: dragIndex === idx ? 'scale(1.05)' : 'none',
                                    transition: 'all 0.1s ease'
                                }}
                                >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none', flex: 1, overflow: 'hidden' }}>
                                    <SquareTerminal size={12} color={active ? '#3b82f6' : '#858585'} />
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.name}</span>
                                </div>
                                <X
                                    size={12}
                                    className="tab-close"
                                    onClick={(e) => { e.stopPropagation(); closeTab(e, tab.id); }}
                                    style={{ opacity: active ? 1 : 0, transition: 'opacity 0.2s', position: 'relative', zIndex: 10, pointerEvents: 'auto' }}
                                />
                            </div>
                        );
                    })}
                    <button
                        onClick={addTab}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#858585',
                            padding: '4px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            borderRadius: '4px',
                            marginLeft: '4px'
                        }}
                        onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={e => e.target.style.background = 'transparent'}
                    >
                        <Plus size={14} />
                    </button>
                    {activeTabId !== 'debug' && (
                         <button
                            onClick={checkAutoHeal}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: isHealing ? '#3b82f6' : '#a855f7',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: '4px',
                                marginLeft: '8px'
                            }}
                            onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => e.target.style.background = 'transparent'}
                            title="Terminal Auto-Heal (Analyze output)"
                         >
                             <Sparkles size={14} style={{ opacity: isHealing ? 0.5 : 1}} />
                         </button>
                    )}
                </div>

                {healPopup && (
                    <div style={{
                        position: 'absolute',
                        bottom: '90px',
                        right: '40px',
                        background: '#1a1a1a',
                        border: '1px solid #a855f7',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        padding: '12px',
                        borderRadius: '6px',
                        zIndex: 100,
                        color: '#d4d4d4',
                        fontSize: '12px',
                        maxWidth: '450px',
                        wordWrap: 'break-word',
                        whiteSpace: 'pre-wrap',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold', color: '#a855f7', borderBottom: '1px solid #333', paddingBottom: '4px' }}>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Sparkles size={12}/> Auto-Heal Analysis</div>
                           <X size={14} style={{ cursor: 'pointer', color: '#888' }} onClick={() => setHealPopup(null)} />
                        </div>
                        <div style={{ lineHeight: '1.4' }}>{healPopup}</div>
                    </div>
                )}

                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '0 8px' }}>
                    <Search
                        size={14}
                        style={{ cursor: 'pointer', color: showSearch ? '#3b82f6' : '#858585' }}
                        onClick={() => setShowSearch(!showSearch)}
                    />
                    <Trash2
                        size={14}
                        style={{ cursor: 'pointer', color: '#858585' }}
                        onClick={() => window.dispatchEvent(new CustomEvent('terminal:clear'))}
                        title="Clear Terminal Output"
                    />
                    <X
                        size={14}
                        style={{ cursor: 'pointer', color: '#858585' }}
                        onClick={onClose}
                    />
                </div>
            </div>

            <style>{`
                .tab-close:hover { color: #f44336 !important; }
                div:hover > .tab-close { opacity: 1 !important; }
            `}</style>

            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {tabs.map(tab => (
                    <TerminalInstance
                        key={tab.id}
                        id={tab.id}
                        active={activeTabId === tab.id}
                        pendingCommand={pendingCommand}
                        onCommandHandled={onCommandHandled}
                        projectPath={projectPath}
                        onCommandRun={updateTabName}
                    />
                ))}
            </div>
        </div>
    );
};

export default TerminalPanel;
