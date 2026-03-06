import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { Trash2, X, RotateCcw, Search, ChevronDown, ChevronUp, Plus, SquareTerminal } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import pytron from 'pytron-client';
import { useTheme } from 'pytron-ui/react';

const TerminalInstance = ({ id, active, onData, onResize, pendingCommand, onCommandHandled }) => {
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
            const cols = term.cols || 80;
            const rows = term.rows || 24;
            const res = await pytron.terminal_init(cwd, cols, rows, id);
            if (res.success) {
                isInitialized.current = true;
                if (active) term.focus();
            }
        } catch (err) { }
    }, [id, active]);

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
            onCommandHandled();
        }
    }, [pendingCommand, onCommandHandled, id, active]);

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
            scrollback: 5000,
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

        term.open(terminalRef.current);
        xtermRef.current = term;

        const handleOutput = (e) => {
            const payload = e.detail || e;
            if (typeof payload === 'object' && payload.sessionId === id) {
                term.write(payload.data);
            } else if (typeof payload === 'string' && id === 'default') {
                term.write(payload);
            }
        };

        const unlisten = pytron.on('terminal:output', handleOutput);

        const init = async () => {
            setTimeout(() => fitAddon.fit(), 100);
            await initTerminal();
            const sync = await pytron.terminal_read(id);
            if (sync.success && sync.output) term.write(sync.output);
        };
        init();

        term.onData(data => isInitialized.current && pytron.terminal_write(data, id));
        term.onResize(({ cols, rows }) => isInitialized.current && pytron.terminal_resize(cols, rows, id));

        const resizeObserver = new ResizeObserver(() => {
            if (active) setTimeout(() => fitAddon.fit(), 50);
        });
        resizeObserver.observe(terminalRef.current);

        return () => {
            unlisten?.();
            resizeObserver.disconnect();
            term.dispose();
            pytron.terminal_close(id);
        };
    }, [id, initTerminal]);

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

const TerminalPanel = ({ onClose, pendingCommand, onCommandHandled }) => {
    const theme = useTheme();
    const [tabs, setTabs] = useState([{ id: 'default', name: 'pwsh' }]);
    const [activeTabId, setActiveTabId] = useState('default');
    const [showSearch, setShowSearch] = useState(false);

    const addTab = () => {
        const id = 'term_' + Date.now();
        setTabs(prev => [...prev, { id, name: 'pwsh-' + (prev.length + 1) }]);
        setActiveTabId(id);
    };

    const closeTab = (e, id) => {
        e.stopPropagation();
        if (tabs.length === 1) {
            onClose();
            return;
        }
        const newTabs = tabs.filter(t => t.id !== id);
        setTabs(newTabs);
        if (activeTabId === id) {
            setActiveTabId(newTabs[newTabs.length - 1].id);
        }
    };

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
                    {tabs.map(tab => {
                        const active = activeTabId === tab.id;
                        return (
                            <div
                                key={tab.id}
                                onClick={() => setActiveTabId(tab.id)}
                                style={{
                                    height: '100%',
                                    padding: '0 12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: active ? '#0a0a0c' : 'transparent',
                                    borderTop: active ? '1px solid #3b82f6' : '1px solid transparent',
                                    cursor: 'pointer',
                                    color: active ? '#fff' : '#858585',
                                    fontSize: '11px',
                                    minWidth: '100px',
                                    maxWidth: '160px',
                                    borderRight: '1px solid var(--border)'
                                }}
                            >
                                <SquareTerminal size={12} color={active ? '#3b82f6' : '#858585'} />
                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.name}</span>
                                <X
                                    size={12}
                                    className="tab-close"
                                    onClick={(e) => closeTab(e, tab.id)}
                                    style={{ opacity: active ? 1 : 0, transition: 'opacity 0.2s' }}
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
                </div>

                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '0 8px' }}>
                    <Search
                        size={14}
                        style={{ cursor: 'pointer', color: showSearch ? '#3b82f6' : '#858585' }}
                        onClick={() => setShowSearch(!showSearch)}
                    />
                    <Trash2
                        size={14}
                        style={{ cursor: 'pointer', color: '#858585' }}
                        onClick={() => {/* To be implemented for active instance */ }}
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
                    />
                ))}
            </div>
        </div>
    );
};

export default TerminalPanel;
