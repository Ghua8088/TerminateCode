import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Home, FileCode, Folder } from 'lucide-react';
import pytron from 'pytron-client';
import { useTheme } from 'pytron-ui/react';

const BreadcrumbItem = ({ name, path, isFile, isRoot, onFileOpen }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [rect, setRect] = useState(null);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                // If the click is inside the portal dropdown, we let the internal onClick handle it
                // We'll add a class 'breadcrumb-dropdown' to recognize it
                if (!e.target.closest('.breadcrumb-dropdown')) {
                    setIsOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleClick = async () => {
        if (isFile) return;
        if (!isOpen) {
            try {
                if (containerRef.current) {
                    setRect(containerRef.current.getBoundingClientRect());
                }
                const res = await pytron.list_dir(path);
                if (res.success) setItems(res.items);
            } catch (e) {}
        }
        setIsOpen(!isOpen);
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '4px', cursor: isFile ? 'default' : 'pointer' }} onClick={handleClick}>
            {isRoot ? <Home size={12} style={{ marginRight: '2px' }} /> : (isFile ? <FileCode size={11} color="#4fc1ff" /> : <Folder size={11} color="#dcb67a" />)}
            <span style={{
                color: isFile ? '#ccc' : '#888',
                fontWeight: isFile ? '500' : '400'
            }} onMouseEnter={e => !isFile && (e.target.style.color = '#ccc')} onMouseLeave={e => !isFile && (e.target.style.color = '#888')}>{name}</span>
            {isOpen && !isFile && rect && createPortal(
                <div className="breadcrumb-dropdown" style={{
                    position: 'fixed',
                    top: rect.bottom + 6,
                    left: rect.left,
                    background: 'rgba(18, 18, 22, 0.92)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.55)',
                    zIndex: 9999,
                    padding: '6px 0',
                    borderRadius: 'var(--radius-md)',
                    minWidth: '220px',
                    maxHeight: '300px',
                    overflowY: 'auto'
                }}>
                    {items.map((item, idx) => (
                        <div key={idx} style={{
                            padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#d4d4d8',
                            transition: 'all 0.12s ease'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                            e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = '#d4d4d8';
                        }}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!item.is_dir && onFileOpen) {
                                onFileOpen(item);
                            }
                            setIsOpen(false);
                        }}>
                            {item.is_dir ? <Folder size={12} color="#dcb67a" /> : <FileCode size={12} color="#60a5fa" />}
                            <span style={{ flex: 1, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{item.name}</span>
                        </div>
                    ))}
                    {items.length === 0 && <div style={{ padding: '8px 14px', color: '#71717a', fontStyle: 'italic', fontSize: '12px' }}>Empty folder</div>}
                </div>,
                document.body
            )}
        </div>
    );
};

const Breadcrumbs = ({ path, projectPath, onFileOpen }) => {
    const theme = useTheme();

    if (!path) return null;

    // Normalize and split path
    const fullPath = path.startsWith(projectPath) ? path : path;
    const relativePath = projectPath ? path.replace(projectPath, '').replace(/^[\\\/]/, '') : path;
    const parts = relativePath.split(/[\\\/]/).filter(Boolean);
    const fileName = parts.pop();

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 12px',
            background: theme.bg,
            borderBottom: `1px solid ${theme.border}`,
            fontSize: '11px',
            color: '#888',
            gap: '4px',
            overflowX: 'auto',
            whiteSpace: 'nowrap'
        }}>
            {projectPath && (
                <>
                    <BreadcrumbItem 
                        name={projectPath.split(/[\\\/]/).pop()} 
                        path={projectPath} 
                        isFile={false} 
                        isRoot={true}
                        onFileOpen={onFileOpen} 
                    />
                    <ChevronRight size={10} />
                </>
            )}

            {parts.map((part, idx) => {
                const pPath = projectPath + '/' + parts.slice(0, idx + 1).join('/');
                return (
                    <React.Fragment key={idx}>
                        <BreadcrumbItem 
                            name={part} 
                            path={pPath} 
                            isFile={false} 
                            isRoot={false}
                            onFileOpen={onFileOpen} 
                        />
                        <ChevronRight size={10} />
                    </React.Fragment>
                );
            })}

            <BreadcrumbItem 
                name={fileName} 
                path={fullPath} 
                isFile={true} 
                isRoot={false}
                onFileOpen={onFileOpen} 
            />
        </div>
    );
};

export default Breadcrumbs;
