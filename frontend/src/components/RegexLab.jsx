import React, { useState, useEffect } from 'react';
import { X, Copy, Check, AlertCircle, FlaskConical } from 'lucide-react';
import pytron from 'pytron-client';

const RegexLab = ({ onClose }) => {
    const [pattern, setPattern] = useState(String.raw`\b\w+\b`);
    const [text, setText] = useState('Python is amazing and Pytron makes it even better!');
    const [matches, setMatches] = useState([]);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const test = async () => {
            if (!pattern) {
                setMatches([]);
                setError(null);
                return;
            }
            setLoading(true);
            try {
                // Use raw string for pattern to avoid escaping issues in JS before sending
                const res = await pytron.test_regex(pattern, text);
                if (res.success) {
                    setMatches(res.matches);
                    setError(null);
                } else {
                    setError(res.error);
                    setMatches([]);
                }
            } catch (e) {
                setError(e.toString());
            } finally {
                setLoading(false);
            }
        };

        const timeout = setTimeout(test, 300); // Debounce
        return () => clearTimeout(timeout);
    }, [pattern, text]);

    // Highlight matches in the text
    const renderHighlightedText = () => {
        if (!matches.length) return <span style={{ color: '#ccc' }}>{text}</span>;

        let lastIndex = 0;
        const elements = [];

        matches.forEach((m, i) => {
            // Text before match
            if (m.start > lastIndex) {
                elements.push(
                    <span key={`text-${i}`} style={{ color: '#ccc' }}>
                        {text.substring(lastIndex, m.start)}
                    </span>
                );
            }
            // Match
            elements.push(
                <span key={`match-${i}`} style={{ background: 'rgba(76, 175, 80, 0.3)', color: '#fff', borderRadius: '2px', borderBottom: '1px solid #4caf50' }} title={`Match ${i + 1}`}>
                    {text.substring(m.start, m.end)}
                </span>
            );
            lastIndex = m.end;
        });

        // Remaining text
        if (lastIndex < text.length) {
            elements.push(
                <span key="text-end" style={{ color: '#ccc' }}>
                    {text.substring(lastIndex)}
                </span>
            );
        }

        return elements;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#1e1e1e', borderLeft: '1px solid #333', fontFamily: 'monospace' }}>
            {/* Header */}
            <div style={{ padding: '10px 16px', background: '#252526', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontWeight: 'bold' }}>
                    <FlaskConical size={18} color="#4caf50" />
                    <span>Python Regex Lab</span>
                </div>
                <X size={18} color="#ccc" style={{ cursor: 'pointer' }} onClick={onClose} />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', overflowY: 'auto' }}>

                {/* Pattern Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ color: '#888', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Python Regex Pattern</label>
                    <div style={{ position: 'relative' }}>
                        <input
                            value={pattern}
                            onChange={(e) => setPattern(e.target.value)}
                            style={{
                                width: '100%',
                                background: '#2d2d2d',
                                border: error ? '1px solid #ff6b6b' : '1px solid #444',
                                color: '#d4d4d4',
                                padding: '10px',
                                borderRadius: '4px',
                                fontSize: '14px',
                                outline: 'none',
                                fontFamily: 'monospace'
                            }}
                            placeholder="e.g. \b\w+\b"
                        />
                        {error && (
                            <div style={{ position: 'absolute', right: '10px', top: '10px', color: '#ff6b6b' }} title={error}>
                                <AlertCircle size={16} />
                            </div>
                        )}
                    </div>
                    {error && <div style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '-4px' }}>{error}</div>}
                </div>

                {/* Test Text Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <label style={{ color: '#888', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>Test String</label>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        style={{
                            flex: 1,
                            background: '#2d2d2d',
                            border: '1px solid #444',
                            color: '#d4d4d4',
                            padding: '10px',
                            borderRadius: '4px',
                            fontSize: '14px',
                            outline: 'none',
                            fontFamily: 'monospace',
                            resize: 'none',
                            minHeight: '100px'
                        }}
                    />
                </div>

                {/* Results */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ color: '#888', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Matches ({matches.length})
                        </label>
                        {loading && <span style={{ color: '#4caf50', fontSize: '12px' }}>Processing...</span>}
                    </div>

                    <div style={{
                        flex: 1,
                        background: '#1e1e1e',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        padding: '10px',
                        overflowY: 'auto',
                        fontSize: '14px',
                        lineHeight: '1.5'
                    }}>
                        {renderHighlightedText()}
                    </div>
                </div>

                {/* Match Details Table */}
                {matches.length > 0 && (
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #333', borderRadius: '4px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead style={{ background: '#252526', color: '#ccc', textAlign: 'left' }}>
                                <tr>
                                    <th style={{ padding: '6px 10px' }}>#</th>
                                    <th style={{ padding: '6px 10px' }}>Match</th>
                                    <th style={{ padding: '6px 10px' }}>Groups</th>
                                    <th style={{ padding: '6px 10px' }}>Range</th>
                                </tr>
                            </thead>
                            <tbody>
                                {matches.map((m, i) => (
                                    <tr key={i} style={{ borderTop: '1px solid #333', color: '#aaa' }}>
                                        <td style={{ padding: '6px 10px' }}>{i + 1}</td>
                                        <td style={{ padding: '6px 10px', color: '#4caf50' }}>"{m.match}"</td>
                                        <td style={{ padding: '6px 10px' }}>{m.groups.length > 0 ? `(${m.groups.join(', ')})` : '-'}</td>
                                        <td style={{ padding: '6px 10px' }}>{m.start}-{m.end}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RegexLab;
