import React, { useState, useEffect } from 'react';
import pytron from 'pytron-client';
import { Layout, Plus, Folder, Clock, GitBranch, Terminal, Cpu, Activity, Server, Hash } from 'lucide-react';
import './PanelStyles.css';

const WorkspaceCanvas = ({ onOpenProject, onNewProject }) => {
    const [workspaces, setWorkspaces] = useState({});
    const [workspaceDetails, setWorkspaceDetails] = useState({});
    const [aiModels, setAiModels] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchWorkspaces = async () => {
        setLoading(true);
        try {
            // Fetch the list of workspaces
            const res = await pytron.list_workspaces();
            if (res.success) {
                setWorkspaces(res.workspaces);
                
                // For each workspace, fetch real Git status to make the canvas alive
                Object.values(res.workspaces).forEach(async (ws) => {
                    try {
                        const gitRes = await pytron.get_git_status(ws.path);
                        if (gitRes.success) {
                            setWorkspaceDetails(prev => ({
                                ...prev,
                                [ws.path]: {
                                    branch: gitRes.branch,
                                    changes: gitRes.changes?.length || 0,
                                    isRepo: gitRes.is_repo
                                }
                            }));
                        }
                    } catch (e) {
                        console.error(`Failed to fetch git for ${ws.path}`, e);
                    }
                });
            }

            // Fetch available AI models to show system capabilities
            const aiRes = await pytron.get_available_models();
            if (aiRes.success) {
                setAiModels(aiRes.models);
            }
        } catch (e) {
            console.error("Failed to load orchestrator data", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchWorkspaces();
        // Refresh git statuses every 15 seconds to keep the canvas live
        const interval = setInterval(fetchWorkspaces, 15000);
        return () => clearInterval(interval);
    }, []);

    const workspaceList = Object.values(workspaces).sort((a, b) => b.last_accessed - a.last_accessed);

    return (
        <div className="panel-container" style={{ background: 'var(--bg-primary)', overflowY: 'auto', height: '100%' }}>
            <div className="panel-header">
                <div className="panel-header-title">
                    <Layout size={16} color="var(--accent-color)" />
                    <span>TERMINATE - SPATIAL ORCHESTRATOR</span>
                </div>
                <button className="sleek-button" onClick={onNewProject}>
                    <Plus size={14} />
                    <span>New Project</span>
                </button>
            </div>

            <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                
                {/* Header Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: '300', marginBottom: '12px', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                            Command Center
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '600px', lineHeight: '1.6' }}>
                            Select an environment to initialize your workspace. Live telemetry is being pulled from your local system.
                        </p>
                    </div>
                    {loading && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-color)', fontSize: '12px' }}>
                            <Activity size={14} className="animate-pulse" />
                            SYNCING TELEMETRY...
                        </div>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '24px' }}>
                    
                    {/* Active Workspaces (Real Data) */}
                    <div className="canvas-section" style={{ gridColumn: '1 / -1' }}>
                        <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: 'var(--text-active)', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px' }}>
                            <Server size={16} color="#4fc1ff" />
                            ACTIVE WORKSPACES
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                            {workspaceList.map((ws) => {
                                const details = workspaceDetails[ws.path];
                                return (
                                    <div 
                                        key={ws.path} 
                                        className="sleek-card canvas-item" 
                                        style={{ 
                                            padding: '20px', 
                                            cursor: 'pointer', 
                                            position: 'relative',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '16px',
                                            background: 'var(--bg-secondary)',
                                            border: '1px solid var(--border-subtle)'
                                        }}
                                        onClick={() => onOpenProject(ws.path)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ 
                                                width: '40px', height: '40px', borderRadius: '8px', 
                                                background: 'rgba(79, 193, 255, 0.1)', display: 'flex', 
                                                alignItems: 'center', justifyContent: 'center' 
                                            }}>
                                                <Folder size={20} color="#4fc1ff" />
                                            </div>
                                            <div style={{ overflow: 'hidden', flex: 1 }}>
                                                <div style={{ fontWeight: '600', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                                                    {ws.name}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                    <Clock size={10} />
                                                    Last opened: {new Date(ws.last_accessed * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all', opacity: 0.8, fontFamily: 'monospace', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px' }}>
                                            {ws.path}
                                        </div>

                                        {/* Real Git Data Injection */}
                                        {details && details.isRepo && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#e2c08d', fontSize: '12px', fontWeight: '500' }}>
                                                    <GitBranch size={14} />
                                                    {details.branch || 'detached HEAD'}
                                                </div>
                                                {details.changes > 0 ? (
                                                    <div style={{ fontSize: '11px', background: 'rgba(226, 192, 141, 0.1)', color: '#e2c08d', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                                                        {details.changes} pending changes
                                                    </div>
                                                ) : (
                                                    <div style={{ fontSize: '11px', color: '#73c991' }}>Clean working tree</div>
                                                )}
                                            </div>
                                        )}
                                        {details && !details.isRepo && (
                                            <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                Not a git repository
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <div className="sleek-card canvas-item new-workspace" onClick={onNewProject}>
                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                                    <Plus size={24} color="var(--text-secondary)" />
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: '500' }}>Initialize New Environment</span>
                            </div>
                        </div>
                    </div>

                    {/* Agentic Capabilities (Real AI Models) */}
                    <div className="canvas-section">
                        <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-active)', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px' }}>
                            <Cpu size={16} color="#f1c40f" />
                            AGENT CAPABILITIES
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                            The following AI models are currently loaded and available for orchestration in your workspaces.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {aiModels.length > 0 ? aiModels.map((model) => (
                                <div key={model.id} className="sleek-card" style={{ display: 'flex', alignItems: 'center', padding: '12px', gap: '12px', background: 'var(--bg-primary)' }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#73c991', boxShadow: '0 0 8px #73c991' }}></div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{model.name}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Ready for deployment</div>
                                    </div>
                                    <Hash size={14} color="var(--text-secondary)" />
                                </div>
                            )) : (
                                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', fontStyle: 'italic', background: 'var(--bg-primary)', borderRadius: '8px' }}>
                                    No models configured. Check settings.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* System Terminal Access */}
                    <div className="canvas-section">
                        <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-active)', fontWeight: 'bold', fontSize: '12px', letterSpacing: '1px' }}>
                            <Terminal size={16} color="#c586c0" />
                            SYSTEM RUNTIME
                        </div>
                        <div className="sleek-card" style={{ background: '#1e1e1e', padding: '16px', fontFamily: 'monospace', height: '180px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ color: '#73c991', fontSize: '12px', marginBottom: '8px' }}>$ terminate-core --status</div>
                            <div style={{ color: '#d4d4d4', fontSize: '12px', lineHeight: '1.6', flex: 1, overflow: 'hidden' }}>
                                [OK] Pytron bridge active.<br/>
                                [OK] File watcher observing {workspaceList.length} paths.<br/>
                                [OK] Memory manager initialized.<br/>
                                {loading ? (
                                    <span className="animate-pulse" style={{ color: '#f1c40f' }}>&gt; Syncing background telemetry...</span>
                                ) : (
                                    <span style={{ color: '#4fc1ff' }}>&gt; Awaiting orchestrator commands.</span>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <style>{`
                .canvas-section {
                    background: var(--bg-tertiary);
                    padding: 24px;
                    border-radius: var(--radius-lg);
                    border: 1px solid var(--border-subtle);
                }
                .canvas-item {
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .canvas-item:hover {
                    border-color: var(--accent-color);
                    transform: translateY(-4px);
                    box-shadow: 0 8px 24px rgba(0,0,0,0.25);
                }
                .new-workspace {
                    border: 2px dashed var(--border-subtle);
                    background: transparent !important;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 180px;
                    color: var(--text-secondary);
                    cursor: pointer;
                }
                .new-workspace:hover {
                    border-color: var(--accent-color);
                    color: var(--text-primary);
                    background: rgba(79, 193, 255, 0.02) !important;
                }
                .animate-pulse {
                    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
};

export default WorkspaceCanvas;
