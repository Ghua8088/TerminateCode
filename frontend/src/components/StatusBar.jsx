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
      height: '24px',
      background: 'var(--accent)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      color: '#fff',
      fontSize: '11px',
      fontWeight: '600',
      justifyContent: 'space-between',
      letterSpacing: '0.02em',
      userSelect: 'none'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ padding: '0 8px', background: 'rgba(255,255,255,0.1)', height: '100%', display: 'flex', alignItems: 'center', fontWeight: '800' }}>
          {projectName.toUpperCase()}
        </div>
        <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.8 }} title="Git Branch">
          <GitBranch size={12} />
          <span>{gitBranch}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: 0.8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '6px', height: '6px', background: '#4caf50', borderRadius: '50%' }} />
            <span>Connected</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={onToggleTerminal}>
            <Terminal size={12} />
            <span>Terminal</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {memory > 0 && <div style={{ opacity: 0.7 }}>{memory} MB RAM</div>}
        <div style={{ opacity: 0.9 }}>Line {cursor.line}, Column {cursor.column}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>UTF-8</span>
          <div style={{ width: '8px', height: '8px', background: '#fff', borderRadius: '50%', boxShadow: '0 0 8px rgba(255,255,255,0.5)' }} />
        </div>
      </div>
    </div>
  );
};

export default StatusBar;

