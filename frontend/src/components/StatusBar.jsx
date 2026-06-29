import React, { useState, useEffect } from 'react';
import { Terminal, GitBranch, CheckCircle2 } from 'lucide-react';
import pytron from 'pytron-client';

const StatusBar = ({ cursor = { line: 1, column: 1 }, onToggleTerminal, projectPath }) => {
  const [gitBranch, setGitBranch] = useState('main');
  const [projectName, setProjectName] = useState('TerminateCode');
  const [memory, setMemory] = useState(0);

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const path = projectPath || '.';
        const res = await pytron.get_git_status(path);
        if (res.success) setGitBranch(res.branch || 'main');

        // Extract folder name from path or fallback to system cwd
        if (projectPath) {
          setProjectName(projectPath.split(/[\\/]/).pop() || 'Workspace');
        } else {
          const sysRes = await pytron.get_system_info();
          if (sysRes.success && sysRes.cwd) {
            setProjectName(sysRes.cwd.split(/[\\/]/).pop() || 'Workspace');
          }
        }

        const health = await pytron.get_system_health();
        if (health.success) setMemory(Math.round(health.memory_usage));
      } catch (err) { }
    };
    loadInfo();
    const interval = setInterval(loadInfo, 10000); // 10s refresh
    return () => clearInterval(interval);
  }, [projectPath]);

  return (
    <div style={{
      height: '26px',
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-color)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      color: 'var(--text-secondary)',
      fontSize: '11px',
      fontWeight: '500',
      justifyContent: 'space-between',
      letterSpacing: '0.03em',
      userSelect: 'none',
      boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.15)'
    }}>
      <style>{`
        .status-item {
          transition: all 0.15s ease;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .status-item:hover {
          color: var(--text-active) !important;
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <div style={{
          padding: '2px 8px',
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.16)',
          borderRadius: '4px',
          height: '18px',
          display: 'flex',
          alignItems: 'center',
          fontWeight: '700',
          fontSize: '10px',
          color: 'var(--accent)',
          letterSpacing: '0.06em'
        }}>
          {projectName.toUpperCase()}
        </div>
        
        <div className="status-item" title="Git Branch">
          <GitBranch size={12} />
          <span>{gitBranch}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '6px',
              height: '6px',
              background: 'var(--success)',
              borderRadius: '50%',
              boxShadow: '0 0 8px var(--success)',
              animation: 'pulseDot 2s infinite'
            }} />
            <span style={{ color: '#a1a1aa' }}>Connected</span>
          </div>
          
          <div className="status-item" onClick={onToggleTerminal} title="Toggle integrated terminal">
            <Terminal size={12} />
            <span>Terminal</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {memory > 0 && <div style={{ color: 'var(--text-secondary)', opacity: 0.8 }}>{memory} MB RAM</div>}
        <div style={{ color: 'var(--text-secondary)' }}>Line {cursor.line}, Column {cursor.column}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>UTF-8</span>
          <div style={{
            width: '6px',
            height: '6px',
            background: 'var(--accent-cyan)',
            borderRadius: '50%',
            boxShadow: '0 0 6px var(--accent-cyan)'
          }} />
        </div>
      </div>
    </div>
  );
};

export default StatusBar;

