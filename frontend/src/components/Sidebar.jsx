import React, { useState, useEffect, useCallback } from 'react';
import pytron from 'pytron-client';
import { Folder, FileCode, Search, Files, Settings, RefreshCw, FilePlus, FolderPlus, Trash2, FolderOpen, GitBranch, Edit2, Zap, Bot, LogOut, Workflow, Sparkles } from 'lucide-react';
import SearchPanel from './SearchPanel';
import GitPanel from './GitPanel';
import ToolsPanel from './ToolsPanel';
import FileIcon from './FileIcon';
import ConfirmModal from './ConfirmModal';
import { useToast, useTheme } from 'pytron-ui/react';
import ResizeHandle from './ResizeHandle';

const architectureStyles = {
  sectionLabel: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: '#94a3b8',
    fontWeight: 800,
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  sectionCard: {
    borderRadius: '16px',
    border: '1px solid rgba(148,163,184,0.14)',
    background: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
    padding: '16px',
    transition: 'border-color 0.2s ease'
  },
  input: {
    width: '100%',
    background: 'rgba(2, 6, 23, 0.4)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    color: '#f8fafc',
    padding: '10px 14px',
    borderRadius: '10px',
    outline: 'none',
    fontSize: '12.5px',
    transition: 'all 0.2s ease'
  },
  textarea: {
    width: '100%',
    minHeight: '180px',
    resize: 'vertical',
    background: 'rgba(2, 6, 23, 0.4)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    color: '#e2e8f0',
    padding: '12px 14px',
    borderRadius: '12px',
    outline: 'none',
    lineHeight: 1.6,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    fontSize: '12px',
  },
};

const ArchitectureAction = ({ icon: Icon, label, onClick, disabled = false, tone = 'default' }) => {
  const tones = {
    default: {
      background: 'rgba(30, 41, 59, 0.4)',
      border: '1px solid rgba(148, 163, 184, 0.15)',
      color: '#cbd5e1',
    },
    accent: {
      background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(37,99,235,0.15))',
      border: '1px solid rgba(96,165,250,0.3)',
      color: '#93c5fd',
    },
    warn: {
      background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(234,88,12,0.15))',
      border: '1px solid rgba(251,191,36,0.3)',
      color: '#fde68a',
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`arch-btn ${tone}`}
      style={{
        ...tones[tone],
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '10px 14px',
        borderRadius: '12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 600,
        fontSize: '11px',
        opacity: disabled ? 0.45 : 1,
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        backdropFilter: 'blur(4px)',
        textTransform: 'uppercase',
        letterSpacing: '0.04em'
      }}
    >
      {Icon ? <Icon size={14} /> : null}
      <span>{label}</span>
    </button>
  );
};

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

const FileItem = ({ item, onSelect, onDelete, onRename, onNewItem, selectedItem, level = 0 }) => {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState([]);
  const [isRenaming, setIsRenaming] = useState(false);

  const fetchChildren = async () => {
    const res = await pytron.list_dir(item.path);
    if (res.success) setChildren(res.items);
  };

  useEffect(() => {
    if (expanded) {
      const handler = () => fetchChildren();
      window.addEventListener('fs_change', handler);
      return () => window.removeEventListener('fs_change', handler);
    }
  }, [expanded, item.path]);

  const handleToggle = async (e) => {
    e.stopPropagation();
    onSelect(item);
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
    onDelete(childItem);
    return true;
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
          position: 'relative',
          backgroundColor: selectedItem?.path === item.path ? 'rgba(0, 127, 212, 0.3)' : 'transparent',
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
          {item.is_dir && (
            <>
              <FilePlus
                size={12}
                color="#ccc"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(item);
                  onNewItem('file');
                }}
                title="New File"
              />
              <FolderPlus
                size={12}
                color="#ccc"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(item);
                  onNewItem('folder');
                }}
                title="New Folder"
              />
            </>
          )}
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
          onNewItem={onNewItem}
          selectedItem={selectedItem}
          level={level + 1}
        />
      ))}
    </>
  );
};

