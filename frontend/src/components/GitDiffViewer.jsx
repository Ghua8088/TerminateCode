import React, { useEffect, useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import pytron from 'pytron-client';
import { useTheme } from 'pytron-ui/react';
import { X, RefreshCw } from 'lucide-react';

const GitDiffViewer = ({ path, settings = {} }) => {
    const [original, setOriginal] = useState('');
    const [modified, setModified] = useState('');
    const [loading, setLoading] = useState(true);
    const theme = useTheme();
    const { fontSize = 14, theme: editorTheme = 'vs-dark' } = settings;

    const loadDiff = async () => {
        setLoading(true);
        try {
            const res = await pytron.get_file_diff(path);
            if (res.success) {
                setOriginal(res.original);
                setModified(res.modified);
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadDiff();
    }, [path]);

    if (loading) {
        return <div style={{ padding: 20, color: theme.fg }}>Loading diff...</div>;
    }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
            <div style={{
                height: '35px',
                background: '#1a1a1a',
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                fontSize: '12px',
                borderBottom: '1px solid #282828',
                justifyContent: 'space-between'
            }}>
                <div style={{ color: '#aaa' }}>Diff: <span style={{ color: '#fff' }}>{path}</span></div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <RefreshCw size={14} style={{ cursor: 'pointer', color: '#888' }} onClick={loadDiff} />
                </div>
            </div>
            <div style={{ flex: 1 }}>
                <DiffEditor
                    height="100%"
                    original={original}
                    modified={modified}
                    language={path.split('.').pop() === 'js' ? 'javascript' : path.split('.').pop() === 'py' ? 'python' : 'plaintext'}
                    theme={editorTheme}
                    options={{
                        fontSize: fontSize,
                        renderSideBySide: true,
                        readOnly: true,
                        originalEditable: false,
                        automaticLayout: true
                    }}
                />
            </div>
        </div>
    );
};

export default GitDiffViewer;
