import React, { useState, useEffect, useCallback } from 'react';
import { GitBranch, RefreshCw, Check, Plus, RotateCcw, X, History } from 'lucide-react';
import pytron from 'pytron-client';
import { useToast, useTheme } from 'pytron-ui/react';

const GitPanel = ({ onDiffOpen }) => {
  const [changes, setChanges] = useState([]);
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [gitLog, setGitLog] = useState('');
  const { addToast } = useToast();
  const theme = useTheme();

  const loadStatus = useCallback(async () => {
    try {
      const res = await pytron.get_git_status('.');
      if (res.success) {
        setChanges(res.changes || []);
        setCurrentBranch(res.branch || '');
        setError(null);
      } else {
        setError(res.error);
        setChanges([]);
      }

      const bRes = await pytron.list_branches('.');
      if (bRes.success) {
        setBranches(bRes.branches || []);
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const fetchLog = async () => {
    const res = await pytron.get_git_log('.');
    if (res.success) setGitLog(res.log);
    setShowLog(true);
  };

  useEffect(() => {
    loadStatus();
    // Refresh every 10 seconds
    const interval = setInterval(loadStatus, 10000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  const handleStage = async (e, file) => {
    e.stopPropagation();
    try {
      await pytron.git_action('add', [file]);
      loadStatus();
    } catch (e) { console.error(e); }
  };

  const handleStageAll = async () => {
    try {
      await pytron.git_action('add', ['.']);
      loadStatus();
    } catch (e) { console.error(e); }
  };

  const handleCommit = async () => {
    if (!message.trim()) return;
    try {
      const res = await pytron.git_action('commit', [message]);
      if (res.success) {
        setMessage('');
        loadStatus();
        addToast('Committed successfully!', { type: 'success' });
      } else {
        addToast('Commit failed: ' + res.error, { type: 'error' });
      }
    } catch (e) {
      addToast('Error: ' + e, { type: 'error' });
    }
  };

  const handleCheckout = async (branchName) => {
    try {
      const res = await pytron.checkout_branch(branchName);
      if (res.success) {
        addToast(`Switched to ${branchName}`, { type: 'success' });
        loadStatus();
      } else {
        addToast(`Checkout failed: ${res.error}`, { type: 'error' });
      }
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: theme.surface }}>
      <div style={{
        padding: '10px',
        borderBottom: '1px solid #333',
        fontWeight: 'bold',
        fontSize: '11px',
        color: '#bbb',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: theme.bg
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <History size={14} color="#4fc1ff" />
          <span>SOURCE CONTROL</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <RotateCcw size={12} style={{ cursor: 'pointer' }} onClick={fetchLog} title="Show Git Graph" />
          <RefreshCw size={12} style={{ cursor: 'pointer' }} onClick={loadStatus} title="Refresh Status" />
        </div>
      </div>

      <div style={{ padding: '8px 10px', borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <GitBranch size={14} color="#888" />
        <select
          value={currentBranch}
          onChange={(e) => handleCheckout(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#ccc',
            fontSize: '12px',
            outline: 'none',
            flex: 1,
            cursor: 'pointer'
          }}
        >
          {branches.map(b => (
            <option key={b.name} value={b.name} style={{ background: theme.bg, color: theme.fg }}>{b.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ padding: '10px', color: '#ff6b6b', fontSize: '12px', borderBottom: '1px solid #333' }}>
          {error}
        </div>
      )}

      <div style={{ padding: '10px', borderBottom: '1px solid #333' }}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message (Ctrl+Enter to commit)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              handleCommit();
            }
          }}
          style={{
            width: '100%',
            background: '#2d2d2d',
            border: '1px solid #333',
            color: '#fff',
            padding: '8px',
            fontSize: '12.5px',
            outline: 'none',
            borderRadius: '4px',
            marginBottom: '8px'
          }}
        />
        <button
          onClick={handleCommit}
          disabled={changes.length === 0 || !message.trim()}
          style={{
            width: '100%',
            background: '#007fd4',
            color: '#fff',
            border: 'none',
            padding: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            borderRadius: '4px',
            opacity: (changes.length === 0 || !message.trim()) ? 0.5 : 1,
            fontWeight: '600'
          }}
        >
          Commit
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{
          padding: '8px 10px',
          fontSize: '11px',
          fontWeight: 'bold',
          color: '#888',
          display: 'flex',
          justifyContent: 'space-between',
          letterSpacing: '0.05em'
        }}>
          <span>CHANGES ({changes.length})</span>
          <Plus size={12} style={{ cursor: 'pointer' }} onClick={handleStageAll} title="Stage All" />
        </div>
        {changes.map((change, idx) => (
          <div
            key={idx}
            onClick={() => onDiffOpen && onDiffOpen(change.file)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 10px',
              fontSize: '13px',
              color: '#ccc',
              cursor: 'pointer'
            }} className="git-item"
          >
            <span style={{
              marginRight: '8px',
              fontSize: '11px',
              color: change.status.includes('M') ? '#e2c08d' : change.status.includes('A') ? '#73c991' : '#999',
              width: '20px',
              fontWeight: 'bold',
              textAlign: 'center'
            }}>
              {change.status.trim().charAt(0)}
            </span>
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={change.file}>
              {change.file.split(/[\\/]/).pop()}
              <div style={{ fontSize: '10px', color: '#555' }}>{change.file}</div>
            </span>
            <div className="git-actions" style={{ display: 'none', marginLeft: 'auto', gap: '4px' }}>
              <Plus size={12} style={{ cursor: 'pointer' }} onClick={(e) => handleStage(e, change.file)} title="Stage" />
            </div>
          </div>
        ))}
        {changes.length === 0 && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#555', fontSize: '12px' }}>
            No pending changes.
          </div>
        )}
      </div>

      {showLog && (
        <div
          onClick={() => setShowLog(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '80%',
              maxWidth: '800px',
              height: '80%',
              background: '#1e1e1e',
              border: `1px solid ${theme.border}`,
              display: 'flex',
              flexDirection: 'column',
              borderRadius: '12px',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#252526' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History size={18} color="#4fc1ff" />
                <span style={{ fontWeight: '700', color: '#fff', fontSize: '14px' }}>GIT HISTORY & GRAPH</span>
              </div>
              <X size={20} style={{ cursor: 'pointer', color: '#888' }} onClick={() => setShowLog(false)} />
            </div>
            <pre style={{
              flex: 1,
              margin: 0,
              padding: '20px',
              overflow: 'auto',
              color: '#d4d4d4',
              fontSize: '12.5px',
              fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
              lineHeight: '1.5',
              whiteSpace: 'pre',
              background: '#1e1e1e'
            }}>
              {gitLog}
            </pre>
          </div>
        </div>
      )}

      <style>{`
        .git-item:hover { background-color: rgba(255,255,255,0.03); }
        .git-item:hover .git-actions { display: flex !important; }
      `}</style>
    </div>
  );
};

export default GitPanel;
