import React, { useEffect, useState } from 'react';
import pytron from 'pytron-client';

const CommandPalette = ({ onOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await pytron.list_dir('.');
        if (res.success) {
          // flatten top-level for quick open demo
          const fileList = res.items.filter(i => !i.is_dir).map(i => ({ name: i.name, path: i.path }));
          setFiles(fileList);
        }
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, []);

  const filtered = files.filter(f => {
    const q = query.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q);
  });

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={{ position: 'absolute', left: '50%', top: '18%', transform: 'translateX(-50%)', width: '60%', background: '#1b1b1b', border: '1px solid #333', borderRadius: '6px', boxShadow: '0 6px 24px rgba(0,0,0,0.6)', zIndex: 60 }}>
      <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Quick Open (Ctrl+P)" style={{ width: '100%', padding: '12px', boxSizing: 'border-box', border: 'none', outline: 'none', background: 'transparent', color: '#eee', fontSize: '14px' }} />
      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {filtered.map((f) => (
          <div key={f.path} onClick={() => onOpen(f)} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #222', color: '#ddd' }}>
            <div style={{ fontSize: '13px' }}>{f.name}</div>
            <div style={{ fontSize: '11px', color: '#888' }}>{f.path}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommandPalette;
