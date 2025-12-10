import React, { useState, useEffect } from 'react';
import { X, Binary, RefreshCw } from 'lucide-react';
import pytron from 'pytron-client';

const BytecodeViewer = ({ activePath, onClose }) => {
    const [bytecode, setBytecode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchBytecode = React.useCallback(async () => {
        if (!activePath || !activePath.endsWith('.py')) {
            setError("Please select a Python file.");
            setBytecode('');
            return;
        }

        setLoading(true);
        try {
            const res = await pytron.get_bytecode(activePath);
            if (res.success) {
                setBytecode(res.bytecode);
                setError(null);
            } else {
                setError(res.error);
                setBytecode('');
            }
        } catch (e) {
            setError(e.toString());
        } finally {
            setLoading(false);
        }
    }, [activePath]);

    useEffect(() => {
        fetchBytecode();
    }, [fetchBytecode]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', borderLeft: '1px solid #333', fontFamily: 'monospace' }}>
            {/* Header */}
            <div style={{ padding: '10px 16px', background: '#252526', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                    <Binary size={18} color="#9b59b6" />
                    <span>Bytecode Viewer</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <RefreshCw size={16} color="#ccc" style={{ cursor: 'pointer' }} onClick={fetchBytecode} title="Refresh" />
                    <X size={18} color="#ccc" style={{ cursor: 'pointer' }} onClick={onClose} />
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: '#1e1e1e' }}>
                {loading && <div style={{ color: '#ccc', textAlign: 'center', marginTop: '20px', fontFamily: 'sans-serif' }}>Disassembling...</div>}

                {error && (
                    <div style={{ padding: '12px', background: 'rgba(255, 107, 107, 0.1)', border: '1px solid #ff6b6b', borderRadius: '4px', color: '#ff6b6b', fontSize: '13px', fontFamily: 'sans-serif' }}>
                        {error}
                    </div>
                )}

                {!loading && !error && bytecode && (
                    <pre style={{
                        margin: 0,
                        color: '#d4d4d4',
                        fontSize: '12px',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap'
                    }}>
                        {bytecode}
                    </pre>
                )}
            </div>
        </div>
    );
};

export default BytecodeViewer;
