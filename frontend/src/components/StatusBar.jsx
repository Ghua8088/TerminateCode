import React from 'react';
import { Terminal } from 'lucide-react';

const StatusBar = ({ cursor = { line: 1, column: 1 }, onToggleTerminal }) => {
  return (
    <div style={{ height: '24px', background: '#151515', borderTop: '1px solid #2b2b2b', display: 'flex', alignItems: 'center', padding: '0 12px', color: '#9a9a9a', fontSize: '12px', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ marginRight: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={onToggleTerminal}>
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
