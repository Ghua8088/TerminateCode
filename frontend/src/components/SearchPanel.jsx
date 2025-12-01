import React, { useState } from 'react';
import pytron from 'pytron-client';
import { Search, FileCode } from 'lucide-react';

const SearchPanel = ({ onFileOpen }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        try {
            const res = await pytron.search_in_files(query);
            if (res.success) {
                setResults(res.results);
            } else {
                console.error(res.error);
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: '10px', borderBottom: '1px solid #333' }}>
                <form onSubmit={handleSearch}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#3c3c3c', borderRadius: '3px', padding: '4px' }}>
                        <Search size={14} style={{ marginRight: '6px', color: '#ccc' }} />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                width: '100%',
                                outline: 'none',
                                fontSize: '13px'
                            }}
                        />
                    </div>
                </form>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {loading && <div style={{ padding: '10px', color: '#888', fontSize: '12px' }}>Searching...</div>}
                {!loading && results.length === 0 && query && (
                    <div style={{ padding: '10px', color: '#888', fontSize: '12px' }}>No results found.</div>
                )}
                {results.map((res, idx) => (
                    <div
                        key={idx}
                        onClick={() => onFileOpen({ path: res.path, name: res.file })}
                        style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #2a2a2a',
                            fontSize: '12px'
                        }}
                        className="search-result-item"
                    >
                        <div style={{ display: 'flex', alignItems: 'center', color: '#ccc', marginBottom: '2px' }}>
                            <FileCode size={12} style={{ marginRight: '6px', color: '#4fc1ff' }} />
                            <span style={{ fontWeight: 'bold' }}>{res.file}</span>
                            <span style={{ marginLeft: 'auto', color: '#666' }}>:{res.line}</span>
                        </div>
                        <div style={{ color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'monospace' }}>
                            {res.content}
                        </div>
                    </div>
                ))}
            </div>
            <style>{`
        .search-result-item:hover { background-color: #2a2d2e; }
      `}</style>
        </div>
    );
};

export default SearchPanel;
