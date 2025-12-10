import React, { useState, useEffect } from 'react';
import { X, Activity, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import pytron from 'pytron-client';

const CodeMetrics = ({ activePath, onClose }) => {
    const [metrics, setMetrics] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchMetrics = async () => {
            if (!activePath || !activePath.endsWith('.py')) {
                setError("Please select a Python file.");
                setMetrics([]);
                return;
            }

            setLoading(true);
            try {
                const res = await pytron.get_code_metrics(activePath);
                if (res.success) {
                    setMetrics(res.metrics);
                    setError(null);
                } else {
                    setError(res.error);
                    setMetrics([]);
                }
            } catch (e) {
                setError(e.toString());
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, [activePath]);

    const getComplexityColor = (score) => {
        if (score <= 5) return '#4caf50'; // Green
        if (score <= 10) return '#ff9800'; // Orange
        return '#ff6b6b'; // Red
    };

    const getComplexityLabel = (score) => {
        if (score <= 5) return 'Simple';
        if (score <= 10) return 'Moderate';
        return 'Complex';
    };

    const getIcon = (score) => {
        if (score <= 5) return <CheckCircle size={14} color="#4caf50" />;
        if (score <= 10) return <AlertTriangle size={14} color="#ff9800" />;
        return <AlertCircle size={14} color="#ff6b6b" />;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', borderLeft: '1px solid #333', fontFamily: 'sans-serif' }}>
            {/* Header */}
            <div style={{ padding: '10px 16px', background: '#252526', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 'bold' }}>
                    <Activity size={18} color="#4fc1ff" />
                    <span>Code X-Ray</span>
                </div>
                <X size={18} color="#ccc" style={{ cursor: 'pointer' }} onClick={onClose} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                {loading && <div style={{ color: '#ccc', textAlign: 'center', marginTop: '20px' }}>Analyzing code structure...</div>}

                {error && (
                    <div style={{ padding: '12px', background: 'rgba(255, 107, 107, 0.1)', border: '1px solid #ff6b6b', borderRadius: '4px', color: '#ff6b6b', fontSize: '13px' }}>
                        {error}
                    </div>
                )}

                {!loading && !error && metrics.length === 0 && (
                    <div style={{ color: '#888', textAlign: 'center', marginTop: '20px' }}>
                        No functions found in this file.
                    </div>
                )}

                {!loading && !error && metrics.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                            Function Complexity (Cyclomatic)
                        </div>
                        {metrics.map((m, i) => (
                            <div key={i} style={{
                                background: '#2d2d2d',
                                borderRadius: '6px',
                                padding: '12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderLeft: `4px solid ${getComplexityColor(m.complexity)}`
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ color: '#e0e0e0', fontWeight: '500', fontSize: '14px' }}>{m.name}</span>
                                    <span style={{ color: '#888', fontSize: '12px' }}>Line {m.line}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ color: getComplexityColor(m.complexity), fontWeight: 'bold', fontSize: '16px' }}>{m.complexity}</div>
                                        <div style={{ color: getComplexityColor(m.complexity), fontSize: '10px' }}>{getComplexityLabel(m.complexity)}</div>
                                    </div>
                                    {getIcon(m.complexity)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CodeMetrics;
