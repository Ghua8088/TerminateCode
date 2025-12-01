import React, { useState, useEffect, useCallback } from 'react';
import pytron from 'pytron-client';
import { Folder, FileCode, Search, Files, Settings, RefreshCw, FilePlus, FolderPlus, Trash2, FolderOpen, Bot, GitBranch } from 'lucide-react';
import SearchPanel from './SearchPanel';
import AIPanel from './AIPanel';
import GitPanel from './GitPanel';

const NewItemInput = ({ type, onConfirm, onCancel }) => {
  const [value, setValue] = useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (value.trim()) onConfirm(value.trim());
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div style={{ padding: '4px 12px', display: 'flex', alignItems: 'center', background: '#333' }}>
      {type === 'folder' ? (
        <Folder size={14} style={{ marginRight: '6px', color: '#dcb67a' }} />
      ) : (
        <FileCode size={14} style={{ marginRight: '6px', color: '#4fc1ff' }} />
      )}
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={onCancel}
        placeholder={`Name...`}
        style={{
          background: 'transparent',
          border: '1px solid #007fd4',
          color: '#fff',
          fontSize: '13px',
          outline: 'none',
          width: '100%'
        }}
      />
    </div>
  );
};

const FileItem = ({ item, onSelect, onDelete, level = 0 }) => {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState([]);

  const fetchChildren = async () => {
    const res = await pytron.list_dir(item.path);
    if (res.success) setChildren(res.items);
  };

  const handleToggle = async (e) => {
    e.stopPropagation();
    if (item.is_dir) {
      if (expanded) {
        setExpanded(false);
      } else {
        setExpanded(true);
        fetchChildren();
      }
    } else {
      onSelect(item);
    }
  };

  const handleChildDelete = async (childItem) => {
    const success = await onDelete(childItem);
    if (success) {
      fetchChildren();
    }
    return success;
  };

  return (
    <>
      <div
        onClick={handleToggle}
        style={{
          paddingLeft: `${level * 12 + 12}px`,
          paddingRight: '12px',
          paddingTop: '4px',
          paddingBottom: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          fontSize: '13px',
          color: '#ccc',
          position: 'relative'
        }}
        className="file-item"
      >
        {item.is_dir ? (
          <Folder size={14} style={{ marginRight: '6px', color: '#dcb67a' }} />
        ) : (
          <FileCode size={14} style={{ marginRight: '6px', color: '#4fc1ff' }} />
        )}
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          {item.name}
        </span>
        <div className="file-actions" style={{ display: 'none', marginLeft: 'auto' }}>
          <Trash2
            size={12}
            color="#ff6b6b"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
          />
        </div>
      </div>
      {expanded && children.map(child => (
        <FileItem
          key={child.path}
          item={child}
          onSelect={onSelect}
          onDelete={handleChildDelete}
          level={level + 1}
        />
      ))}
    </>
  );
};