const Explorer = ({ onFileOpen, onFolderOpen, projectPath }) => {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPath, setCurrentPath] = useState(projectPath || '.');
  const [creatingType, setCreatingType] = useState(null); // 'file' or 'folder'
  const [confirmDelete, setConfirmDelete] = useState(null); // Item to delete
  const { addToast } = useToast();
  const theme = useTheme();

  const loadDir = useCallback(async (path) => {
    try {
      const res = await pytron.list_dir(path);
      if (res.success) {
        setItems(res.items);
        setCurrentPath(res.current_path);
        if (onFolderOpen) onFolderOpen(res.current_path);
      } else {
        console.error(res.error);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadDir(currentPath);
    const handler = () => loadDir(currentPath);
    window.addEventListener('fs_change', handler);
    return () => window.removeEventListener('fs_change', handler);
  }, [loadDir, currentPath]);

  useEffect(() => {
    if (projectPath && projectPath !== currentPath) {
      setCurrentPath(projectPath);
    }
  }, [projectPath]);

  const handleItemClick = (item) => {
    setSelectedItem(item);
    if (!item.is_dir) {
      console.log('[Sidebar] onFileOpen', item.path);
      onFileOpen(item);
    }
  };

  const handleCreateConfirm = async (name) => {
    let basePath = currentPath;
    if (selectedItem) {
      if (selectedItem.is_dir) {
        basePath = selectedItem.path;
      } else {
        basePath = selectedItem.path.substring(0, selectedItem.path.lastIndexOf(selectedItem.name));
      }
    }
    const sep = basePath.includes('\\') ? '\\' : '/';
    const path = basePath.endsWith(sep) ? `${basePath}${name}` : `${basePath}${sep}${name}`;
    try {
      const res = await pytron.create_item(path, creatingType === 'folder');
      if (res.success) {
        window.dispatchEvent(new Event('fs_change'));
      } else {
        console.error(`Error: ${res.error}`);
      }
    } catch (e) {
      console.error(`Error: ${e}`);
    }
    setCreatingType(null);
  };

  const handleOpenFolder = async () => {
    console.log('[Sidebar] Requesting directory selection...');
    try {
      const res = await pytron.select_directory();
      console.log('[Sidebar] select_directory result:', res);
      if (res.success) {
        loadDir(res.path);
      }
    } catch (e) {
      console.error('[Sidebar] select_directory failed:', e);
    }
  };

  const handleDelete = async (item) => {
    setConfirmDelete(item);
  };

  const executeDelete = async (item) => {
    try {
      const res = await pytron.delete_item(item.path);
      if (!res.success) {
        addToast(`Error: ${res.error}`, { type: 'error' });
      } else {
        window.dispatchEvent(new Event('fs_change'));
      }
    } catch (e) {
      addToast(`Error: ${e}`, { type: 'error' });
    }
    setConfirmDelete(null); // Close modal after action
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
      window.dispatchEvent(new Event('fs_change'));
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
          {projectPath && <LogOut size={13} style={{ cursor: 'pointer', color: '#ff6b6b' }} onClick={() => onFolderOpen(null)} title="Close Folder" />}
          <FilePlus size={14} style={{ cursor: 'pointer' }} onClick={() => setCreatingType('file')} title="New File" />
          <FolderPlus size={14} style={{ cursor: 'pointer' }} onClick={() => setCreatingType('folder')} title="New Folder" />
          <FolderOpen size={14} style={{ cursor: 'pointer' }} onClick={handleOpenFolder} title="Open Folder" />
          <RefreshCw size={12} style={{ cursor: 'pointer' }} onClick={() => loadDir(currentPath)} title="Refresh" />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }} onClick={() => setSelectedItem(null)}>
        {!projectPath ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
            <FolderOpen size={48} color="#333" />
            <div style={{ color: '#888', fontSize: '13px', lineHeight: '1.6' }}>
              You have not yet opened a folder.
            </div>
            <button
              onClick={handleOpenFolder}
              style={{
                background: '#007fd4',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12.5px',
                fontWeight: '600',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.target.style.background = '#006ab1'}
              onMouseLeave={e => e.target.style.background = '#007fd4'}
            >
              Open Folder
            </button>
          </div>
        ) : (
          <>
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
                onNewItem={setCreatingType}
                selectedItem={selectedItem}
              />
            ))}
          </>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          isOpen={true}
          title="Delete Item"
          message={`Are you sure you want to delete "${confirmDelete.name}"? This action cannot be undone.`}
          onConfirm={() => executeDelete(confirmDelete)}
          onClose={() => setConfirmDelete(null)}
          variant="danger"
        />
      )}

      <style>{`
        .file-item:hover { background-color: ${theme.secondary}; }
        .file-item:hover .file-actions { display: flex !important; }
      `}</style>
    </div>
  );
};

