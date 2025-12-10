import React, { useState, useEffect } from 'react';
import { GitBranch, RefreshCw, Check, Plus, RotateCcw } from 'lucide-react';
import pytron from 'pytron-client';
import { useToast } from 'pytron-ui';
import { useTheme } from 'pytron-ui';

const GitPanel = () => {
  const [changes, setChanges] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(null);
  const { addToast } = useToast();
  const theme = useTheme();

  const loadStatus = React.useCallback(async () => {
    try {
      const res = await pytron.get_git_status('.');
      if (res.success) {
        setChanges(res.changes);
        setError(null);
      } else {
        setError(res.error);
        setChanges([]);
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleStage = async (file) => {
    try {
      await pytron.git_action('add', [file]);
      loadStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStageAll = async () => {
    try {
      await pytron.git_action('add', ['.']);
      loadStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCommit = async () => {
    if (!message.trim()) return;
    try {
      const res = await pytron.git_action('commit', [message]);
      if (res.success) {
        setMessage('');
        loadStatus();
      } else {
        addToast('Commit failed: ' + res.error, { type: 'error' });
      }
    } catch (e) {
      addToast('Error: ' + e, { type: 'error' });
    }
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
        alignItems: 'center'
      }}>
        <span>SOURCE CONTROL</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <RefreshCw size={12} style={{ cursor: 'pointer' }} onClick={loadStatus} title="Refresh Status" />
        </div>
      </div>

      {error && (
        <div style={{ padding: '10px', color: '#ff6b6b', fontSize: '12px' }}>
          {error}
        </div>
      )}

      <div style={{ padding: '10px', borderBottom: '1px solid #333' }}>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
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
              flex: 1,
              background: '#3c3c3c',
              border: '1px solid #333',
              color: '#fff',
              padding: '6px',
              fontSize: '12px',
              outline: 'none',
              borderRadius: '2px'
            }}
          />
        </div>
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
            borderRadius: '2px',
            opacity: (changes.length === 0 || !message.trim()) ? 0.5 : 1
          }}
        >
          Commit
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: '8px 10px', fontSize: '11px', fontWeight: 'bold', color: '#bbb', display: 'flex', justifyContent: 'space-between' }}>
          <span>CHANGES ({changes.length})</span>
          <Plus size={12} style={{ cursor: 'pointer' }} onClick={handleStageAll} title="Stage All" />
        </div>
        {changes.map((change, idx) => (
          <div key={idx} style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 10px',
            fontSize: '13px',
            color: '#ccc',
            cursor: 'pointer',
            ':hover': { backgroundColor: '#2a2d2e' }
          }} className="git-item">
            <span style={{
              marginRight: '8px',
              fontSize: '11px',
              color: change.status.includes('M') ? '#e2c08d' : change.status.includes('A') ? '#73c991' : '#999',
              width: '20px'
            }}>
              {change.status.split(' ')[0]}
            </span>
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={change.file}>
              {change.file}
            </span>
            <div className="git-actions" style={{ display: 'none', marginLeft: 'auto', gap: '4px' }}>
              <Plus size={12} style={{ cursor: 'pointer' }} onClick={() => handleStage(change.file)} title="Stage" />
            </div>
          </div>
        ))}
      </div>
      <style>{`
        .git-item:hover { background-color: #2a2d2e; }
        .git-item:hover .git-actions { display: flex !important; }
      `}</style>
    </div>
  );
};

export default GitPanel;
