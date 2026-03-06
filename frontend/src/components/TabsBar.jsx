import React from 'react';
import { Play, Globe, FlaskConical, Activity, Box, GitCompare } from 'lucide-react';
import FileIcon from './FileIcon';
import { useTheme } from 'pytron-ui/react';

const TabsBar = ({ files = [], activePath, onActivate, onClose, onRun }) => {
  const theme = useTheme();
  return (
    <div style={{
      height: '36px',
      display: 'flex',
      alignItems: 'center',
      background: theme.bg,
      borderBottom: `1px solid ${theme.border}`,
      overflow: 'hidden',
      justifyContent: 'space-between',
      userSelect: 'none'
    }}>
      <div className="tabs-container" style={{
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
        overflowY: 'hidden',
        flex: 1,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {files.map((f) => {
          const isActive = activePath === f.path;
          return (
            <div
              key={f.path}
              onClick={() => onActivate(f.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 12px',
                height: '100%',
                cursor: 'pointer',
                background: isActive ? theme.secondary : 'transparent',
                borderBottom: isActive ? `2px solid #4fc1ff` : '2px solid transparent',
                transition: 'all 0.2s ease',
                minWidth: '100px',
                position: 'relative',
                borderRight: `1px solid ${theme.border}`,
                borderTop: isActive ? `1px solid rgba(255,255,255,0.05)` : 'none'
              }}
              className="tab-item"
            >
              {f.type === 'diff' ? (
                <GitCompare size={13} style={{ marginRight: '8px', color: '#e2c08d' }} />
              ) : (
                <FileIcon name={f.name} size={13} style={{ marginRight: '8px', opacity: isActive ? 1 : 0.6 }} />
              )}
              <span style={{
                color: isActive ? '#fff' : '#888',
                fontSize: '12px',
                fontWeight: isActive ? '600' : '400',
                maxWidth: '120px',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden'
              }}>{f.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onClose(f.path); }}
                style={{
                  marginLeft: 'auto',
                  padding: '4px',
                  background: 'transparent',
                  border: 'none',
                  color: '#666',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '4px',
                  opacity: 0,
                  transition: 'opacity 0.2s'
                }}
                className="close-tab-btn"
              >✕</button>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '0 12px', display: 'flex', gap: '8px', borderLeft: `1px solid ${theme.border}`, height: '100%', alignItems: 'center', background: theme.bg }}>
        {activePath && (
          <button
            onClick={onRun}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#4caf50',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '6px',
              borderRadius: '4px',
              transition: 'background 0.2s'
            }}
            title="Run Code"
            className="tab-action-btn"
          >
            <Play size={16} fill="#4caf50" />
          </button>
        )}
      </div>
      <style>{`
        .tabs-container::-webkit-scrollbar { display: none; }
        .tab-item:hover .close-tab-btn { opacity: 1; }
        .close-tab-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .tab-action-btn:hover { background: rgba(76, 175, 80, 0.1); }
      `}</style>
    </div>
  );
};

export default TabsBar;
