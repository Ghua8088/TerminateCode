import React from 'react';
import { FlaskConical, Activity, Box, Binary, Zap, Globe } from 'lucide-react';

const ToolsPanel = ({ onOpenTool }) => {
    const tools = [
        { id: 'regex', name: 'Regex Lab', icon: <FlaskConical size={18} color="#4caf50" />, desc: 'Test Python regex patterns' },
        { id: 'metrics', name: 'Code X-Ray', icon: <Activity size={18} color="#4fc1ff" />, desc: 'Analyze code complexity' },
        { id: 'imports', name: 'Import Lens', icon: <Box size={18} color="#ff9800" />, desc: 'Manage dependencies' },
        { id: 'bytecode', name: 'Bytecode Viewer', icon: <Binary size={18} color="#9b59b6" />, desc: 'View Python bytecode' },
        { id: 'preview', name: 'Web Preview', icon: <Globe size={18} color="#e91e63" />, desc: 'Live web preview' },
        { id: 'format', name: 'Format Code', icon: <Zap size={18} color="#f1c40f" />, desc: 'Format with Black' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{
                padding: '10px',
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#bbb',
                background: '#1e1e1e',
                textTransform: 'uppercase'
            }}>
                Pytron Tools
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {tools.map(tool => (
                    <div
                        key={tool.id}
                        onClick={() => onOpenTool(tool.id)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px',
                            marginBottom: '8px',
                            background: '#2d2d2d',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            border: '1px solid #333',
                            transition: 'background 0.2s'
                        }}
                        className="tool-item"
                    >
                        <div style={{ marginRight: '10px' }}>{tool.icon}</div>
                        <div>
                            <div style={{ color: '#e0e0e0', fontSize: '13px', fontWeight: '500' }}>{tool.name}</div>
                            <div style={{ color: '#888', fontSize: '11px' }}>{tool.desc}</div>
                        </div>
                    </div>
                ))}
            </div>
            <style>{`
                .tool-item:hover { background-color: #383838 !important; border-color: #444 !important; }
            `}</style>
        </div>
    );
};

export default ToolsPanel;
