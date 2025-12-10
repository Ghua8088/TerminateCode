import React from 'react';
import { Play, Globe, FlaskConical, Activity, Box } from 'lucide-react';
import FileIcon from './FileIcon';
import { useTheme } from 'pytron-ui';

const TabsBar = ({ files = [], activePath, onActivate, onClose, onRun }) => {
  const theme = useTheme();
  return (
    <div style={{ height: '36px', display: 'flex', alignItems: 'center', background: theme.secondary, borderBottom: `1px solid ${theme.border}`, overflowX: 'auto', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', flex: 1 }}>
        {files.map((f) => (
          <div key={f.path} onClick={() => onActivate(f.path)} style={{ display: 'flex', alignItems: 'center', padding: '6px 10px', margin: '4px', borderRadius: '4px', cursor: 'pointer', background: activePath === f.path ? theme.surface : 'transparent' }}>
            <FileIcon name={f.name} size={13} style={{ marginRight: '6px' }} />
            <span style={{ color: theme.fg, fontSize: '13px', maxWidth: '220px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
            <button onClick={(e) => { e.stopPropagation(); onClose(f.path); }} style={{ marginLeft: '8px', background: 'transparent', border: 'none', color: theme.border, cursor: 'pointer' }}>✕</button>
          </div>
        ))}
      </div>
      <div style={{ padding: '0 10px', display: 'flex', gap: '8px' }}>
        {activePath && (
          <button
            onClick={onRun}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.success,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Run File"
          >
            <Play size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default TabsBar;
