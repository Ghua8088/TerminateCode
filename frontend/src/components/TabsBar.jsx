import React from 'react';
import { Play } from 'lucide-react';

const TabsBar = ({ files = [], activePath, onActivate, onClose, onRun }) => {
  return (
    <div style={{ height: '36px', display: 'flex', alignItems: 'center', background: '#1b1b1b', borderBottom: '1px solid #333', overflowX: 'auto', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', flex: 1 }}>
        {files.map((f) => (
          <div key={f.path} onClick={() => onActivate(f.path)} style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', margin: '4px', borderRadius: '4px', cursor: 'pointer', background: activePath === f.path ? '#2a2d2e' : 'transparent' }}>
            <span style={{ color: '#ddd', fontSize: '13px', maxWidth: '220px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
            <button onClick={(e) => { e.stopPropagation(); onClose(f.path); }} style={{ marginLeft: '8px', background: 'transparent', border: 'none', color: '#999', cursor: 'pointer' }}>✕</button>
          </div>
        ))}
      </div>
      {activePath && (
        <div style={{ padding: '0 10px' }}>
          <button
            onClick={onRun}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#4caf50',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Run File"
          >
            <Play size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default TabsBar;
