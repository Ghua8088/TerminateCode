import React, { useState, useEffect } from 'react';
import { FlaskConical, Activity, Box, Binary, Zap, Globe, Cpu, Sparkles, LayoutGrid, TerminalSquare, GitBranch, RefreshCw, Download, ExternalLink } from 'lucide-react';
import pytron from 'pytron-client';
import { useToast, useTheme } from 'pytron-ui/react';

const ToolsPanel = ({ onOpenTool, onLaunchCliProvider }) => {
    const [customTools, setCustomTools] = useState([]);
    const [cliProviders, setCliProviders] = useState([]);
    const [loadingCli, setLoadingCli] = useState(false);
    const { addToast } = useToast();
    const theme = useTheme();
    const tools = [
        { id: 'agent_lab', name: 'Agent Lab', icon: <Zap size={18} color="#f1c40f" fill="#f1c40f" />, desc: 'Execute backend automation scripts' },
        { id: 'regex', name: 'Regex Lab', icon: <FlaskConical size={18} color="#4caf50" />, desc: 'Test Python regex patterns' },
        { id: 'metrics', name: 'Code X-Ray', icon: <Activity size={18} color="#4fc1ff" />, desc: 'Analyze code complexity' },
        { id: 'imports', name: 'Import Lens', icon: <Box size={18} color="#ff9800" />, desc: 'Manage dependencies' },
        { id: 'bytecode', name: 'Bytecode Viewer', icon: <Binary size={18} color="#9b59b6" />, desc: 'View Python bytecode' },
        { id: 'preview', name: 'Web Preview', icon: <Globe size={18} color="#e91e63" />, desc: 'Live web preview' },
        { id: 'format', name: 'Format Code', icon: <Zap size={18} color="#f1c40f" />, desc: 'Format with Black' },
        { id: 'extensions', name: 'Extensions', icon: <LayoutGrid size={18} color="#3b82f6" />, desc: 'Install VS Code compatible extensions' },
    ];

    const fetchCliProviders = async () => {
        setLoadingCli(true);
        try {
            const res = await pytron.list_cli_providers();
            if (res.success) {
                setCliProviders(res.providers || []);
            } else {
                addToast('Failed to load CLI providers: ' + res.error, { type: 'error' });
            }
        } catch (e) {
            addToast('Failed to load CLI providers', { type: 'error' });
        } finally {
            setLoadingCli(false);
        }
    };

    useEffect(() => {
        const fetchCustomTools = async () => {
            try {
                const res = await pytron.get_custom_tools();
                if (res.success) {
                    setCustomTools(res.tools);
                }
            } catch (e) {
                console.error("Failed to fetch custom tools", e);
            }
        }
        fetchCustomTools();
        fetchCliProviders();
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: theme.surface }}>
            <div style={{
                padding: '10px',
                fontSize: '11px',
                fontWeight: 'bold',
                color: theme.fg,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: theme.bg,
                borderBottom: `1px solid ${theme.border}`
            }}>
                <span>TOOLS</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <RefreshCw size={12} style={{ cursor: 'pointer' }} onClick={fetchCliProviders} title="Refresh" />
                </div>
            </div>

            <div style={{
                padding: '14px 14px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '10px',
                        background: 'rgba(59, 130, 246, 0.14)',
                        border: '1px solid rgba(59, 130, 246, 0.24)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Sparkles size={16} color="#60a5fa" />
                    </div>
                    <div>
                        <div style={{ color: '#f4f4f5', fontSize: '13px', fontWeight: 700 }}>AI Tool Deck</div>
                        <div style={{ color: '#9ca3af', fontSize: '11px' }}>The tools your AI can call, inspect, and apply</div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
                    {[
                        { label: 'tools', value: tools.length + cliProviders.length, icon: LayoutGrid },
                        { label: 'local', value: 'on', icon: TerminalSquare },
                        { label: 'repo', value: 'live', icon: GitBranch },
                    ].map((chip) => {
                        const Icon = chip.icon;
                        return (
                            <div key={chip.label} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 10px',
                                borderRadius: '10px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                color: '#e5e7eb',
                                fontSize: '11px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em'
                            }}>
                                <Icon size={13} color="#60a5fa" />
                                <span>{chip.label}</span>
                                <strong style={{ marginLeft: 'auto', color: '#fff' }}>{chip.value}</strong>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                <div style={{ marginBottom: '12px' }}>
                    <div style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#9ca3af',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        marginBottom: '8px'
                    }}>
                        Core Actions
                    </div>
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {tools.map(tool => (
                            <div
                                key={tool.id}
                                onClick={() => onOpenTool(tool.id)}
                                className="tool-item"
                                style={{
                                    display: 'flex',
                                    gap: '12px',
                                    padding: '12px',
                                    borderRadius: '14px',
                                    cursor: 'pointer',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                    transition: 'transform 0.18s ease, border-color 0.18s ease, background 0.18s ease'
                                }}
                            >
                                <div style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.04)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    {tool.icon}
                                </div>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                        <div style={{ color: '#f4f4f5', fontSize: '13px', fontWeight: 700 }}>{tool.name}</div>
                                        <span style={{
                                            fontSize: '10px',
                                            color: '#93c5fd',
                                            background: 'rgba(59, 130, 246, 0.12)',
                                            border: '1px solid rgba(59, 130, 246, 0.18)',
                                            padding: '2px 8px',
                                            borderRadius: '999px',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.08em'
                                        }}>
                                            ready
                                        </span>
                                    </div>
                                    <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '4px', lineHeight: 1.5 }}>{tool.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        marginBottom: '8px'
                    }}>
                        <div style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#9ca3af',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase'
                        }}>
                            CLI Agents
                        </div>
                        <button
                            onClick={fetchCliProviders}
                            disabled={loadingCli}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                borderRadius: '999px',
                                border: '1px solid rgba(255,255,255,0.08)',
                                background: 'rgba(255,255,255,0.03)',
                                color: '#cbd5e1',
                                padding: '6px 10px',
                                fontSize: '10px',
                                cursor: loadingCli ? 'not-allowed' : 'pointer'
                            }}
                        >
                            <RefreshCw size={12} />
                            <span>{loadingCli ? 'Checking' : 'Refresh'}</span>
                        </button>
                    </div>
                    <div style={{ display: 'grid', gap: '10px' }}>
                        {cliProviders.map((provider) => (
                            <div
                                key={provider.id}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px',
                                    padding: '14px',
                                    borderRadius: '16px',
                                    background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.025))',
                                    border: provider.installed
                                        ? '1px solid rgba(96, 165, 250, 0.18)'
                                        : '1px solid rgba(251, 191, 36, 0.16)',
                                    boxShadow: '0 10px 24px rgba(0,0,0,0.12)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <div style={{ color: '#f4f4f5', fontSize: '14px', fontWeight: 700 }}>{provider.name}</div>
                                            <span style={{
                                                fontSize: '10px',
                                                color: provider.installed ? '#bfdbfe' : '#fde68a',
                                                background: provider.installed ? 'rgba(59,130,246,0.14)' : 'rgba(245,158,11,0.12)',
                                                border: provider.installed ? '1px solid rgba(59,130,246,0.2)' : '1px solid rgba(245,158,11,0.2)',
                                                padding: '2px 8px',
                                                borderRadius: '999px',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.08em'
                                            }}>
                                                {provider.installed ? 'installed' : 'missing'}
                                            </span>
                                        </div>
                                        <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '4px', lineHeight: 1.5 }}>
                                            {provider.description}
                                        </div>
                                    </div>
                                </div>

                                <div style={{
                                    padding: '10px 12px',
                                    borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    <div style={{ fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#93c5fd', marginBottom: '6px' }}>
                                        Terminal Command
                                    </div>
                                    <div style={{ color: '#f8fafc', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace' }}>
                                        {provider.launch_command}
                                    </div>
                                    {provider.resolved_path && (
                                        <div style={{ color: '#64748b', fontSize: '10px', marginTop: '6px', wordBreak: 'break-all' }}>
                                            {provider.resolved_path}
                                        </div>
                                    )}
                                </div>

                                <div style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: 1.6 }}>
                                    {provider.auth_hint}
                                    {provider.windows_note ? ` ${provider.windows_note}` : ''}
                                </div>

                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => onLaunchCliProvider?.(provider.id, provider.installed ? 'launch' : 'install')}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '9px 12px',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            border: provider.installed ? '1px solid rgba(96,165,250,0.26)' : '1px solid rgba(251,191,36,0.26)',
                                            background: provider.installed
                                                ? 'linear-gradient(135deg, rgba(59,130,246,0.18), rgba(14,165,233,0.18))'
                                                : 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(234,88,12,0.16))',
                                            color: provider.installed ? '#dbeafe' : '#fde68a',
                                            fontSize: '12px',
                                            fontWeight: 600
                                        }}
                                    >
                                        {provider.installed ? <TerminalSquare size={14} /> : <Download size={14} />}
                                        <span>{provider.installed ? 'Open in Terminal' : 'Queue Install'}</span>
                                    </button>
                                    <button
                                        onClick={() => pytron.shell_open_external(provider.docs_url)}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '9px 12px',
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            background: 'rgba(255,255,255,0.03)',
                                            color: '#e2e8f0',
                                            fontSize: '12px',
                                            fontWeight: 600
                                        }}
                                    >
                                        <ExternalLink size={14} />
                                        <span>Docs</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {customTools.length > 0 && (
                    <div style={{ marginTop: '18px' }}>
                        <div style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            color: '#9ca3af',
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            marginBottom: '8px'
                        }}>
                            User Extensions
                        </div>
                        <div style={{ display: 'grid', gap: '10px' }}>
                            {customTools.map((tool, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        display: 'flex',
                                        gap: '12px',
                                        padding: '12px',
                                        borderRadius: '14px',
                                        background: 'rgba(255,255,255,0.025)',
                                        border: '1px solid rgba(255,255,255,0.05)',
                                        opacity: 0.9
                                    }}
                                >
                                    <div style={{
                                        width: '38px',
                                        height: '38px',
                                        borderRadius: '12px',
                                        background: 'rgba(0, 188, 212, 0.08)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <Cpu size={18} color="#22d3ee" />
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ color: '#f4f4f5', fontSize: '13px', fontWeight: 700 }}>{tool.name}</div>
                                        <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '4px', lineHeight: 1.5 }}>{tool.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                .tool-item:hover {
                    background: rgba(255,255,255,0.055) !important;
                    border-color: rgba(96, 165, 250, 0.25) !important;
                    transform: translateY(-2px);
                }
            `}</style>
        </div>
    );
};

export default ToolsPanel;
