import React, { useState } from 'react';
import pytron from 'pytron-client';
import { Zap, Play, Terminal, Code, X, Check, Save } from 'lucide-react';
import { useToast, useTheme } from 'pytron-ui/react';
import './PanelStyles.css';

const AgentLab = ({ onClose }) => {
    const [script, setScript] = useState(`# AI Automation Script\n# This runs in our Python backend context!\n\nimport os\n\nprint("Listing project root:")\nfor f in os.listdir("."):\n    print(f"- {f}")\n`);
    const [result, setResult] = useState('');
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();
    const theme = useTheme();

    const handleRun = async () => {
        setLoading(true);
        setResult('');
        try {
            const res = await pytron.run_ai_script(script);
            if (res.success) {
                setResult(res.output);
                addToast('Automation Script Completed!', { type: 'success' });
            } else {
                setResult(res.error || 'Error executing script');
                addToast('Automation Script Failed', { type: 'error' });
            }
        } catch (e) {
            setResult('Bridge Error: ' + e);
        }
        setLoading(false);
    };

    return (
        <div style={{
            position: 'fixed',
            inset: '10%',
            zIndex: 1000,
            overflow: 'hidden'
        }} className="panel-container sleek-modal">
            <div className="panel-header">
                <div className="panel-header-title">
                    <Zap size={16} color="#f1c40f" fill="#f1c40f" />
                    <span>AUTOMATION LAB</span>
                </div>
                <button className="sleek-button" onClick={onClose}>
                    <X size={16} />
                </button>
            </div>

            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                {/* Editor Side */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-color)' }}>
                    <div style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                        PYTHON SCRIPT (BACKEND)
                    </div>
                    <textarea
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                        style={{
                            flex: 1,
                            background: 'var(--bg-primary)',
                            color: 'var(--text-primary)',
                            border: 'none',
                            padding: '16px',
                            fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
                            fontSize: '13px',
                            resize: 'none',
                            outline: 'none',
                            lineHeight: '1.6'
                        }}
                        placeholder="Enter Python code to execute on the backend..."
                    />
                </div>

                {/* Output Side */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#111' }}>
                    <div style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}>
                        CONSOLE OUTPUT
                        <Terminal size={12} />
                    </div>
                    <pre style={{
                        flex: 1,
                        margin: 0,
                        padding: '16px',
                        overflow: 'auto',
                        color: result.includes('Traceback') ? '#ff6b6b' : '#73c991',
                        fontSize: '12px',
                        fontFamily: "'Consolas', monospace"
                    }}>
                        {result || (loading ? 'Running...' : 'Ready.')}
                    </pre>
                </div>
            </div>

            <div style={{ padding: '12px 20px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                    onClick={handleRun}
                    disabled={loading}
                    className="sleek-button primary"
                    style={{
                        background: '#f1c40f',
                        color: '#000',
                        fontWeight: '600',
                        padding: '8px 24px'
                    }}
                >
                    <Play size={14} fill="#000" style={{ marginRight: '8px' }} />
                    Execute Automation
                </button>
            </div>
        </div>
    );
};

export default AgentLab;
