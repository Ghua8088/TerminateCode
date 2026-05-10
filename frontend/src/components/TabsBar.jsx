import React, { useState, useEffect, useRef } from 'react';
import { Play, Globe, FlaskConical, Activity, Box, GitCompare, X, MoreHorizontal } from 'lucide-react';
import FileIcon from './FileIcon';
import { useTheme } from 'pytron-ui/react';
import './PanelStyles.css';

const TabsBar = ({ files = [], activePath, onActivate, onClose, onRun, onCloseOthers, onCloseAll, onCloseRight, onReorderFiles }) => {
  const [dragIndex, setDragIndex] = useState(null);
  const [localFiles, setLocalFiles] = useState(files);
  const localFilesRef = useRef(files);
  const theme = useTheme();

  useEffect(() => {
    if (dragIndex === null) {
      setLocalFiles(files);
      localFilesRef.current = files;
    }
  }, [files, dragIndex]);

  const handleContextMenu = (e, path) => {
    // Let it bubble to window to trigger pytron-ui ContextMenu
    window.dispatchEvent(new CustomEvent('contextmenu:set', {
      detail: {
        items: [
          { label: 'Close', shortcut: 'Ctrl+F4', onClick: () => onClose(path) },
          { label: 'Close Others', shortcut: 'Alt+Ctrl+T', onClick: () => onCloseOthers(path) },
          { label: 'Close Right', onClick: () => onCloseRight(path) },
          { type: 'divider' },
          { label: 'Close All', onClick: onCloseAll }
        ]
      }
    }));
  };

  const handleMouseDown = (idx) => {
    setDragIndex(idx);
    
    const handleGlobalMouseUp = () => {
      setDragIndex(null);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      onReorderFiles(localFilesRef.current);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
  };

  const handleMouseEnter = (idx) => {
    if (dragIndex !== null && dragIndex !== idx) {
      const newFiles = [...localFilesRef.current];
      const item = newFiles.splice(dragIndex, 1)[0];
      newFiles.splice(idx, 0, item);
      setLocalFiles(newFiles);
      localFilesRef.current = newFiles;
      setDragIndex(idx);
    }
  };

  return (
    <div className="sleek-tabs" style={{ userSelect: 'none' }}>
      <div className="tabs-container" style={{
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
        overflowY: 'hidden',
        flex: 1,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}>
        {localFiles.map((f, idx) => {
          const isActive = activePath === f.path;
          const isDragging = dragIndex === idx;
          return (
            <div
              key={f.path}
              onMouseDown={() => handleMouseDown(idx)}
              onMouseEnter={() => handleMouseEnter(idx)}
              onClick={() => onActivate(f.path)}
              className={`sleek-tab ${isActive ? 'active' : ''}`}
              onContextMenu={(e) => handleContextMenu(e, f.path)}
              style={{
                cursor: 'grab',
                position: 'relative',
                transition: 'all 0.15s ease',
                zIndex: isDragging ? 100 : 1,
                transform: isDragging ? 'translateY(-2px) scale(1.02)' : 'none',
                boxShadow: isDragging ? '0 4px 12px rgba(59, 130, 246, 0.4)' : 'none',
                borderColor: isDragging ? '#3b82f6' : '',
                background: isDragging ? 'rgba(59, 130, 246, 0.1)' : '',
                opacity: isDragging ? 0.9 : 1
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', pointerEvents: 'none', width: '100%', height: '100%' }}>
                {f.type === 'diff' ? (
                  <div style={{ width: '14px', height: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <GitCompare size={13} style={{ color: '#e2c08d' }} />
                  </div>
                ) : (
                  <FileIcon name={f.name} size={14} />
                )}
                <span style={{
                  maxWidth: '120px',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden'
                }}>{f.name}</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onClose(f.path); }}
                className="sleek-tab-close sleek-button"
                style={{ background: 'transparent', padding: '2px', marginLeft: 'auto', position: 'relative', zIndex: 10, pointerEvents: 'auto' }}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '0 8px', display: 'flex', gap: '4px', alignItems: 'center' }}>
        {activePath && (
          <button
            onClick={onRun}
            className="sleek-button"
            style={{ color: '#4caf50' }}
            title="Run Code"
          >
            <Play size={14} fill="#4caf50" />
          </button>
        )}
      </div>
      <style>{`
        .tabs-container::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default TabsBar;
