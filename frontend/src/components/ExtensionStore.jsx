import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Download, 
  CheckCircle2, 
  Star, 
  Users, 
  ExternalLink, 
  X,
  Package,
  ArrowRight,
  RefreshCw,
  LayoutGrid,
  Zap,
  Box,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useToast, PytronModal, PytronButton, PytronInput } from 'pytron-ui/react';
import pytron from 'pytron-client';

const ExtensionStore = ({ onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [extensions, setExtensions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(null);
  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'installed'
  const { addToast } = useToast();

  // Mocking Open VSX Registry behavior for the demonstration
  // In a real implementation, this would fetch from https://open-vsx.org/api/-/search
  const mockExtensions = [
    {
      id: 'ms-python.python',
      name: 'Python',
      publisher: 'ms-python',
      description: 'IntelliSense (Pyright), Linting, Debugging (debugpy), Code formatting, and more.',
      downloads: '120.4M',
      rating: 4.5,
      version: '2024.2.1',
      icon: 'https://open-vsx.org/api/ms-python/python/2024.2.1/file/Microsoft.VisualStudio.Services.Icons.Default'
    },
    {
      id: 'esbenp.prettier-vscode',
      name: 'Prettier - Code formatter',
      publisher: 'esbenp',
      description: 'VS Code extension to settle all arguments by focusing on code style.',
      downloads: '45.2M',
      rating: 4.8,
      version: '10.1.0',
      icon: 'https://open-vsx.org/api/esbenp/prettier-vscode/10.1.0/file/Microsoft.VisualStudio.Services.Icons.Default'
    },
    {
      id: 'formulahendry.code-runner',
      name: 'Code Runner',
      publisher: 'formulahendry',
      description: 'Run code snippet or code file for multiple languages.',
      downloads: '25.1M',
      rating: 4.6,
      version: '0.12.2',
      icon: 'https://open-vsx.org/api/formulahendry/code-runner/0.12.2/file/Microsoft.VisualStudio.Services.Icons.Default'
    },
    {
      id: 'tabnine.tabnine-vscode',
      name: 'Tabnine AI',
      publisher: 'Tabnine',
      description: 'AI-complete your code. Boost productivity with professional developers deep learning assistant.',
      downloads: '10.8M',
      rating: 4.7,
      version: '3.1.2',
      icon: 'https://open-vsx.org/api/tabnine/tabnine-vscode/3.1.2/file/Microsoft.VisualStudio.Services.Icons.Default'
    }
  ];

  useEffect(() => {
    fetchExtensions();
  }, [searchQuery]);

  const fetchExtensions = async () => {
    setLoading(true);
    // Simulate API delay
    await new Promise(r => setTimeout(r, 600));
    const filtered = mockExtensions.filter(ext => 
      ext.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ext.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setExtensions(filtered);
    setLoading(false);
  };

  const handleInstall = async (extId) => {
    setInstalling(extId);
    try {
      // Logic would go here to call backend to download and extract VSIX
      // For now, we simulate the process
      await new Promise(r => setTimeout(r, 2000));
      addToast(`Extension ${extId} installed successfully!`, { type: 'success' });
    } catch (e) {
      addToast(`Failed to install: ${e.message}`, { type: 'error' });
    } finally {
      setInstalling(null);
    }
  };

  return (
    <PytronModal
      isOpen={true}
      onClose={onClose}
      title="Extension Marketplace"
      width="1000px"
      height="80vh"
      variant="windows"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '11px' }}>
            <ShieldCheck size={14} />
            Powered by Open VSX Registry Protocol
          </div>
          <PytronButton variant="secondary" onClick={onClose}>Close</PytronButton>
        </div>
      }
    >
      <div style={{ display: 'flex', height: '100%', minHeight: '500px' }}>
        {/* Left Sidebar for Navigation */}
        <div style={{ 
          width: '240px', 
          borderRight: '1px solid rgba(255,255,255,0.06)',
          padding: '20px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <NavButton 
            active={activeTab === 'browse'} 
            onClick={() => setActiveTab('browse')}
            icon={<LayoutGrid size={16} />}
            label="Browse Marketplace"
          />
          <NavButton 
            active={activeTab === 'installed'} 
            onClick={() => setActiveTab('installed')}
            icon={<Box size={16} />}
            label="Installed"
            badge="12"
          />
          <div style={{ margin: '15px 0', height: '1px', background: 'rgba(255,255,255,0.06)' }} />
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 700, 
            color: 'rgba(255,255,255,0.3)', 
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            padding: '0 12px 10px'
          }}>
            Categories
          </div>
          {['Programming Languages', 'Themes', 'Linter', 'Debugger', 'Snippets', 'Other'].map(cat => (
            <div key={cat} style={{ 
              padding: '8px 12px', 
              fontSize: '13px', 
              color: 'rgba(255,255,255,0.5)', 
              cursor: 'pointer',
              borderRadius: '6px'
            }} className="cat-hover">
              {cat}
            </div>
          ))}
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.1)' }}>
          {/* Top Search Bar */}
          <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)' }}>
                <Search size={18} />
              </div>
              <input 
                type="text" 
                placeholder="Search extensions in Marketplace..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '12px 12px 12px 42px',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
                className="search-input"
              />
            </div>
          </div>

          {/* Extension List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }}>
            {loading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '15px' }}>
                <RefreshCw size={32} className="spinning" color="rgba(255,255,255,0.2)" />
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Searching Marketplace...</span>
              </div>
            ) : extensions.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '15px', padding: '10px 0' }}>
                {extensions.map(ext => (
                  <ExtensionCard 
                    key={ext.id} 
                    extension={ext} 
                    onInstall={() => handleInstall(ext.id)}
                    isInstalling={installing === ext.id}
                  />
                ))}
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '15px' }}>
                <AlertCircle size={48} color="rgba(255,255,255,0.1)" />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '15px' }}>No extensions found matching your search.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .spinning { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .search-input:focus { border-color: rgba(59, 130, 246, 0.5) !important; background: rgba(59, 130, 246, 0.05) !important; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }
        .ext-card-hover:hover { background: rgba(255,255,255,0.04) !important; transform: translateY(-2px); border-color: rgba(255,255,255,0.1) !important; }
        .cat-hover:hover { background: rgba(255,255,255,0.04); color: #fff !important; }
      `}</style>
    </PytronModal>
  );
};

const NavButton = ({ active, onClick, icon, label, badge }) => (
  <div 
    onClick={onClick}
    style={{
      padding: '10px 14px',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      cursor: 'pointer',
      background: active ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
      color: active ? '#93c5fd' : 'rgba(255,255,255,0.6)',
      transition: 'all 0.2s',
      fontWeight: active ? 600 : 400
    }}
  >
    {icon}
    <span style={{ fontSize: '13.5px', flex: 1 }}>{label}</span>
    {badge && (
      <span style={{ 
        background: 'rgba(255,255,255,0.08)', 
        padding: '2px 8px', 
        borderRadius: '999px', 
        fontSize: '10px',
        color: 'rgba(255,255,255,0.4)'
      }}>
        {badge}
      </span>
    )}
  </div>
);

const ExtensionCard = ({ extension, onInstall, isInstalling }) => {
  const [isInstalled, setIsInstalled] = useState(false);

  const handleInstallClick = (e) => {
    e.stopPropagation();
    onInstall();
    setTimeout(() => setIsInstalled(true), 2100);
  };

  return (
    <div 
      style={{
        padding: '16px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '16px',
        display: 'flex',
        gap: '16px',
        transition: 'all 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'default'
      }}
      className="ext-card-hover"
    >
      <div style={{ width: '48px', height: '48px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, background: '#252526', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img 
          src={extension.icon} 
          alt={extension.name} 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.parentElement.innerHTML = '<div style="color: rgba(255,255,255,0.2)"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg></div>';
          }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {extension.name}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {extension.publisher} <CheckCircle2 size={10} color="#3b82f6" fill="#3b82f6" style={{ color: '#fff' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#f59e0b' }}>
            <Star size={12} fill="#f59e0b" />
            {extension.rating}
          </div>
        </div>
        
        <div style={{ 
          fontSize: '12px', 
          color: 'rgba(255,255,255,0.6)', 
          marginTop: '8px', 
          lineHeight: '1.5',
          display: '-webkit-box',
          WebkitLineClamp: '2',
          WebkitBoxDirection: 'vertical',
          overflow: 'hidden',
          minHeight: '36px'
        }}>
          {extension.description}
        </div>

        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Download size={12} /> {extension.downloads}</div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Package size={12} /> v{extension.version}</div>
          </div>
          
          <button 
            disabled={isInstalling || isInstalled}
            onClick={handleInstallClick}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: 'none',
              background: isInstalled ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
              color: isInstalled ? '#10b981' : '#3b82f6',
              fontSize: '12px',
              fontWeight: 600,
              cursor: (isInstalling || isInstalled) ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
          >
            {isInstalling ? (
              <RefreshCw size={12} className="spinning" />
            ) : isInstalled ? (
              <CheckCircle2 size={12} />
            ) : (
              <Download size={12} />
            )}
            {isInstalling ? 'Installing...' : isInstalled ? 'Installed' : 'Install'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExtensionStore;
