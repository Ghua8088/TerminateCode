import React, { useState, useEffect, useCallback } from 'react';
import pytron from 'pytron-client';
import { Search, FileCode, ChevronRight, ChevronDown, Replace, ReplaceAll, X } from 'lucide-react';
import { useToast, useTheme } from 'pytron-ui/react';

const SearchPanel = ({ onFileOpen, searchState, setSearchState }) => {
    const { query, replaceQuery, showReplace, results, expandedFiles } = searchState;
    const [loading, setLoading] = useState(false);
    const theme = useTheme();
    const { addToast } = useToast();

    const groupResults = (results) => {
        const groups = {};
        results.forEach(res => {
            if (!groups[res.path]) {
                groups[res.path] = { file: res.file, path: res.path, matches: [] };
            }
            groups[res.path].matches.push(res);
        });
        return Object.values(groups);
    };

    const handleSearch = useCallback(async (searchQuery = query) => {
        if (!searchQuery.trim()) {
            setSearchState(prev => ({ ...prev, results: [] }));
            return;
        }

        setLoading(true);
        try {
            const res = await pytron.search_in_files(searchQuery);
            if (res.success) {
                const grouped = groupResults(res.results);
                const newExpanded = {};
                res.results.forEach(r => newExpanded[r.path] = true);
                setSearchState(prev => ({ ...prev, results: grouped, expandedFiles: newExpanded }));
            } else {
                addToast("Search failed: " + res.error, { type: 'error' });
            }
        } catch (err) {
            console.error(err);
            addToast("Search failed: connection error", { type: 'error' });
        }
        setLoading(false);
    }, [query, setSearchState, addToast]);

    // Instant search with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            handleSearch();
        }, 500);
        return () => clearTimeout(timer);
    }, [query, handleSearch]);

    const handleReplaceAll = async () => {
        if (!query || results.length === 0) return;

        try {
            const filesToModify = results.map(r => r.path);
            const res = await pytron.replace_in_files(query, replaceQuery, filesToModify);
            if (res.success) {
                addToast(`Replaced ${res.matches_replaced} matches in ${res.files_modified} files.`, { type: 'success' });
                handleSearch(); // Refresh search
            }
        } catch (e) { addToast("Replace failed: " + e, { type: 'error' }); }
    };

    const toggleFile = (path) => {
        setSearchState(prev => ({
            ...prev,
            expandedFiles: { ...prev.expandedFiles, [path]: !prev.expandedFiles[path] }
        }));
    };

    const updateSearchState = (updates) => {
        setSearchState(prev => ({ ...prev, ...updates }));
    };

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                        onClick={() => updateSearchState({ showReplace: !showReplace })}
                        style={{ cursor: 'pointer', display: 'flex', transform: showReplace ? 'rotate(90deg)' : 'none', transition: '0.2s' }}
                    >
                        <ChevronRight size={14} color="#888" />
                    </div>
                    <span>SEARCH</span>
                </div>
            </div>

            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#3c3c3c', borderRadius: '3px', padding: '4px' }}>
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => updateSearchState({ query: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            placeholder="Search"
                            style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '13px' }}
                        />
                        <Search size={14} style={{ cursor: 'pointer', color: '#ccc' }} onClick={() => handleSearch()} />
                    </div>

                    {showReplace && (
                        <div style={{ display: 'flex', alignItems: 'center', background: '#3c3c3c', borderRadius: '3px', padding: '4px', marginTop: '4px' }}>
                            <input
                                type="text"
                                value={replaceQuery}
                                onChange={(e) => updateSearchState({ replaceQuery: e.target.value })}
                                placeholder="Replace"
                                style={{ background: 'transparent', border: 'none', color: '#fff', width: '100%', outline: 'none', fontSize: '13px' }}
                            />
                            <ReplaceAll
                                size={14}
                                style={{ cursor: 'pointer', color: results.length > 0 ? '#4fc1ff' : '#666' }}
                                onClick={handleReplaceAll}
                                title="Replace All"
                            />
                        </div>
                    )}
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading && <div style={{ padding: '10px', color: '#888', fontSize: '12px' }}>Searching...</div>}
                {!loading && results.length === 0 && query && (
                    <div style={{ padding: '40px 20px', textAlign: 'center', color: '#666', fontSize: '12px' }}>No results found.</div>
                )}
                {results.map((group, idx) => (
                    <div key={idx}>
                        <div
                            onClick={() => toggleFile(group.path)}
                            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid #252526' }}
                        >
                            {expandedFiles[group.path] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <FileCode size={13} style={{ margin: '0 6px', color: '#4fc1ff' }} />
                            <span style={{ fontSize: '13px', color: '#ccc', fontWeight: 'bold' }}>{group.file}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#666', background: '#333', padding: '1px 6px', borderRadius: '10px' }}>{group.matches.length}</span>
                        </div>

                        {expandedFiles[group.path] && group.matches.map((m, midx) => (
                            <div
                                key={midx}
                                onClick={() => onFileOpen({ path: m.path, name: m.file })}
                                style={{
                                    padding: '6px 32px',
                                    cursor: 'pointer',
                                    fontSize: '12px',
                                    color: '#888',
                                    fontFamily: 'monospace',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}
                                className="search-result-match"
                            >
                                <span style={{ color: '#444', marginRight: '8px' }}>{m.line}:</span>
                                {m.content}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
            <style>{`
                .search-result-match:hover { background-color: #2a2d2e; color: #fff !important; }
            `}</style>
        </div>
    );
};

export default SearchPanel;
