import React, { useState, useEffect } from 'react';
import pytron from 'pytron-client';
import { LayoutDashboard, File, HardDrive, PieChart, Activity, RefreshCw, Code, Zap, History, User } from 'lucide-react';
import { useTheme } from 'pytron-ui/react';
import './PanelStyles.css';

const ProjectDashboard = ({ projectPath }) => {
    const [stats, setStats] = useState(null);
    const [commits, setCommits] = useState([]);
    const [loading, setLoading] = useState(false);
    const theme = useTheme();

    const fetchStats = async () => {
        if (!projectPath) return;
        setLoading(true);
        try {
            const res = await pytron.get_project_stats(projectPath);
            if (res.success) setStats(res.stats);

            const gitRes = await pytron.get_recent_commits(projectPath);
            if (gitRes.success) setCommits(gitRes.commits);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => {
        fetchStats();
    }, [projectPath]);

    const formatSize = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (!projectPath) return (
        <div style={{ padding: '20px', color: 'var(--text-secondary)', textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Open a folder to see project analytics.
        </div>
    );

    return (
        <div className="panel-container">
            <div className="panel-header">
                <div className="panel-header-title">
                    <LayoutDashboard size={16} color="var(--accent-color)" />
                    <span>PROJECT DASHBOARD</span>
                </div>
                <button
                    onClick={fetchStats}
                    className="sleek-button"
                    title="Refresh Stats"
                >
                    <RefreshCw
                        size={14}
                        className={loading ? 'animate-spin' : ''}
                    />
                </button>
            </div>

            <div className="panel-content" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {stats && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                            <MetricCard icon={<File size={16} color="#4fc1ff" />} label="Total Files" value={stats.total_files} />
                            <MetricCard icon={<Activity size={16} color="#4caf50" />} label="Lines of Code" value={stats.total_loc.toLocaleString()} />
                            <MetricCard icon={<Code size={16} color="#f1c40f" />} label="Classes / Funcs" value={`${stats.class_count} / ${stats.func_count}`} />
                            <MetricCard icon={<Zap size={16} color="#ff9800" />} label="Pending TODOs" value={stats.todo_count} />
                        </div>

                        <div className="sleek-card" style={{ background: 'rgba(79, 193, 255, 0.05)', borderColor: 'rgba(79, 193, 255, 0.2)' }}>
                            <div className="sleek-stat-label" style={{ color: '#4fc1ff', fontWeight: '800' }}>PROJECT SCALE</div>
                            <div className="sleek-stat-value">{formatSize(stats.total_size)}</div>
                        </div>

                        <div>
                            <SectionTitle icon={<PieChart size={14} />} label="LANGUAGE DISTRIBUTION" />
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                                {Object.entries(stats.extensions).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([ext, count]) => (
                                    <div key={ext} style={{
                                        padding: '6px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: '11px', border: '1px solid var(--border-subtle)',
                                        display: 'flex', alignItems: 'center', gap: '8px'
                                    }}>
                                        <span style={{ color: getExtColor(ext), fontWeight: 'bold' }}>{ext}</span>
                                        <span style={{ color: 'var(--text-secondary)' }}>{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <SectionTitle icon={<Activity size={14} />} label="TOP 5 LARGEST FILES" />
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {stats.top_files.slice(0, 5).map((f, i) => (
                                    <div key={i} style={{
                                        padding: '8px 12px', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        fontSize: '11px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)'
                                    }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px', color: 'var(--text-primary)' }}>{f.name}</span>
                                        <span style={{ color: 'var(--text-secondary)' }}>{formatSize(f.size)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <SectionTitle icon={<History size={14} />} label="RECENT ACTIVITY" />
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {commits.length > 0 ? commits.map((c, i) => (
                                    <div key={i} className="sleek-card" style={{ padding: '12px' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-active)', fontWeight: '600', marginBottom: '6px' }}>{c.message}</div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <User size={12} />
                                                <span>{c.author}</span>
                                            </div>
                                            <span>{c.date}</span>
                                        </div>
                                    </div>
                                )) : (
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>
                                        No recent git history found.
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

const MetricCard = ({ icon, label, value }) => (
    <div className="sleek-card">
        <div style={{ color: 'var(--text-secondary)', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {icon}
            {label}
        </div>
        <div style={{ fontSize: '20px', fontWeight: '300', color: 'var(--text-active)' }}>{value}</div>
    </div>
);

const SectionTitle = ({ icon, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
        {icon}
        {label}
    </div>
);

const getExtColor = (ext) => {
    switch (ext) {
        case '.py': return '#3776ab';
        case '.js': return '#f7df1e';
        case '.jsx': return '#61dafb';
        case '.css': return '#264de4';
        case '.html': return '#e34f26';
        case '.json': return '#fbc02d';
        default: return '#888';
    }
}

export default ProjectDashboard;
