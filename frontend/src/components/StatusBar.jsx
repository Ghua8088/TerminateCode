import React, { useState, useEffect } from 'react';
import { Terminal, GitBranch, RefreshCw, XCircle, AlertTriangle } from 'lucide-react';
import { useTheme } from 'pytron-ui';
import pytron from 'pytron-client';

const StatusBar = ({ cursor = { line: 1, column: 1 }, onToggleTerminal }) => {
  const theme = useTheme();
  const [gitBranch, setGitBranch] = useState('');
  
  useEffect(() => {
    const loadGitStatus = async () => {
      try {
        const res = await pytron.get_git_status('.');
        if (res.success) {
          let hasStaged = false;
          let hasModified = false;
          res.changes.forEach(c => {
             // Status is 2 chars. 1st is index, 2nd is work tree.
             // ?? is untracked.
             const s = c.status;
             if (s === '??') {
                 hasModified = true;
             } else {
                 if (s[0] && s[0] !== ' ' && s[0] !== '?') hasStaged = true;
                 if (s[1] && s[1] !== ' ' && s[1] !== '?') hasModified = true;
             }
          });
          
          let suffix = '';
          if (hasModified) suffix += '*';
          if (hasStaged) suffix += '+';
          
          setGitBranch((res.branch || '') + suffix);
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadGitStatus();
    const interval = setInterval(loadGitStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ height: '24px', background: theme.secondary, borderTop: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', padding: '0 12px', color: theme.fg, fontSize: '12px', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }} title="Git Branch">
          <GitBranch size={12} />
          <span>{gitBranch}</span>
        </div>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Sync Changes">
           <RefreshCw size={12} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }} title="No Errors">
           <XCircle size={12} /> 0
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} title="No Warnings">
           <AlertTriangle size={12} /> 0
        </div>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', marginLeft: '8px' }} onClick={onToggleTerminal}>
          <Terminal size={12} style={{ marginRight: '4px' }} />
          <span>Terminal</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ marginRight: '16px' }}>Ln {cursor.line}, Col {cursor.column}</div>
        <div style={{ marginRight: '16px' }}>|</div>
        <div>UTF-8</div>
      </div>
    </div>
  );
};

export default StatusBar;