const Explorer = ({ onFileOpen }) => {
  const [items, setItems] = useState([]);
  const [currentPath, setCurrentPath] = useState('.');
  const [creatingType, setCreatingType] = useState(null); // 'file' or 'folder'

  const loadDir = useCallback(async (path) => {
    try {
      const res = await pytron.list_dir(path);
      if (res.success) {
        setItems(res.items);
        setCurrentPath(res.current_path);
      } else {
        console.error(res.error);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDir('.');
  }, [loadDir]);

  const handleItemClick = (item) => {
    if (!item.is_dir) {
      console.log('[Sidebar] onFileOpen', item.path);
      onFileOpen(item);
    }
  };

  const handleBack = () => {
    // No-op or remove if we don't want to navigate up from root
  };

  const handleCreateConfirm = async (name) => {
    const path = currentPath === '.' ? name : `${currentPath}/${name}`;
    try {
      const res = await pytron.create_item(path, creatingType === 'folder');
      if (res.success) {
        loadDir(currentPath);
      } else {
        console.error(`Error: ${res.error}`);
      }
    } catch (e) {
      console.error(`Error: ${e}`);
    }
    setCreatingType(null);
  };

  const handleOpenFolder = async () => {
    try {
      const res = await pytron.select_directory();
      if (res.success) {
        loadDir(res.path);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (item) => {
    if (!confirm(`Are you sure you want to delete ${item.name}?`)) return false;
    
    try {
      const res = await pytron.delete_item(item.path);
      if (!res.success) {
        alert(`Error: ${res.error}`);
      }
      return res.success;
    } catch (e) {
      alert(`Error: ${e}`);
      return false;
    }
  };

  const handleRootDelete = async (item) => {
    const success = await handleDelete(item);
    if (success) loadDir(currentPath);
    return success;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '10px',
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#bbb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#1e1e1e'
      }}>
        <span>EXPLORER</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <FilePlus size={14} style={{ cursor: 'pointer' }} onClick={() => setCreatingType('file')} title="New File" />
          <FolderPlus size={14} style={{ cursor: 'pointer' }} onClick={() => setCreatingType('folder')} title="New Folder" />
          <FolderOpen size={14} style={{ cursor: 'pointer' }} onClick={handleOpenFolder} title="Open Folder" />
          <RefreshCw size={12} style={{ cursor: 'pointer' }} onClick={() => loadDir(currentPath)} title="Refresh" />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {creatingType && (
          <NewItemInput
            type={creatingType}
            onConfirm={handleCreateConfirm}
            onCancel={() => setCreatingType(null)}
          />
        )}
        {items.map((item, idx) => (
          <FileItem key={idx} item={item} onSelect={handleItemClick} onDelete={handleRootDelete} />
        ))}
      </div>
      <style>{`
        .file-item:hover { background-color: #2a2d2e; }
        .file-item:hover .file-actions { display: block !important; }
      `}</style>
    </div>
  );
};

const Sidebar = ({ onFileOpen, onOpenSettings, activePath, width = '250px' }) => {
  const [activeView, setActiveView] = useState('explorer');

  return (
    <div style={{ display: 'flex', height: '100%', borderRight: '1px solid #333' }}>
      {/* Activity Bar */}
      <div style={{ width: '48px', background: '#333333', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '10px' }}>
        <div
          onClick={() => setActiveView('explorer')}
          style={{ padding: '10px', cursor: 'pointer', color: activeView === 'explorer' ? '#fff' : '#888', borderLeft: activeView === 'explorer' ? '2px solid #fff' : '2px solid transparent' }}
          title="Explorer"
        >
          <Files size={24} />
        </div>
        <div
          onClick={() => setActiveView('search')}
          style={{ padding: '10px', cursor: 'pointer', color: activeView === 'search' ? '#fff' : '#888', borderLeft: activeView === 'search' ? '2px solid #fff' : '2px solid transparent' }}
          title="Search"
        >
          <Search size={24} />
        </div>
        <div
          onClick={() => setActiveView('ai')}
          style={{ padding: '10px', cursor: 'pointer', color: activeView === 'ai' ? '#fff' : '#888', borderLeft: activeView === 'ai' ? '2px solid #fff' : '2px solid transparent' }}
          title="Pytron AI"
        >
          <Bot size={24} />
        </div>
        <div
          onClick={() => setActiveView('git')}
          style={{ padding: '10px', cursor: 'pointer', color: activeView === 'git' ? '#fff' : '#888', borderLeft: activeView === 'git' ? '2px solid #fff' : '2px solid transparent' }}
          title="Source Control"
        >
          <GitBranch size={24} />
        </div>
        {/* Placeholder for Settings or other icons */}
        <div
          style={{ marginTop: 'auto', padding: '10px', cursor: 'pointer', color: '#888' }}
          onClick={onOpenSettings}
          title="Settings"
        >
          <Settings size={24} />
        </div>
      </div>

      {/* Side Panel Content */}
      <div style={{ width: width, minWidth: '150px', background: '#252526', display: 'flex', flexDirection: 'column' }}>
        {activeView === 'explorer' && <Explorer onFileOpen={onFileOpen} />}
        {activeView === 'search' && <SearchPanel onFileOpen={onFileOpen} />}
        {activeView === 'ai' && <AIPanel activePath={activePath} />}
        {activeView === 'git' && <GitPanel />}
      </div>

      <style>{`
        .file-item:hover { background-color: #2a2d2e; }
      `}</style>
    </div>
  );
};

export default Sidebar;
