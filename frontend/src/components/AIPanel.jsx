import React, { useState, useRef, useEffect } from 'react';
import pytron from 'pytron-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    Send, Bot, User, Trash2, Plus, Sparkles, MessageSquare,
    History, ChevronRight, ChevronDown, ChevronUp, Mic,
    ShieldAlert, X, Square, Loader2, Lightbulb, RotateCcw,
    Brain, Download, Search
} from 'lucide-react';
import { useToast, useTheme } from 'pytron-ui/react';
import ConfirmModal from './ConfirmModal';
import './PanelStyles.css';

let messageSeq = 0;
const nextMessageId = (prefix = 'msg') => `${prefix}_${Date.now()}_${messageSeq++}`;

const ThinkBlock = ({ children }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    return (
        <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            margin: '12px 0',
            overflow: 'hidden',
            fontSize: '13px'
        }}>
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{
                    padding: '8px 12px',
                    background: 'var(--bg-hover)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    fontWeight: '600',
                    borderBottom: !isCollapsed ? '1px solid var(--border-subtle)' : 'none'
                }}>
                <Lightbulb size={14} style={{ color: 'var(--accent-color)' }} />
                <span>Thought Process</span>
                <div style={{ marginLeft: 'auto' }}>
                    {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </div>
            </div>
            {!isCollapsed && (
                <div style={{
                    padding: '12px 14px',
                    color: 'var(--text-secondary)',
                    fontStyle: 'italic',
                    lineHeight: '1.6',
                    background: 'var(--bg-primary)'
                }}>
                    {children}
                </div>
            )}
        </div>
    );
};