const ArchitecturePanel = ({ architectureState, showConceptBoard }) => {
  const theme = useTheme();

  if (!showConceptBoard) {
    return (
      <div style={{ padding: '18px', color: '#94a3b8', fontSize: '13px', lineHeight: '1.7' }}>
        Open the Architecture board to inspect and edit diagram details from the sidebar.
      </div>
    );
  }

  if (!architectureState) {
    return (
      <div style={{ padding: '18px', color: '#94a3b8', fontSize: '13px', lineHeight: '1.7' }}>
        Waiting for the Architecture board to publish its state.
      </div>
    );
  }

  const { title, viewHistory, stats, selectedElement, isGenerating, actions } = architectureState;
  const selectedNode = selectedElement?.type === 'node' ? selectedElement.item : null;
  const selectedEdge = selectedElement?.type === 'edge' ? selectedElement.item : null;
  const currentPath = ['System Overview', ...(viewHistory || []).map((entry) => entry.label), title]
    .filter(Boolean)
    .join(' / ');

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
        <span>ARCHITECTURE</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <RefreshCw size={12} style={{ cursor: 'pointer' }} onClick={actions.load} title="Refresh" />
        </div>
      </div>

      <div style={{ padding: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#93c5fd' }}>
          <Workflow size={12} />
          <span>Architecture</span>
        </div>
        <div style={{ marginTop: '8px', fontSize: '22px', fontWeight: 800, color: '#f8fafc', lineHeight: 1.2 }}>{title}</div>
        <div style={{ marginTop: '6px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.55 }}>
          Control the board from here. The canvas stays focused on structure, while this sidebar handles actions, notes, and AI-assisted architecture work.
        </div>
        <div
          style={{
            marginTop: '12px',
            padding: '10px 12px',
            borderRadius: '12px',
            border: '1px solid rgba(148,163,184,0.12)',
            background: 'rgba(15,23,42,0.56)',
            color: '#cbd5e1',
            fontSize: '11px',
            lineHeight: 1.6,
          }}
        >
          {currentPath}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={architectureStyles.sectionCard}>
          <div style={architectureStyles.sectionLabel}>
            <Zap size={13} color="#60a5fa" />
            <span>Board Actions</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
            <ArchitectureAction icon={FilePlus} label="Add Node" onClick={actions.addNode} />
            <ArchitectureAction icon={RefreshCw} label="Load" onClick={actions.load} />
            <ArchitectureAction icon={FolderOpen} label="Save" onClick={actions.save} />
            <ArchitectureAction icon={Search} label="Index" onClick={actions.indexWorkspace} disabled={isGenerating} tone="warn" />
            <ArchitectureAction icon={Workflow} label="Diagram" onClick={actions.generateDiagram} disabled={isGenerating} tone="accent" />
            <ArchitectureAction icon={Sparkles} label={isGenerating ? 'Working...' : 'Expand AI'} onClick={actions.analyze} disabled={isGenerating} tone="accent" />
          </div>
          {viewHistory?.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <ArchitectureAction icon={RefreshCw} label="Go Back" onClick={actions.goBack} />
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
          {[
            { label: 'Nodes', value: stats.nodes, accent: '#60a5fa' },
            { label: 'Edges', value: stats.edges, accent: '#a78bfa' },
            { label: 'Depth', value: stats.depth, accent: '#f59e0b' },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                ...architectureStyles.sectionCard,
                padding: '12px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div style={{ ...architectureStyles.sectionLabel, color: item.accent, marginBottom: '6px', fontSize: '9px', justifyContent: 'center' }}>{item.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 900, color: '#f8fafc', letterSpacing: '-0.02em' }}>{item.value}</div>
            </div>
          ))}
        </div>

        {!selectedElement && (
          <div style={architectureStyles.sectionCard}>
            <div style={architectureStyles.sectionLabel}>Inspector</div>
            <div style={{ color: '#e2e8f0', fontSize: '16px', fontWeight: 700 }}>No Selection</div>
            <div style={{ marginTop: '10px', color: '#94a3b8', fontSize: '12.5px', lineHeight: '1.6' }}>
              Select a node or connection in the board to inspect properties. Use the canvas for layout, and this panel for details.
            </div>
          </div>
        )}

        {selectedNode && (
          <div style={{ ...architectureStyles.sectionCard, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div>
                <div style={architectureStyles.sectionLabel}>Component Details</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc' }}>
                  {selectedNode.data.label || 'Untitled Component'}
                </div>
              </div>
              <ArchitectureAction icon={Sparkles} label="Docs" onClick={actions.generateDocs} disabled={isGenerating} tone="accent" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                Identifier
              </label>
              <input
                value={selectedNode.data.label}
                onChange={(event) => actions.updateField('label', event.target.value)}
                style={architectureStyles.input}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                Implementation Notes
              </label>
              <textarea
                value={selectedNode.data.description || ''}
                onChange={(event) => actions.updateField('description', event.target.value)}
                style={architectureStyles.textarea}
              />
            </div>
          </div>
        )}

        {selectedEdge && (
          <div style={{ ...architectureStyles.sectionCard, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={architectureStyles.sectionLabel}>Edge Mapping</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#f8fafc' }}>
                {selectedEdge.source} <span style={{ color: '#475569' }}>→</span> {selectedEdge.target}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                Data Protocol
              </label>
              <input
                value={selectedEdge.label || ''}
                onChange={(event) => actions.updateField('label', event.target.value)}
                style={architectureStyles.input}
                placeholder="e.g. gRPC, REST, IPC"
              />
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: '#e2e8f0', fontSize: '13px', background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <input
                type="checkbox"
                checked={selectedEdge.animated || false}
                onChange={(event) => actions.updateField('animated', event.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <span style={{ fontWeight: 500 }}>Live data flow animation</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

const Sidebar = ({ onFileOpen, onFolderOpen, onDiffOpen, onOpenSettings, activePath, width = '250px', onOpenTool, onOpenAI, onLaunchCliProvider, settings, projectPath, architectureState, showConceptBoard }) => {
  const [activeView, setActiveView] = useState('explorer');
  const [panelWidth, setPanelWidth] = useState(parseInt(width));
  const [changesCount, setChangesCount] = useState(0);
  const [searchState, setSearchState] = useState({
    query: '',
    replaceQuery: '',
    showReplace: false,
    results: [],
    expandedFiles: {}
  });
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
      <div style={{ width: '48px', background: theme.bg, color: theme.fg, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: '20px', borderRight: `1px solid ${theme.border}` }}>
        <div onClick={() => setActiveView('explorer')} style={{ cursor: 'pointer', opacity: activeView === 'explorer' ? 1 : 0.4 }} title="Explorer">
          <Files size={24} color={activeView === 'explorer' ? "#4fc1ff" : theme.fg} />
        </div>
        <div onClick={() => setActiveView('search')} style={{ cursor: 'pointer', opacity: activeView === 'search' ? 1 : 0.4 }} title="Search">
          <Search size={24} color={activeView === 'search' ? "#4fc1ff" : theme.fg} />
        </div>
        <div onClick={() => setActiveView('git')} style={{ cursor: 'pointer', opacity: activeView === 'git' ? 1 : 0.4, position: 'relative' }} title="Source Control">
          <GitBranch size={24} color={activeView === 'git' ? "#4fc1ff" : theme.fg} />
          {changesCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#007fd4',
              color: '#fff',
              borderRadius: '10px',
              padding: '2px 6px',
              fontSize: '10px',
              fontWeight: 'bold'
            }}>{changesCount}</span>
          )}
        </div>
        <div onClick={() => setActiveView('tools')} style={{ cursor: 'pointer', opacity: activeView === 'tools' ? 1 : 0.4 }} title="Tools">
          <Zap size={24} color={activeView === 'tools' ? "#4fc1ff" : theme.fg} />
        </div>
        <div onClick={() => setActiveView('architecture')} style={{ cursor: 'pointer', opacity: activeView === 'architecture' ? 1 : 0.4 }} title="Architecture">
          <Workflow size={24} color={activeView === 'architecture' ? "#4fc1ff" : theme.fg} />
        </div>

        <div style={{ marginTop: 'auto', paddingBottom: '20px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          <div onClick={() => onOpenAI?.()} style={{ cursor: 'pointer', opacity: 0.6 }} title="AI Research">
            <Bot size={24} color={theme.fg} />
          </div>
          <div onClick={onOpenSettings} style={{ cursor: 'pointer', opacity: 0.4 }} title="Settings">
            <Settings size={22} />
          </div>
        </div>
      </div>

      {/* Side Panel Content */}
      <div style={{ width: panelWidth, minWidth: '150px', maxWidth: '600px', background: theme.surface, display: 'flex', flexDirection: 'column' }}>
        {activeView === 'explorer' && <Explorer onFileOpen={onFileOpen} onFolderOpen={onFolderOpen} projectPath={projectPath} />}
        {activeView === 'search' && <SearchPanel onFileOpen={onFileOpen} searchState={searchState} setSearchState={setSearchState} />}
        {activeView === 'git' && <GitPanel onDiffOpen={onDiffOpen} />}
        {activeView === 'tools' && <ToolsPanel onOpenTool={(id) => id === 'dashboard' ? setActiveView('dashboard') : onOpenTool(id)} onLaunchCliProvider={onLaunchCliProvider} />}
        {activeView === 'architecture' && <ArchitecturePanel architectureState={architectureState} showConceptBoard={showConceptBoard} />}
      </div>

      <ResizeHandle
        orientation="vertical"
        onResize={(e) => setPanelWidth(Math.max(150, e.clientX - 48))}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0 }}
      />

      <style>{`
        .file-item:hover { background-color: #2a2d2e; }
        .arch-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0,0,0,0.3);
          border-color: rgba(255,255,255,0.3) !important;
        }
        .arch-btn:active {
          transform: translateY(0);
        }
        .arch-btn.accent:hover {
          border-color: rgba(96,165,250,0.5) !important;
          background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.25)) !important;
        }
        .arch-btn.warn:hover {
          border-color: rgba(251,191,36,0.5) !important;
          background: linear-gradient(135deg, rgba(245,158,11,0.2), rgba(234,88,12,0.25)) !important;
        }
      `}</style>
    </div>
  );
};

export default Sidebar;
