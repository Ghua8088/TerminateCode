import React, { useState, useEffect, useCallback } from 'react';
import pytron from 'pytron-client';
import { Folder, FileCode, Search, Files, Settings, RefreshCw, FilePlus, FolderPlus, Trash2, FolderOpen, Bot, GitBranch, Edit2, Zap } from 'lucide-react';
import SearchPanel from './SearchPanel';
import AIPanel from './AIPanel';
import GitPanel from './GitPanel';
import ToolsPanel from './ToolsPanel';
import FileIcon from './FileIcon';
import { useToast } from 'pytron-ui';
import { useTheme } from 'pytron-ui';
import ResizeHandle from './ResizeHandle';

const NewItemInput = ({ type, onConfirm, onCancel, initialValue = '' }) => {
  const [value, setValue] = useState(initialValue);

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

const FileItem = ({ item, onSelect, onDelete, onRename, level = 0 }) => {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState([]);
  const [isRenaming, setIsRenaming] = useState(false);

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

  const handleChildRename = async (childItem, newName) => {
    const success = await onRename(childItem, newName);
    if (success) {
      fetchChildren();
    }
    return success;
  };

  if (isRenaming) {
    return (
      <div style={{ paddingLeft: `${level * 12}px` }}>
        <NewItemInput
          type={item.is_dir ? 'folder' : 'file'}
          initialValue={item.name}
          onConfirm={async (newName) => {
            if (newName !== item.name) {
              await onRename(item, newName);
            }
            setIsRenaming(false);
          }}
          onCancel={() => setIsRenaming(false)}
        />
      </div>
    );
  }

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
          <FileIcon name={item.name} size={14} style={{ marginRight: '6px' }} />
        )}
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          {item.name}
        </span>
        <div className="file-actions" style={{ display: 'none', marginLeft: 'auto', gap: '4px' }}>
          <Edit2
            size={12}
            color="#ccc"
            onClick={(e) => {
              e.stopPropagation();
              setIsRenaming(true);
            }}
            title="Rename"
          />
          <Trash2
            size={12}
            color="#ff6b6b"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item);
            }}
            title="Delete"
          />
        </div>
      </div>
      {expanded && children.map(child => (
        <FileItem
          key={child.path}
          item={child}
          onSelect={onSelect}
          onDelete={handleChildDelete}
          onRename={handleChildRename}
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
  const { addToast } = useToast();
  const theme = useTheme();

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
        addToast(`Error: ${res.error}`, { type: 'error' });
      }
      return res.success;
    } catch (e) {
      addToast(`Error: ${e}`, { type: 'error' });
      return false;
    }
  };

  const handleRename = async (item, newName) => {
    const parentDir = item.path.substring(0, item.path.lastIndexOf(item.name));
    const newPath = parentDir + newName;

    try {
      const res = await pytron.rename_item(item.path, newPath);
      if (!res.success) {
        addToast(`Error renaming: ${res.error}`, { type: 'error' });
        return false;
      }
      return true;
    } catch (e) {
      addToast(`Error: ${e}`, { type: 'error' });
      return false;
    }
  };

  const handleRootDelete = async (item) => {
    const success = await handleDelete(item);
    if (success) loadDir(currentPath);
    return success;
  };

  const handleRootRename = async (item, newName) => {
    const success = await handleRename(item, newName);
    if (success) loadDir(currentPath);
    return success;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '10px',
        fontSize: '11px',
        fontWeight: 'bold',
        color: theme.fg,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: theme.bg
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
          <FileItem
            key={idx}
            item={item}
            onSelect={handleItemClick}
            onDelete={handleRootDelete}
            onRename={handleRootRename}
          />
        ))}
      </div>
      <style>{`
        .file-item:hover { background-color: ${theme.secondary}; }
        .file-item:hover .file-actions { display: flex !important; }
      `}</style>
    </div>
  );
};

const Sidebar = ({ onFileOpen, onOpenSettings, activePath, width = '250px', onOpenTool }) => {
  const [activeView, setActiveView] = useState('explorer');
  const [panelWidth, setPanelWidth] = useState(parseInt(width));
  const [changesCount, setChangesCount] = useState(0);
  const { addToast } = useToast();
  const theme = useTheme();

  useEffect(() => {
    const loadGitStatus = async () => {
      try {
        const res = await pytron.get_git_status('.');
        if (res.success) {
          setChangesCount(res.changes.length);
        } else {
          setChangesCount(0);
        }
      } catch (err) {
        setChangesCount(0);
      }
    };
    loadGitStatus();
    const interval = setInterval(loadGitStatus, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100%', borderRight: `1px solid ${theme.border}`, position: 'relative' }}>
      {/* Activity Bar */}
      <div style={{ width: '48px', background: theme.secondary, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '10px', flexShrink: 0 }}>
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
          style={{ padding: '10px', cursor: 'pointer', color: activeView === 'git' ? '#fff' : '#888', borderLeft: activeView === 'git' ? '2px solid #fff' : '2px solid transparent', position: 'relative' }}
          title="Source Control"
        >
          <GitBranch size={24} />
          {changesCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: theme.danger,
              color: '#fff',
              borderRadius: '10px',
              fontSize: '10px',
              padding: '1px 4px',
              minWidth: '12px',
              textAlign: 'center',
              fontWeight: 'bold'
            }}>
              {changesCount}
            </span>
          )}
        </div>
        <div
          onClick={() => setActiveView('tools')}
          style={{ padding: '10px', cursor: 'pointer', color: activeView === 'tools' ? '#fff' : '#888', borderLeft: activeView === 'tools' ? '2px solid #fff' : '2px solid transparent' }}
          title="Tools"
        >
          <Zap size={24} />
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
      <div style={{ width: panelWidth, minWidth: '150px', maxWidth: '600px', background: theme.surface, display: 'flex', flexDirection: 'column' }}>
        {activeView === 'explorer' && <Explorer onFileOpen={onFileOpen} />}
        {activeView === 'search' && <SearchPanel onFileOpen={onFileOpen} />}
        {activeView === 'ai' && <AIPanel activePath={activePath} />}
        {activeView === 'git' && <GitPanel />}
        {activeView === 'tools' && <ToolsPanel onOpenTool={onOpenTool} />}
      </div>
      <ResizeHandle
        orientation="vertical"
        onResize={(e) => setPanelWidth(Math.max(150, e.clientX - 48))}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0 }}
      />

      <style>{`
        .file-item:hover { background-color: #2a2d2e; }
      `}</style>
    </div>
  );
};

export default Sidebar;