const ModelHubModal = ({ isOpen, onClose, onModelAdded }) => {
    const [query, setQuery] = useState('phi');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [progressInfo, setProgressInfo] = useState(null);
    const [selectedRepo, setSelectedRepo] = useState(null);
    const [repoFiles, setRepoFiles] = useState([]);
    
    useEffect(() => {
        if (!isOpen) return;
        const handleProgress = (data) => {
            setProgressInfo(data);
        };
        const handleComplete = (data) => {
            setDownloading(false);
            if (data.success) {
                onModelAdded();
                onClose();
            } else {
                alert('Download failed: ' + data.error);
            }
        };
        pytron.on('hf_download_progress', handleProgress);
        pytron.on('hf_download_complete', handleComplete);
        return () => {
            pytron.off('hf_download_progress', handleProgress);
            pytron.off('hf_download_complete', handleComplete);
        };
    }, [isOpen, onClose, onModelAdded]);

    const handleSearch = async () => {
        setLoading(true);
        setSelectedRepo(null);
        const res = await pytron.search_hf_models(query, 15);
        if (res.success) {
            setResults(res.models);
        }
        setLoading(false);
    };

    const handleSelectRepo = async (repoId) => {
        setSelectedRepo(repoId);
        setRepoFiles([]);
        setLoading(true);
        const res = await pytron.get_hf_model_files(repoId);
        if (res.success) {
            setRepoFiles(res.files);
        }
        setLoading(false);
    };

    const handleDownload = async (filename) => {
        setDownloading(true);
        setProgressInfo(null);
        await pytron.download_hf_model(selectedRepo, filename);
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 1000, 
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div style={{
                background: '#1e1e1e', borderRadius: '12px', border: '1px solid #333',
                width: '600px', maxWidth: '90%', maxHeight: '80%', display: 'flex', flexDirection: 'column',
                boxShadow: '0 12px 40px rgba(0,0,0,0.4)', overflow: 'hidden'
            }}>
                <div style={{ padding: '16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a855f7', fontWeight: 'bold' }}>
                        <Brain size={18} /> HuggingFace GGUF Hub
                    </div>
                    <X size={18} style={{ cursor: 'pointer', color: '#888' }} onClick={onClose} />
                </div>
                
                <div style={{ padding: '16px', display: 'flex', gap: '8px' }}>
                    <input 
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="Search models (e.g., Llama-3, Phi-3, Mistral)"
                        className="sleek-input"
                        style={{ flex: 1, padding: '8px 12px', background: '#252526', border: '1px solid #333', borderRadius: '6px', color: '#fff' }}
                    />
                    <button onClick={handleSearch} disabled={loading} className="sleek-button primary" style={{ padding: '0 16px', borderRadius: '6px' }}>
                        <Search size={16} />
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px', minHeight: '300px' }}>
                    {loading && !downloading && <div style={{ color: '#888', textAlign: 'center', padding: '20px' }}>Loading...</div>}
                    
                    {!selectedRepo ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {results.map((m, i) => (
                                <div key={i} onClick={() => handleSelectRepo(m.id)} className="hover-bg" style={{ padding: '12px', border: '1px solid #333', borderRadius: '6px', cursor: 'pointer' }}>
                                    <div style={{ fontWeight: 'bold', color: '#e0e0e0' }}>{m.id}</div>
                                    <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                                        Downloads: {m.downloads.toLocaleString()} | Tags: {m.tags.filter(t=>['gguf', 'llama-cpp'].includes(t)).join(', ')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div>
                            <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', cursor: 'pointer', color: '#a855f7', fontSize: '12px' }} onClick={() => setSelectedRepo(null)}>
                                ← Back to results
                            </div>
                            <h4 style={{ margin: '0 0 12px 0', color: '#fff' }}>Files for {selectedRepo}</h4>
                            {repoFiles.length === 0 && !loading && <div style={{ color: '#888' }}>No .gguf files found in root tree.</div>}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {repoFiles.map((f, i) => (
                                    <div key={i} style={{ padding: '12px', border: '1px solid #333', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ wordBreak: 'break-all', fontSize: '13px', color: '#e0e0e0' }}>{f.path}</div>
                                        <button 
                                            onClick={() => handleDownload(f.path)}
                                            disabled={downloading}
                                            className="sleek-button"
                                            style={{ background: downloading ? '#333' : '#a855f7', color: '#fff', padding: '6px 12px', borderRadius: '4px', fontSize: '12px', display: 'flex', gap: '6px' }}
                                        >
                                            <Download size={14} /> Download
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {downloading && progressInfo && (
                                <div style={{ marginTop: '20px', padding: '16px', background: '#252526', borderRadius: '6px', border: '1px solid #444' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px', color: '#ccc' }}>
                                        <span>Downloading {progressInfo.filename}</span>
                                        <span>{progressInfo.progress}%</span>
                                    </div>
                                    <div style={{ height: '6px', background: '#111', borderRadius: '3px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${progressInfo.progress}%`, background: '#a855f7', transition: 'width 0.3s' }}></div>
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#888', marginTop: '8px', textAlign: 'right' }}>
                                        {progressInfo.downloaded_mb} MB / {progressInfo.total_mb} MB
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const summarizeToolCall = (name, args) => {
    if (!args || typeof args !== 'object') {
        return `Running ${name || 'tool'}...`;
    }

    if (typeof args.command === 'string' && args.command.trim()) {
        return args.command.trim();
    }

    if (typeof args.path === 'string' && args.path.trim()) {
        return args.path.trim();
    }

    if (typeof args.prompt === 'string' && args.prompt.trim()) {
        return args.prompt.trim();
    }

    const compact = JSON.stringify(args);
    return compact && compact !== '{}' ? compact : `Running ${name || 'tool'}...`;
};

const ToolCallMessage = ({ msg, expanded, onToggle, onAllow, onDeny }) => {
    const isCompleted = msg.result !== undefined;
    const isPending = !!msg.pendingAuth;
    const isRunning = !isCompleted && !isPending && !msg.error;
    const isCommand = msg.name === 'execute_command';
    
    // Status Icon Logic
    let Icon = isRunning ? Loader2 : ChevronRight;
    let iconColor = isRunning ? '#4fc1ff' : '#4ade80';
    if (isPending) {
        Icon = ShieldAlert;
        iconColor = '#ff9800';
    }

    // Safeguard for args
    let displayArgs = msg.args;
    try {
        if (typeof msg.args === 'string') displayArgs = JSON.parse(msg.args);
    } catch(e) {}
    const summaryText = msg.summary || summarizeToolCall(msg.name, displayArgs);
    const cardVariantClass = isPending ? 'is-pending' : isCommand ? 'is-command' : 'is-default';
    const headerStateClass = expanded ? 'is-expanded' : 'is-collapsed';

    return (
        <div className={`ai-tool-card ${cardVariantClass} ${expanded || isPending ? '' : 'is-collapsed'}`}>
            {/* Header / Summary Line */}
            <div 
                className={`ai-tool-header ${headerStateClass} ${isPending ? 'is-pending' : ''}`}
                onClick={onToggle}
            >
                <div className="ai-tool-icon" style={{ color: iconColor }}>
                    <Icon size={15} className={isRunning ? 'animate-spin' : ''} />
                </div>
                
                <div className="ai-tool-main">
                    <div className="ai-tool-title-row">
                        <span className="ai-tool-name">
                            {msg.name || 'Tool Call'}
                        </span>
                        <span
                            className="ai-tool-status"
                            style={{
                                color: isPending ? '#fbbf24' : isCommand ? '#93c5fd' : '#a78bfa',
                                background: isPending ? 'rgba(245, 158, 11, 0.08)' : isCommand ? 'rgba(59, 130, 246, 0.10)' : 'rgba(167, 139, 250, 0.10)',
                                border: `1px solid ${isPending ? 'rgba(245, 158, 11, 0.2)' : isCommand ? 'rgba(59, 130, 246, 0.18)' : 'rgba(167, 139, 250, 0.18)'}`,
                            }}
                        >
                            {isPending ? 'approval' : isCommand ? 'terminal visible' : isCompleted ? 'done' : 'running'}
                        </span>
                    </div>

                    {!expanded && !isPending && (
                        <span className="ai-tool-summary">
                            {summaryText}
                        </span>
                    )}
                </div>

                <div className="ai-tool-chevron">
                    {expanded ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
                </div>
            </div>

            {/* Pending Auth Block */}
            {isPending && (
                 <div style={{
                    padding: '14px',
                    background: 'rgba(255, 152, 0, 0.08)'
                }}>
                    <div style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: '8px', fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                         Permission Required
                    </div>
                    <div style={{ fontSize: '12px', color: '#e5e7eb', marginBottom: '12px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                        {msg.pendingAuth.message}
                    </div>
                    {msg.pendingAuth.diff && (
                        <pre style={{
                            fontSize: '11px',
                            background: 'rgba(0,0,0,0.35)',
                            padding: '10px',
                            borderRadius: '10px',
                            overflowX: 'auto',
                            marginBottom: '12px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            fontFamily: 'JetBrains Mono, monospace'
                        }}>
                            {msg.pendingAuth.diff}
                        </pre>
                    )}
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onAllow(); }}
                            style={{
                                flex: 1, padding: '6px 12px', 
                                background: '#2e7d32', color: '#fff', border: 'none', 
                                borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            }}
                        >
                            Allow
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDeny(); }}
                            style={{
                                flex: 1, padding: '6px 12px', 
                                background: '#c62828', color: '#fff', border: 'none', 
                                borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                            }}
                        >
                            Deny
                        </button>
                    </div>
                </div>
            )}

            {/* Expanded Content */}
            {expanded && !isPending && (
                <div className="ai-tool-body">
                    <div className="ai-tool-note">
                        {summaryText}
                    </div>

                    <div className="ai-tool-section">
                        <div className="ai-tool-label">Input</div>
                        <pre className="ai-tool-pre is-input">
                            {JSON.stringify(displayArgs ?? {}, null, 2)}
                        </pre>
                    </div>
                    {msg.result !== undefined && (
                        <div className="ai-tool-section">
                            <div className="ai-tool-label">Result</div>
                            <pre className="ai-tool-pre is-result">
                                {msg.result || "(No output)"}
                            </pre>
                        </div>
                    )}
                    {msg.result === undefined && (
                        <div className="ai-tool-waiting">
                            Waiting for tool output...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const AIPanel = ({ activePath, onClose, messages: externalMessages, setMessages: setExternalMessages }) => {
    const [internalMessages, setInternalMessages] = useState([]);
    const messages = externalMessages || internalMessages;
    const setMessages = setExternalMessages || setInternalMessages;
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('gemini-flash-latest');
    const [quotaError, setQuotaError] = useState(false);
    const [expandedTools, setExpandedTools] = useState({});
    const [sessions, setSessions] = useState({}); // { id: { title, timestamp } }
    const [currentSessionId, setCurrentSessionId] = useState(() => 'sess_' + Date.now());
    const [showHistory, setShowHistory] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const [showModelHub, setShowModelHub] = useState(false);
    const messagesEndRef = useRef(null);

    const fetchModels = async () => {
        try {
            const res = await pytron.get_available_models();
            if (res.success && res.models?.length > 0) {
                setModels(res.models);
                setIsReady(true);
                setSelectedModel(current => res.models.find(m => m.id === current) ? current : res.models[0].id);
            }
        } catch (e) { console.error(e); }
    };
    const { addToast } = useToast();
    const theme = useTheme();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        fetchModels();
        const fetchSessions = async () => {
            try {
                const res = await pytron.list_chat_sessions();
                if (res.success && res.sessions) setSessions(res.sessions);
            } catch (e) { console.error(e); }
        };

        fetchSessions();
        const interval = setInterval(fetchModels, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const unlisten = pytron.on('ai_agent_event', (event) => {
            const { type, content, name, args, id, result } = event;
            if (type === 'token') {
                if (!content) return; // Prevent empty bubbles
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    const isNewAssistantTurn = !last || last.role !== 'assistant';

                    if (isNewAssistantTurn) {
                        setExpandedTools(prev => ({ ...prev }));
                        return [...prev, { id: nextMessageId('assistant'), role: 'assistant', content: content }];
                    } else {
                        return [...prev.slice(0, -1), { ...last, content: (last.content || '') + content }];
                    }
                });
            } else if (type === 'tool_call') {
                setExpandedTools(prev => ({ ...prev, [id]: false }));
                setMessages(prev => {
                    const existingIndex = prev.findIndex(msg => msg.role === 'tool_call' && msg.id === id);
                    if (existingIndex !== -1) {
                        return prev.map(msg =>
                            msg.role === 'tool_call' && msg.id === id
                                ? { ...msg, name, args }
                                : msg,
                        );
                    }
                    return [...prev, { id, role: 'tool_call', name, args }];
                });
            } else if (type === 'tool_result') {
                setMessages(prev => prev.map(msg => (msg.role === 'tool_call' && msg.id === id) ? { ...msg, result } : msg));
            } else if (type === 'finish') {
                setLoading(false);
            } else if (type === 'confirm_required') {
                setMessages(prev => prev.map(m => 
                    (m.role === 'tool_call' && m.id === id) 
                    ? { ...m, pendingAuth: { message: event.message, diff: event.diff } }
                    : m
                ));
            } else if (type === 'error') {
                const isQuotaLike = typeof content === 'string' && (
                    content.includes('RESOURCE_EXHAUSTED') ||
                    content.includes('429') ||
                    content.toLowerCase().includes('quota exceeded') ||
                    content.toLowerCase().includes('rate limit')
                );
                if (isQuotaLike) {
                    setQuotaError(true);
                }
                setLoading(false);
                addToast('AI Agent Error: ' + content, { type: 'error' });
            }
        });
        return () => unlisten?.();
    }, []);

    const saveTimeoutRef = useRef(null);
    const isSwitchingSessionRef = useRef(false);

    // Session persistence
    useEffect(() => {
        if (messages.length > 0 && !isSwitchingSessionRef.current) {
            clearTimeout(saveTimeoutRef.current);
            const idToSave = currentSessionId;
            const msgsToSave = messages;
            saveTimeoutRef.current = setTimeout(() => {
                if (!isSwitchingSessionRef.current) {
                    pytron.save_chat_session(idToSave, msgsToSave).then(() => {
                        pytron.list_chat_sessions().then(r => r.success && setSessions(r.sessions));
                    });
                }
            }, 800);
        }
    }, [messages, currentSessionId]);

    const handleNewChat = () => {
        isSwitchingSessionRef.current = true;
        clearTimeout(saveTimeoutRef.current);
        setMessages([]);
        setCurrentSessionId('sess_' + Date.now());
        setShowHistory(false);
        setTimeout(() => { isSwitchingSessionRef.current = false; }, 200);
    };

    const loadSession = async (id) => {
        try {
            isSwitchingSessionRef.current = true;
            clearTimeout(saveTimeoutRef.current);
            const res = await pytron.load_chat_session(id);
            if (res.success) {
                setCurrentSessionId(id);
                setMessages(res.messages);
                setShowHistory(false);
                setTimeout(() => { isSwitchingSessionRef.current = false; }, 200);
            } else {
                isSwitchingSessionRef.current = false;
            }
        } catch (e) {
            isSwitchingSessionRef.current = false;
            addToast('Failed to load session', { type: 'error' });
        }
    };

    const deleteSession = async (e, id) => {
        e.stopPropagation();
        try {
            const res = await pytron.delete_chat_session(id);
            if (res.success) {
                const refreshed = await pytron.list_chat_sessions();
                setSessions(refreshed.sessions || {});
                if (currentSessionId === id) handleNewChat();
            }
        } catch (e) { }
    };

    const handleStop = async () => {
        try {
            await pytron.interrupt_ai();
        } catch (e) { console.error('Failed to interrupt AI', e); }
    };

    const handleRollback = async () => {
        try {
            const res = await pytron.undo_last_change();
            if (res.includes('Successfully') || res.includes('Undone') || res.includes('Restored')) {
                addToast(res, { type: 'success' });
            } else {
                addToast(res, { type: 'info' });
            }
        } catch (e) { addToast('Rollback failed', { type: 'error' }); }
    };

    const handleSend = async () => {
        if (!input.trim() || loading || !isReady) return;

        setQuotaError(false);
        const userMsg = { id: nextMessageId('user'), role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // Prepare context if there's an active file
            let prompt = input;
            if (activePath) {
                try {
                    const fileRes = await pytron.read_file_content(activePath);
                    if (fileRes.success) {
                        prompt = `Context: Current file is ${activePath.split(/[\\/]/).pop()}\n\nCode:\n\`\`\`\n${fileRes.content}\n\`\`\`\n\nUser Question: ${input}`;
                    }
                } catch (e) { console.error('Failed to read context file', e); }
            }

            const res = await pytron.ask_ai(prompt, messages, selectedModel);
            if (!res.success) {
                const isQuotaError = res.error?.includes("RESOURCE_EXHAUSTED") ||
                    res.error?.toLowerCase().includes("quota exceeded");
                if (isQuotaError) {
                    setQuotaError(true);
                } else {
                    addToast('AI Error: ' + res.error, { type: 'error' });
                }
                setLoading(false); // Stop loading if request failed immediately
            }
            // If success, loading stays true until 'finish' event arrives
        } catch (err) {
            addToast('Request failed: ' + err.message, { type: 'error' });
            setLoading(false);
        }
    };

    const clearChat = () => {
        setShowClearConfirm(true);
    };

    const executeClear = () => {
        setMessages([]);
    };

    if (quotaError) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', background: theme.bg, color: theme.fg }}>
                <ShieldAlert size={56} color="#f44336" style={{ marginBottom: '20px' }} />
                <h2 style={{ marginBottom: '12px', fontSize: '18px' }}>Quota Exceeded</h2>
                <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '24px', lineHeight: '1.6' }}>
                    Your AI model quota has been reached. This usually happens if you're on a free tier or have hit rate limits.
                    Please wait a moment or check your API provider's billing dashboard.
                </p>
                <button
                    onClick={() => setQuotaError(false)}
                    style={{
                        padding: '10px 20px',
                        background: '#007fd4',
                        border: 'none',
                        borderRadius: '6px',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 'bold'
                    }}
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (!isReady) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center', color: theme.fg }}>
                <ShieldAlert size={48} color="#ff9800" style={{ marginBottom: '16px' }} />
                <h3 style={{ marginBottom: '8px' }}>No AI Models Available</h3>
                <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>
                    Please add an API key (Google, OpenAI, Anthropic) in Settings.
                </p>
            </div>
        );
    }

    return (
        <div className="panel-container" style={{ 
            background: 'linear-gradient(180deg, rgba(15,15,17,0.98), rgba(10,10,12,0.98))', 
            minHeight: 0, 
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden' 
        }}>
            <div className="panel-header">
                <div className="panel-header-title">
                    <Sparkles size={14} style={{ color: 'var(--accent-color)' }} />
                    <span>CHAT</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button className="sleek-button" onClick={handleRollback} title="Rollback Last AI Change">
                        <RotateCcw size={14} />
                    </button>
                    <button className="sleek-button" onClick={() => setShowHistory(!showHistory)} title="Chat History">
                        <History size={14} />
                    </button>
                    <button className="sleek-button" onClick={handleNewChat} title="New Chat">
                        <Plus size={14} />
                    </button>
                    <button className="sleek-button" onClick={clearChat} title="Clear Current">
                        <Trash2 size={14} />
                    </button>
                    {onClose && (
                        <button className="sleek-button" onClick={onClose} title="Close Panel">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {showHistory && (
                <div style={{
                    flexShrink: 0,
                    maxHeight: '32%',
                    overflowY: 'auto',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)'
                }}>
                    <div style={{ padding: '8px 12px', fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Recent Chats</div>
                    {Object.values(sessions).sort((a, b) => b.timestamp - a.timestamp).map(sess => (
                        <div
                            key={sess.id}
                            onClick={() => loadSession(sess.id)}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: sess.id === currentSessionId ? 'var(--bg-hover)' : 'transparent',
                                color: sess.id === currentSessionId ? 'var(--text-active)' : 'var(--text-secondary)',
                                borderLeft: sess.id === currentSessionId ? '2px solid var(--accent-color)' : '2px solid transparent'
                            }}
                        >
                            <MessageSquare size={13} style={{ opacity: 0.6 }} />
                            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sess.title}</span>
                            <div onClick={(e) => deleteSession(e, sess.id)} style={{ padding: '4px', cursor: 'pointer' }}>
                                <Trash2 size={12} color="#f44336" />
                            </div>
                        </div>
                    ))}
                    {Object.keys(sessions).length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>No saved sessions.</div>
                    )}
                </div>
            )}

            <div className="ai-messages-shell" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div className="ai-messages-viewport" style={{ flex: 1, overflowY: 'auto' }}>
                {messages.length === 0 && (
                    <div className="ai-empty-state">
                        <Bot size={48} style={{ opacity: 0.2, marginBottom: '16px' }} />
                        <p>Ask the AI assistant to explain code, fix bugs, or write something new.</p>
                    </div>
                )}
                {messages.map((msg, idx) => {
                    const isTool = msg.role === 'tool_call';
                    const messageKey = msg.id || `msg-${idx}`;
                    
                    if (isTool) {
                        return (
                            <ToolCallMessage 
                                key={messageKey}
                                msg={msg}
                                expanded={expandedTools[msg.id]}
                                onToggle={() => setExpandedTools(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                                onAllow={() => {
                                    pytron.confirm_tool(msg.id, true).then(() => {
                                        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pendingAuth: null } : m));
                                    });
                                }}
                                onDeny={() => {
                                    pytron.confirm_tool(msg.id, false).then(() => {
                                        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pendingAuth: null } : m));
                                    });
                                }}
                            />
                        );
                    }

                    const isUser = msg.role === 'user';
                    
                    const renderContent = (content) => {
                        const markdownComponents = {
                            code({node, inline, className, children, ...props}) {
                                return !inline ? (
                                    <div className="ai-markdown-codeblock">
                                        <code className={className} {...props}>{children}</code> 
                                    </div>
                                ) : (
                                    <code className={`ai-markdown-inline-code ${className || ''}`.trim()} {...props}>{children}</code>
                                )
                            }
                        };

                        if (!content.includes('<think>')) {
                            return <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{content}</ReactMarkdown>;
                        }

                        const parts = content.split(/(<think>[\s\S]*?(?:<\/think>|$))/gi);
                        return parts.map((part, index) => {
                            if (part.toLowerCase().startsWith('<think>')) {
                                const thinkContent = part.replace(/^<think>/i, '').replace(/<\/think>$/i, '');
                                return (
                                    <ThinkBlock key={index}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{thinkContent}</ReactMarkdown>
                                    </ThinkBlock>
                                );
                            }
                            if (part.trim() || part.includes('\n')) {
                                return <ReactMarkdown key={index} remarkPlugins={[remarkGfm]} components={markdownComponents}>{part}</ReactMarkdown>;
                            }
                            return null;
                        });
                    };

                    return (
                        <div key={messageKey} className={`chat-bubble ${isUser ? 'user' : 'ai'}`}>
                            {!isUser && (
                                <div style={{ 
                                    display: 'flex', 
                                    gap: '6px', 
                                    marginBottom: '6px', 
                                    alignItems: 'center',
                                    color: 'var(--accent-color)', 
                                    fontSize: '11px', fontWeight: '600' 
                                }}>
                                    <Bot size={12} />
                                    <span>ASSISTANT</span>
                                </div>
                            )}
                            <div className="ai-markdown">
                                {renderContent(msg.content || '')}
                            </div>
                        </div>
                    );
                })}
                {loading && (
                    <div style={{ display: 'flex', gap: '8px', padding: '12px', alignItems: 'center', color: 'var(--text-secondary)' }}>
                        <Loader2 size={16} className="animate-spin" />
                        <span style={{ fontSize: '12px' }}>Thinking...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
                </div>
            </div>

            <div className="ai-composer-shell">
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'linear-gradient(180deg, rgba(39,39,42,0.95), rgba(24,24,27,0.96))',
                    borderRadius: '14px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    padding: '10px',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.24)'
                }}>
                    <textarea
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 180) + 'px';
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                                e.target.style.height = '40px';
                            }
                        }}
                        placeholder="Ask anything, @ to mention, / for workflows"
                        className="sleek-input"
                        style={{
                            border: 'none',
                            background: 'transparent',
                            minHeight: '40px',
                            maxHeight: '180px',
                            resize: 'none',
                            padding: '4px',
                            width: '100%',
                            color: '#f4f4f5',
                            boxSizing: 'border-box'
                        }}
                    />

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginTop: '10px',
                        paddingTop: '10px',
                        borderTop: '1px solid rgba(255,255,255,0.06)'
                    }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="sleek-button" title="Attach Files (Alt+A)">
                                <Plus size={14} />
                            </button>
                            <div 
                                className="model-selector-custom hover-bg"
                                style={{ 
                                    position: 'relative', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '6px', 
                                    fontSize: '11px', 
                                    color: 'var(--text-secondary)', 
                                    cursor: 'pointer', 
                                    padding: '4px 10px', 
                                    borderRadius: '6px', 
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-primary)',
                                    fontWeight: '500'
                                }}
                            >
                                <Sparkles size={12} style={{ color: 'var(--accent-color)' }} />
                                <span>{models.find(m => m.id === selectedModel)?.name || 'AI Model'}</span>
                                <ChevronDown size={12} style={{ opacity: 0.5 }} />
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        opacity: 0,
                                        cursor: 'pointer',
                                        width: '100%',
                                        height: '100%'
                                    }}
                                    title="Select AI Model"
                                >
                                    {models.map(m => (
                                        <option key={m.id} value={m.id}>{m.name} ({m.provider || 'local'})</option>
                                    ))}
                                </select>
                            </div>
                            <button 
                                onClick={() => setShowModelHub(true)}
                                className="hover-bg" 
                                style={{
                                    background: 'transparent', border: '1px solid var(--border-subtle)', 
                                    color: 'var(--text-secondary)', padding: '4px 8px', borderRadius: '6px',
                                    display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px'
                                }}
                                title="Download Llama/GGUF Models from HuggingFace"
                            >
                                <Download size={12} /> Hub
                            </button>
                        </div>

                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {loading && (
                                <button
                                    onClick={handleStop}
                                    className="sleek-button"
                                    style={{ color: '#f44336', gap: '4px', padding: '4px 8px', fontSize: '11px' }}
                                    title="Interrupt AI"
                                >
                                    <Square size={10} fill="#f44336" stroke="none" />
                                    STOP
                                </button>
                            )}
                            <button
                                onClick={handleSend}
                                disabled={loading || !input.trim() || !isReady}
                                className="sleek-button primary"
                                style={{
                                    opacity: (loading || !input.trim() || !isReady) ? 0.5 : 1,
                                    minWidth: '38px',
                                    minHeight: '38px',
                                    borderRadius: '12px',
                                    boxShadow: '0 8px 20px rgba(59,130,246,0.25)'
                                }}
                            >
                                <Send size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {showClearConfirm && (
                <ConfirmModal
                    isOpen={true}
                    title="Clear Chat"
                    message="Are you sure you want to clear the current chat history? This session index will be kept but messages will be removed."
                    onConfirm={executeClear}
                    onClose={() => setShowClearConfirm(false)}
                    variant="danger"
                />
            )}

            <ModelHubModal 
                isOpen={showModelHub} 
                onClose={() => setShowModelHub(false)} 
                onModelAdded={() => {
                    fetchModels();
                    addToast('Model downloaded successfully! It is now available in the dropdown.', { type: 'success' });
                }} 
            />

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                .session-item .session-delete { opacity: 0; transition: opacity 0.2s; }
                .session-item:hover { background: rgba(255,255,255,0.05); }
                .session-item:hover .session-delete { opacity: 1; }

                .header-icon { color: #888; }
                .header-icon:hover { color: #4fc1ff; }

                .input-container:focus-within {
                    border-color: rgba(79, 193, 255, 0.4) !important;
                    box-shadow: 0 0 0 2px rgba(79, 193, 255, 0.1);
                }

                .input-action-btn {
                    background: transparent;
                    border: none;
                    color: #888;
                    padding: 6px;
                    display: flex;
                    alignItems: center;
                    cursor: pointer;
                    border-radius: 6px;
                    transition: all 0.2s;
                }
                .input-action-btn:hover { background: rgba(255,255,255,0.05); color: #fff; }

                .model-chip {
                    background: transparent;
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #777;
                    padding: 4px 10px;
                    border-radius: 100px;
                    display: flex;
                    alignItems: center;
                    gap: 6px;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                }
                .model-chip:hover { border-color: rgba(255,255,255,0.2); color: #999; }
                .model-chip.active { color: #999; border-color: rgba(79, 193, 255, 0.2); }

                .send-btn {
                    background: #2a2a2c;
                    border: none;
                    color: #fff;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    alignItems: center;
                    justifyContent: center;
                    border-radius: 50%;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .send-btn:not(.disabled):hover { background: #4fc1ff; color: #000; transform: scale(1.05); }
                .send-btn.disabled { opacity: 0.3; cursor: default; }

                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(255, 152, 0, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(255, 152, 0, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 152, 0, 0); }
                }

                @keyframes pulseDot {
                    0% { transform: scale(0.8); opacity: 0.5; box-shadow: 0 0 0 0 rgba(79, 193, 255, 0.4); }
                    50% { transform: scale(1.2); opacity: 1; box-shadow: 0 0 8px 2px rgba(79, 193, 255, 0.2); }
                    100% { transform: scale(0.8); opacity: 0.5; box-shadow: 0 0 0 0 rgba(79, 193, 255, 0); }
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default AIPanel;
