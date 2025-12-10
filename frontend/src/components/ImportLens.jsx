import React, { useState, useEffect } from 'react';
import { X, Package, Download, Check, AlertCircle, Box } from 'lucide-react';
import pytron from 'pytron-client';
import { useToast } from 'pytron-ui';

const ImportLens = ({ activePath, onClose }) => {
    const [imports, setImports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [installing, setInstalling] = useState(null);
    const { addToast } = useToast();

    const fetchImports = React.useCallback(async () => {
        if (!activePath || !activePath.endsWith('.py')) {
            setError("Please select a Python file.");
            setImports([]);
            return;
        }

        setLoading(true);
        try {
            const res = await pytron.analyze_imports(activePath);
            if (res.success) {
                setImports(res.imports);
                setError(null);
            } else {
                setError(res.error);
                setImports([]);
            }
        } catch (e) {
            setError(e.toString());
        } finally {
            setLoading(false);
        }
    }, [activePath]);

    useEffect(() => {
        fetchImports();
    }, [fetchImports]);

    const handleInstall = async (pkgName) => {
        setInstalling(pkgName);
        try {
            const res = await pytron.install_package(pkgName);
            if (res.success) {
                // Refresh list
                await fetchImports();
            } else {
                addToast("Failed to install: " + res.error, { type: 'error' });
            }
        } catch (e) {
            addToast("Error: " + e, { type: 'error' });
        } finally {
            setInstalling(null);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'installed': return '#4caf50';
            case 'missing': return '#ff6b6b';
            case 'stdlib': return '#4fc1ff';
            case 'stdlib/local': return '#9b59b6';
            default: return '#888';
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', borderLeft: '1px solid #333', fontFamily: 'sans-serif' }}>
            {/* Header */}
            <div style={{ padding: '10px 16px', background: '#252526', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 'bold' }}>
                    <Box size={18} color="#ff9800" />
                    <span>Import Lens</span>
                </div>
                <X size={18} color="#ccc" style={{ cursor: 'pointer' }} onClick={onClose} />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                {loading && <div style={{ color: '#ccc', textAlign: 'center', marginTop: '20px' }}>Scanning imports...</div>}

                {error && (
                    <div style={{ padding: '12px', background: 'rgba(255, 107, 107, 0.1)', border: '1px solid #ff6b6b', borderRadius: '4px', color: '#ff6b6b', fontSize: '13px' }}>
                        {error}
                    </div>
                )}

                {!loading && !error && imports.length === 0 && (
                    <div style={{ color: '#888', textAlign: 'center', marginTop: '20px' }}>
                        No imports found.
                    </div>
                )}

                {!loading && !error && imports.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {imports.map((imp, i) => (
                            <div key={i} style={{
                                background: '#2d2d2d',
                                borderRadius: '6px',
                                padding: '10px 12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderLeft: `3px solid ${getStatusColor(imp.status)}`
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ color: '#e0e0e0', fontWeight: '500', fontSize: '14px' }}>{imp.name}</span>
                                    <span style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>
                                        {imp.status === 'installed' && imp.version ? `v${imp.version}` : imp.status}
                                    </span>
                                </div>

                                {imp.status === 'missing' && (
                                    <button
                                        onClick={() => handleInstall(imp.name)}
                                        disabled={installing === imp.name}
                                        style={{
                                            background: '#2d2d2d',
                                            border: '1px solid #ff6b6b',
                                            color: '#ff6b6b',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            cursor: 'pointer',
                                            fontSize: '11px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px'
                                        }}
                                    >
                                        {installing === imp.name ? 'Installing...' : <><Download size={12} /> Install</>}
                                    </button>
                                )}

                                {imp.status === 'installed' && (
                                    <Check size={16} color="#4caf50" />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImportLens;
