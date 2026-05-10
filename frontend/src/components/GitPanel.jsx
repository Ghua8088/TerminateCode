import React, { useState, useEffect, useCallback } from 'react';
import { GitBranch, RefreshCw, Check, Plus, RotateCcw, X, History, Sparkles } from 'lucide-react';
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
  const [isRepo, setIsRepo] = useState(true);
  const [isGeneratingMsg, setIsGeneratingMsg] = useState(false);
  const { addToast } = useToast();
  const theme = useTheme();

  const handleInit = async () => {
    try {
      const res = await pytron.git_action('init');
      if (res.success) {
        addToast('Git repository initialized!', { type: 'success' });
        loadStatus();
      } else {
        addToast('Init failed: ' + res.error, { type: 'error' });
      }
    } catch (e) {
      console.error(e);
      addToast('Error initializing git: ' + e.message, { type: 'error' });
    }
  };

  const loadStatus = useCallback(async () => {
    try {
      const res = await pytron.get_git_status('.');
      if (res.success) {
        setChanges(res.changes || []);
        setCurrentBranch(res.branch || '');
        setIsRepo(res.is_repo !== false);
        setError(null);
      } else {
        setError(res.error);
        setChanges([]);
        setIsRepo(false);
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

  const handleGenerateMessage = async () => {
    setIsGeneratingMsg(true);
    addToast('Analyzing diff...', { type: 'info' });
    try {
      const res = await pytron.generate_commit_message();
      if (res.success && res.message) {
        setMessage(res.message);
        addToast('Message generated!', { type: 'success' });
      } else {
        addToast('Generation failed: ' + (res.error || 'Unknown error'), { type: 'error' });
      }
    } catch (err) {
      addToast('Request failed: ' + err.message, { type: 'error' });
    }
    setIsGeneratingMsg(false);
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
        fontSize: '11px',
        fontWeight: 'bold',
        color: theme.fg,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: theme.bg,
        borderBottom: `1px solid ${theme.border}`
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

      <div style={{ padding: '8px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#888' }}>
        <GitBranch size={12} />
        <select
          value={currentBranch}
          onChange={(e) => handleCheckout(e.target.value)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#ccc',
            fontSize: '11px',
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
        <div style={{ padding: '8px', color: '#ff6b6b', fontSize: '11px', borderBottom: `1px solid ${theme.border}` }}>
          {error}
        </div>
      )}

      <div style={{ padding: '10px 8px', borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(0,0,0,0.15)', border: `1px solid ${theme.border}`, padding: '1px', borderRadius: '4px' }}>
          <textarea
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
              background: 'transparent',
              border: 'none',
              color: theme.fg,
              padding: '6px',
              fontSize: '12px',
              outline: 'none',
              resize: 'none',
              minHeight: '52px',
              fontFamily: "inherit"
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px 4px 4px', alignItems: 'center' }}>
            <Sparkles 
              size={13} 
              color={isGeneratingMsg ? '#888' : '#a855f7'} 
              style={{ cursor: isGeneratingMsg || changes.length === 0 ? 'not-allowed' : 'pointer', opacity: changes.length === 0 ? 0.3 : 1 }}
              onClick={changes.length > 0 && !isGeneratingMsg ? handleGenerateMessage : undefined} 
              title="Auto-generate commit message"
            />
            <button
              onClick={handleCommit}
              disabled={changes.length === 0 || !message.trim()}
              title="Commit (Ctrl+Enter)"
              style={{
                background: '#007fd4',
                color: '#fff',
                border: 'none',
                padding: '4px 10px',
                cursor: 'pointer',
                fontSize: '11px',
                borderRadius: '3px',
                opacity: (changes.length === 0 || !message.trim()) ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: '500'
              }}
            >
              <Check size={12} /> Commit
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{
          padding: '10px 14px',
          fontSize: '11px',
          fontWeight: '600',
          color: theme.fg,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>CHANGES <span style={{ background: '#333', padding: '1px 6px', borderRadius: '10px', fontSize: '9px', marginLeft: '4px' }}>{changes.length}</span></span>
          <Plus size={14} style={{ cursor: 'pointer', color: '#ccc' }} onClick={handleStageAll} title="Stage All Changes" />
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
        {changes.length === 0 && isRepo && (
          <div style={{ padding: '20px', textAlign: 'center', color: '#555', fontSize: '12px' }}>
            No pending changes.
          </div>
        )}
        {!isRepo && (
          <div style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
            <GitBranch size={40} color="#333" />
            <div style={{ color: '#888', fontSize: '13px' }}>The current folder is not a git repository.</div>
            <button
              onClick={handleInit}
              style={{
                background: '#007fd4',
                color: '#fff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600'
              }}
            >
              Initialize Repository
            </button>
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
