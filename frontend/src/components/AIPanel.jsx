import React, { useState, useRef, useEffect } from 'react';
import pytron from 'pytron-client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Send, Bot, User, Loader2, Trash2, ShieldAlert, X, ChevronDown, ChevronUp, ChevronRight, History, Plus, MessageSquare, BrainCircuit, Paperclip, Mic, Sparkles } from 'lucide-react';
import { useToast, useTheme } from 'pytron-ui/react';
import ConfirmModal from './ConfirmModal';

const ThinkBlock = ({ children }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    return (
        <div style={{
            background: 'rgba(79, 193, 255, 0.03)',
            border: '1px solid rgba(79, 193, 255, 0.1)',
            borderRadius: '8px',
            margin: '8px 0',
            overflow: 'hidden',
            fontSize: '12.5px'
        }}>
            <div
                onClick={() => setIsCollapsed(!isCollapsed)}
                style={{
                    padding: '8px 12px',
                    background: 'rgba(79, 193, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    color: '#4fc1ff',
                    fontWeight: '600'
                }}>
                <BrainCircuit size={14} />
                <span>Reasoning</span>
                <div style={{ marginLeft: 'auto', opacity: 0.5 }}>
                    {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </div>
            </div>
            {!isCollapsed && (
                <div style={{ padding: '12px', color: '#999', fontStyle: 'italic', lineHeight: '1.6' }}>
                    {children}
                </div>
            )}
        </div>
    );
};

const AIPanel = ({ activePath, onClose }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
    const [pendingConfirm, setPendingConfirm] = useState(null);
    const [quotaError, setQuotaError] = useState(false);
    const [expandedTools, setExpandedTools] = useState({});
    const [sessions, setSessions] = useState({}); // { id: { title, timestamp } }
    const [currentSessionId, setCurrentSessionId] = useState(() => 'sess_' + Date.now());
    const [showHistory, setShowHistory] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const messagesEndRef = useRef(null);
    const { addToast } = useToast();
    const theme = useTheme();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
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

        const fetchSessions = async () => {
            try {
                const res = await pytron.list_chat_sessions();
                if (res.success && res.sessions) setSessions(res.sessions);
            } catch (e) { console.error(e); }
        };

        fetchModels();
        fetchSessions();
        const interval = setInterval(fetchModels, 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const unlisten = pytron.on('ai_agent_event', (event) => {
            const { type, content, name, args, id, result } = event;
            if (type === 'token') {
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    const isNewAssistantTurn = !last || last.role !== 'assistant';

                    if (isNewAssistantTurn) {
                        setExpandedTools({});
                        return [...prev, { role: 'assistant', content: content }];
                    } else {
                        return [...prev.slice(0, -1), { ...last, content: last.content + content }];
                    }
                });
            } else if (type === 'tool_call') {
                setExpandedTools(prev => ({ ...prev, [id]: true }));
                setMessages(prev => [...prev, { role: 'tool_call', name, args, id }]);
            } else if (type === 'tool_result') {
                setTimeout(() => setExpandedTools(prev => ({ ...prev, [id]: false })), 1500);
                setMessages(prev => prev.map(msg => (msg.role === 'tool_call' && msg.id === id) ? { ...msg, result } : msg));
            } else if (type === 'confirm_required') {
                setPendingConfirm(event);
            } else if (type === 'error') {
                addToast('AI Agent Error: ' + content, { type: 'error' });
            }
        });
        return () => unlisten?.();
    }, []);

    // Session persistence
    useEffect(() => {
        if (messages.length > 0) {
            pytron.save_chat_session(currentSessionId, messages);
            // Refresh sessions list silently
            pytron.list_chat_sessions().then(r => r.success && setSessions(r.sessions));
        }
    }, [messages, currentSessionId]);

    const handleNewChat = () => {
        setMessages([]);
        setCurrentSessionId('sess_' + Date.now());
        setShowHistory(false);
    };

    const loadSession = async (id) => {
        try {
            const res = await pytron.load_chat_session(id);
            if (res.success) {
                setMessages(res.messages);
                setCurrentSessionId(id);
                setShowHistory(false);
            }
        } catch (e) { addToast('Failed to load session', { type: 'error' }); }
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

    const handleSend = async () => {
        if (!input.trim() || loading || !isReady) return;

        const userMsg = { role: 'user', content: input };
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
            }
        } catch (err) {
            addToast('Request failed: ' + err.message, { type: 'error' });
        } finally {
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
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: theme.bg, userSelect: 'text' }}>
            <div style={{
                padding: '12px 16px',
                fontSize: '11px',
                fontWeight: '700',
                color: theme.fg,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: `1px solid ${theme.border}`,
                background: 'rgba(255, 255, 255, 0.02)',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={14} color="#4fc1ff" />
                    <span style={{ letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.8 }}>Agentic AI</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <History size={16} style={{ cursor: 'pointer', transition: 'color 0.2s' }} className="header-icon" onClick={() => setShowHistory(!showHistory)} title="Chat History" />
                    <Plus size={18} style={{ cursor: 'pointer', transition: 'color 0.2s' }} className="header-icon" onClick={handleNewChat} title="New Chat" />
                    <Trash2 size={15} style={{ cursor: 'pointer', transition: 'color 0.2s' }} className="header-icon" onClick={clearChat} title="Clear Current" />
                    {onClose && <X size={16} style={{ cursor: 'pointer', transition: 'color 0.2s' }} className="header-icon" onClick={onClose} title="Close Panel" />}
                </div>
            </div>

            {showHistory && (
                <div style={{
                    maxHeight: '40%',
                    overflowY: 'auto',
                    borderBottom: `1px solid ${theme.border}`,
                    background: 'rgba(0,0,0,0.2)'
                }}>
                    <div style={{ padding: '8px 12px', fontSize: '10px', color: '#666', fontWeight: 'bold', textTransform: 'uppercase' }}>Recent Chats</div>
                    {Object.values(sessions).sort((a, b) => b.timestamp - a.timestamp).map(sess => (
                        <div
                            key={sess.id}
                            onClick={() => loadSession(sess.id)}
                            style={{
                                padding: '10px 12px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: sess.id === currentSessionId ? 'rgba(79, 193, 255, 0.1)' : 'transparent',
                                color: sess.id === currentSessionId ? '#4fc1ff' : '#ccc',
                                borderLeft: sess.id === currentSessionId ? '2px solid #4fc1ff' : '2px solid transparent'
                            }}
                            className="session-item"
                        >
                            <MessageSquare size={13} style={{ opacity: 0.6 }} />
                            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sess.title}</span>
                            <div className="session-delete" onClick={(e) => deleteSession(e, sess.id)} style={{ padding: '4px' }}>
                                <Trash2 size={12} color="#f44336" />
                            </div>
                        </div>
                    ))}
                    {Object.keys(sessions).length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: '#666' }}>No saved sessions.</div>
                    )}
                </div>
            )}

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {messages.length === 0 && (
                    <div style={{ color: '#666', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>
                        Ask the AI assistant to explain code, fix bugs, or write something new.
                    </div>
                )}
                {messages.map((msg, idx) => {
                    if (msg.role === 'tool_call') {
                        const isExpanded = expandedTools[msg.id];
                        return (
                            <div key={idx} style={{
                                background: 'rgba(255, 255, 255, 0.03)',
                                borderRadius: '6px',
                                border: `1px solid ${theme.border}`,
                                overflow: 'hidden'
                            }}>
                                <div
                                    onClick={() => setExpandedTools(prev => ({ ...prev, [msg.id]: !isExpanded }))}
                                    style={{
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        background: isExpanded ? 'rgba(79, 193, 255, 0.05)' : 'transparent',
                                        fontSize: '12px'
                                    }}
                                >
                                    {isExpanded ? <ChevronDown size={14} color="#4fc1ff" /> : <ChevronRight size={14} color="#888" />}
                                    <Bot size={14} color="#4fc1ff" />
                                    <span style={{ fontWeight: 'bold' }}>{msg.name}</span>
                                    <span style={{ color: '#666', fontSize: '11px', marginLeft: 'auto' }}>
                                        {msg.result ? 'Completed' : 'Running...'}
                                    </span>
                                </div>

                                {isExpanded && (
                                    <div style={{ padding: '10px', borderTop: `1px solid ${theme.border}`, background: 'rgba(0,0,0,0.1)' }}>
                                        <div style={{ marginBottom: '8px' }}>
                                            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Arguments</div>
                                            <pre style={{ margin: 0, fontSize: '11px', padding: '6px' }}>
                                                {JSON.stringify(msg.args, null, 2)}
                                            </pre>
                                        </div>
                                        {msg.result && (
                                            <div>
                                                <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', marginBottom: '4px' }}>Result</div>
                                                <pre style={{
                                                    margin: 0,
                                                    fontSize: '11px',
                                                    padding: '6px',
                                                    maxHeight: '200px',
                                                    overflow: 'auto',
                                                    color: '#aaa'
                                                }}>
                                                    {msg.result}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    return (
                        <div key={idx} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                marginBottom: '4px',
                                color: '#888',
                                fontSize: '11px'
                            }}>
                                {msg.role === 'user' ? (
                                    <><span>You</span><User size={12} /></>
                                ) : (
                                    <><Bot size={12} /><span>Assistant</span></>
                                )}
                            </div>
                            <div style={{
                                background: msg.role === 'user' ? '#007fef' : 'rgba(255, 255, 255, 0.03)',
                                border: msg.role === 'user' ? 'none' : `1px solid ${theme.border}`,
                                color: '#fff',
                                padding: '12px 14px',
                                borderRadius: '12px',
                                borderTopLeftRadius: msg.role === 'assistant' ? '2px' : '12px',
                                borderTopRightRadius: msg.role === 'user' ? '2px' : '12px',
                                maxWidth: '95%',
                                fontSize: '13.5px',
                                lineHeight: '1.6',
                                userSelect: 'text',
                                boxShadow: msg.role === 'user' ? '0 4px 12px rgba(0,127,239,0.2)' : 'none'
                            }}>
                                <div className="markdown-body">
                                    {(() => {
                                        const parts = msg.content.split(/(<think>[\s\S]*?<\/think>)/g);
                                        return parts.map((part, pidx) => {
                                            if (part.startsWith('<think>')) {
                                                const content = part.replace('<think>', '').replace('</think>', '').trim();
                                                if (!content) return null;
                                                return <ThinkBlock key={pidx}>{content}</ThinkBlock>;
                                            }
                                            if (!part.trim()) return null;
                                            return (
                                                <ReactMarkdown
                                                    key={pidx}
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        code({ node, inline, className, children, ...props }) {
                                                            const match = /language-(\w+)/.exec(className || '')
                                                            return !inline && match ? (
                                                                <pre style={{ position: 'relative' }}>
                                                                    <code className={className} {...props}>{children}</code>
                                                                </pre>
                                                            ) : (
                                                                <code className={className} {...props}>{children}</code>
                                                            )
                                                        }
                                                    }}
                                                >
                                                    {part}
                                                </ReactMarkdown>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {pendingConfirm && (
                    <div style={{
                        padding: '12px',
                        background: 'rgba(255, 152, 0, 0.1)',
                        border: '1px solid #ff9800',
                        borderRadius: '8px',
                        animation: 'pulse 2s infinite'
                    }}>
                        <div style={{ color: '#ff9800', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <ShieldAlert size={16} /> Permission Required
                        </div>
                        <div style={{ fontSize: '12px', color: '#ddd', marginBottom: '12px' }}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{pendingConfirm.message}</ReactMarkdown>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => {
                                    pytron.confirm_tool(pendingConfirm.id, true);
                                    setPendingConfirm(null);
                                }}
                                style={{ flex: 1, padding: '6px', background: '#4caf50', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                                Allow
                            </button>
                            <button
                                onClick={() => {
                                    pytron.confirm_tool(pendingConfirm.id, false);
                                    setPendingConfirm(null);
                                }}
                                style={{ flex: 1, padding: '6px', background: '#f44336', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                            >
                                Deny
                            </button>
                        </div>
                    </div>
                )}
                {loading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#888' }}>
                        <Loader2 size={16} className="animate-spin" />
                        <span style={{ fontSize: '12px' }}>Assistant is thinking...</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: '16px', paddingTop: '8px' }}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '12px',
                    border: `1px solid ${theme.border}`,
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    padding: '8px'
                }} className="input-container">
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
                        style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            color: '#fff',
                            padding: '8px 12px',
                            fontSize: '13.5px',
                            resize: 'none',
                            outline: 'none',
                            minHeight: '40px',
                            maxHeight: '180px',
                            lineHeight: '1.6',
                            overflowY: 'auto'
                        }}
                    />

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '4px 8px',
                        marginTop: '4px'
                    }}>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button className="input-action-btn" title="Attach Files (Alt+A)">
                                <Plus size={16} />
                            </button>
                            <div className="model-chip active">
                                <ChevronUp size={12} style={{ opacity: 0.6 }} />
                                <span>{models.find(m => m.id === selectedModel)?.name || 'Gemini 3 Flash'}</span>
                                <select
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    style={{
                                        position: 'absolute',
                                        inset: 0,
                                        opacity: 0,
                                        cursor: 'pointer'
                                    }}
                                >
                                    {models.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button className="input-action-btn" title="Voice Input">
                                <Mic size={17} />
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={loading || !input.trim() || !isReady}
                                className={`send-btn ${loading || !input.trim() || !isReady ? 'disabled' : ''}`}
                            >
                                <Send size={16} />
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

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .markdown-body {
                    color: #fff;
                    font-family: inherit;
                }
                .markdown-body h1, .markdown-body h2, .markdown-body h3 {
                    margin-top: 16px;
                    margin-bottom: 8px;
                    color: #4fc1ff;
                    font-weight: 600;
                    line-height: 1.25;
                }
                .markdown-body h1 { font-size: 1.25em; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; }
                .markdown-body h2 { font-size: 1.15em; }
                .markdown-body h3 { font-size: 1.05em; }
                
                .markdown-body p { margin-bottom: 10px; }
                
                .markdown-body ul, .markdown-body ol {
                    padding-left: 1.5em;
                    margin-bottom: 10px;
                }
                .markdown-body li { margin-bottom: 4px; }
                .markdown-body li > p { margin: 0; }
                
                .markdown-body code {
                    font-family: 'JetBrains Mono', monospace;
                    background: rgba(255,255,255,0.1);
                    padding: 0.1em 0.3em;
                    border-radius: 3px;
                    font-size: 0.9em;
                }
                .markdown-body pre {
                    background: rgba(0,0,0,0.4);
                    padding: 12px;
                    border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.1);
                    margin: 12px 0;
                    overflow-x: auto;
                }
                .markdown-body pre code {
                    background: transparent;
                    padding: 0;
                    display: block;
                    line-height: 1.5;
                }
                .markdown-body strong { color: #fff; font-weight: 700; }
                .markdown-body blockquote {
                    border-left: 4px solid #4fc1ff;
                    padding-left: 12px;
                    color: #888;
                    font-style: italic;
                    margin: 10px 0;
                }
                .markdown-body hr {
                    border: 0;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    margin: 16px 0;
                }
                
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
            `}</style>
        </div>
    );
};

export default AIPanel;
