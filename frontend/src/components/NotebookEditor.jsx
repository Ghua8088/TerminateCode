import React, { useState, useEffect, useRef } from 'react';
import pytron from 'pytron-client';
import { useTheme, useToast } from 'pytron-ui/react';
import { Play, Save, FileCode, Edit3, Eye, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import Editor from '@monaco-editor/react';
import nb from '../lib/notebook-browser';
import { marked } from 'marked';
import { AnsiUp } from 'ansi_up';
import DOMPurify from 'dompurify';

// Configure notebookjs
nb.markdown = (text) => marked(text);
const ansiUp = new AnsiUp();
nb.ansi = (text) => ansiUp.ansi_to_html(text);
nb.sanitizer = (html) => DOMPurify.sanitize(html);

const NotebookEditor = ({ path, onClose }) => {
    const { addToast } = useToast();
    const [notebookJson, setNotebookJson] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeCellIdx, setActiveCellIdx] = useState(0);
    const theme = useTheme();

    useEffect(() => {
        const handleOutput = (e) => {
            const data = e.detail || e;
            
            if (!data || typeof data.cell_id === 'undefined') return;
            
            // Normalize paths for comparison (Windows case-insensitivity + slash differences)
            const normalize = (p) => p ? p.toLowerCase().replace(/\\/g, '/') : '';
            const eventPath = normalize(data.path);
            const currentPath = normalize(path);

            console.log(`DEBUG: notebook:output event for ${eventPath}. Current editor: ${currentPath}`);
            
            // Debug Toast
            window.dispatchEvent(new CustomEvent('toast', { 
                detail: { message: `Event for ${eventPath || 'unknown'}`, type: 'info' } 
            }));

            // RELAXED: Handle events even if path is ambiguous
            if (eventPath && currentPath && eventPath !== currentPath) {
                console.log('DEBUG: Path mismatch detected');
                // return; 
            }
            
            console.log('DEBUG: Processing output for this editor instance');

            setNotebookJson(prev => {
                if (!prev) return prev;
                const nextCells = [...prev.cells];
                const cellIndex = parseInt(data.cell_id);
                
                if (isNaN(cellIndex) || !nextCells[cellIndex]) {
                    console.warn(`DEBUG: Cell ${data.cell_id} not found`);
                    return prev;
                }

                const cell = { ...nextCells[cellIndex] };
                const nextOutputs = Array.isArray(cell.outputs) ? [...cell.outputs] : [];
                
                if (data.type === 'image/png') {
                    nextOutputs.push({
                        output_type: "display_data",
                        data: { "image/png": data.data },
                        metadata: {}
                    });
                } else if (data.stream) {
                    const last = nextOutputs[nextOutputs.length - 1];
                    if (last && last.output_type === 'stream' && last.name === data.stream) {
                        const updatedLast = { ...last };
                        if (Array.isArray(updatedLast.text)) updatedLast.text = [...updatedLast.text, data.text];
                        else updatedLast.text += data.text;
                        nextOutputs[nextOutputs.length - 1] = updatedLast;
                    } else {
                        nextOutputs.push({
                            output_type: "stream",
                            name: data.stream,
                            text: [data.text]
                        });
                    }
                }
                cell.outputs = nextOutputs;
                nextCells[cellIndex] = cell;
                return { ...prev, cells: nextCells };
            });
        };

        const handleClear = (e) => {
            const data = e.detail || e;
            const { cell_id, path: eventPath } = data;
            
            const normalize = (p) => p ? p.toLowerCase().replace(/\\/g, '/') : '';
            if (eventPath && normalize(eventPath) !== normalize(path)) return;
            
            console.log('DEBUG: Received notebook:clear:', cell_id);
            setNotebookJson(prev => {
                if (!prev) return prev;
                const nextCells = [...prev.cells];
                const idx = parseInt(cell_id);
                if (nextCells[idx]) {
                    nextCells[idx] = { ...nextCells[idx], outputs: [] };
                }
                return { ...prev, cells: nextCells };
            });
        };

        pytron.on('notebook:output', handleOutput);
        pytron.on('notebook:clear', handleClear);
        window.addEventListener('notebook:output', handleOutput);
        window.addEventListener('notebook:clear', handleClear);

        return () => {
            window.removeEventListener('notebook:output', handleOutput);
            window.removeEventListener('notebook:clear', handleClear);
        };
    }, [path]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const res = await pytron.read_file_content(path);
                if (res.success) {
                    const content = res.content.trim();
                    if (!content) {
                        setNotebookJson({
                            cells: [{ cell_type: 'code', source: [], execution_count: null, outputs: [], metadata: {} }],
                            metadata: {},
                            nbformat: 4,
                            nbformat_minor: 5
                        });
                    } else {
                        setNotebookJson(JSON.parse(content));
                    }
                } else {
                    setError(res.error);
                }
            } catch (err) {
                setError(err.toString());
            }
            setLoading(false);
        };
        load();
    }, [path]);

    const handleSave = async () => {
        if (!notebookJson) return;
        try {
            // Ensure notebook output/source strings are handled reasonably
            // Some Jupyter versions prefer arrays, but single strings are usually fine.
            // We'll keep the current structure but ensure root metadata exists.
            const saveObj = {
                ...notebookJson,
                metadata: notebookJson.metadata || {
                    kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
                    language_info: { name: "python", version: "3" }
                }
            };

            const res = await pytron.save_file_content(path, JSON.stringify(saveObj, null, 1));
            if (res.success) {
                addToast('Notebook saved successfully', { type: 'success' });
            } else {
                addToast('Save failed: ' + res.error, { type: 'error' });
            }
        } catch (err) {
            console.error(err);
            addToast('Error saving notebook', { type: 'error' });
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [notebookJson, path]);

    const updateCellSource = (idx, newSource, outputs = null, completed = false) => {
        console.log(`DEBUG: updateCellSource called for ${idx}, completed: ${completed}`);
        setNotebookJson(prev => {
            if (!prev) return prev;
            const nextCells = [...prev.cells];
            const cell = { ...nextCells[idx] };
            
            const lines = newSource.split('\n');
            cell.source = lines.map((l, i) => i === lines.length - 1 ? l : l + '\n');
            
            if (Array.isArray(outputs)) {
                cell.outputs = [...outputs];
            }
            if (completed) {
                cell.execution_count = (cell.execution_count || 0) + 1;
                console.log(`DEBUG: Incremented execution_count to ${cell.execution_count}`);
            }
            
            nextCells[idx] = cell;
            return { ...prev, cells: nextCells };
        });
    };

    const addCell = (type, atIdx) => {
        const newJson = { ...notebookJson };
        const newCell = {
            cell_type: type,
            source: [],
            metadata: {},
            ...(type === 'code' ? { execution_count: null, outputs: [] } : {})
        };
        newJson.cells.splice(atIdx + 1, 0, newCell);
        setNotebookJson(newJson);
        setActiveCellIdx(atIdx + 1);
    };

    const deleteCell = (idx) => {
        const newJson = { ...notebookJson };
        newJson.cells.splice(idx, 1);
        if (newJson.cells.length === 0) {
            newJson.cells.push({ cell_type: 'code', source: [], execution_count: null, outputs: [], metadata: {} });
        }
        setNotebookJson(newJson);
        setActiveCellIdx(Math.max(0, idx - 1));
    };

    const moveCell = (idx, dir) => {
        if (idx + dir < 0 || idx + dir >= notebookJson.cells.length) return;
        const newJson = { ...notebookJson };
        const temp = newJson.cells[idx];
        newJson.cells[idx] = newJson.cells[idx + dir];
        newJson.cells[idx + dir] = temp;
        setNotebookJson(newJson);
        setActiveCellIdx(idx + dir);
    }

    if (loading) return <div style={{ padding: '20px', color: theme.fg }}>Loading Notebook...</div>;
    if (error) return <div style={{ padding: '20px', color: '#ff6b6b' }}>Error: {error}</div>;
    if (!notebookJson) return null;

    return (
        <div style={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            background: theme.bg,
            color: theme.fg,
            overflow: 'hidden',
            fontFamily: 'Inter, sans-serif'
        }}>
            {/* Header / Toolbar */}
            <div style={{ 
                height: '42px', 
                background: theme.surface, 
                display: 'flex', 
                alignItems: 'center', 
                padding: '0 16px', 
                gap: '20px',
                borderBottom: `1px solid ${theme.border}`,
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                zIndex: 10
            }}>
                <div style={{ fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileCode size={16} color="#4fc1ff" />
                    <span style={{ opacity: 0.9 }}>{path.split(/[\\/]/).pop()}</span>
                </div>
                
                <div style={{ height: '20px', width: '1px', background: theme.border }}></div>

                <div style={{ display: 'flex', gap: '6px' }}>
                    <ToolbarButton onClick={handleSave} icon={<Save size={14} />} label="Save" />
                    <ToolbarButton onClick={() => addCell('code', notebookJson.cells.length - 1)} icon={<Play size={14} />} label="Run All" />
                </div>
            </div>

            {/* Notebook Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '40px 20px', scrollBehavior: 'smooth' }}>
                <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    {notebookJson.cells.map((cell, idx) => (
                        <NotebookCell 
                            key={idx} 
                            cell={cell} 
                            index={idx}
                            isActive={activeCellIdx === idx}
                            path={path}
                            onSelect={() => setActiveCellIdx(idx)}
                            onChange={(...args) => updateCellSource(idx, ...args)}
                            onDelete={() => deleteCell(idx)}
                            onAdd={(type) => addCell(type, idx)}
                            onMove={(dir) => moveCell(idx, dir)}
                            theme={theme}
                        />
                    ))}
                    
                    {/* Final Add Cell area */}
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '20px', opacity: 0.3, transition: 'opacity 0.2s' }} className="final-add-cell">
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => addCell('code', notebookJson.cells.length - 1)} style={addButtonStyle}>+ Code</button>
                            <button onClick={() => addCell('markdown', notebookJson.cells.length - 1)} style={addButtonStyle}>+ Markdown</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>{`
                .final-add-cell:hover { opacity: 1; }
                .nb-cell-rendered { font-size: 15px; line-height: 1.6; color: #d4d4d4; }
                .nb-cell-rendered p { margin-top: 0; }
                .nb-cell-rendered pre { background: #131316; padding: 16px; border-radius: 6px; overflow-x: auto; border: 1px solid rgba(255,255,255,0.08); margin: 12px 0; }
                .nb-cell-rendered code { font-family: 'JetBrains Mono', monospace; font-size: 13px; }
                .nb-cell-rendered h1, .nb-cell-rendered h2 { border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 10px; margin-top: 24px; color: #fff; }
                .nb-cell-rendered img { max-width: 100%; border-radius: 4px; margin: 10px 0; }
                
                /* Monaco cell styling */
                .monaco-cell-editor { border-radius: 0 0 6px 6px; overflow: hidden; }
                
                /* Selection highlight */
                .cell-container { border-left: 3px solid transparent; transition: border 0.2s; }
                .cell-container.active { border-left: 3px solid #3b82f6; }
            `}</style>
        </div>
    );
};

const ToolbarButton = ({ onClick, icon, label }) => {
    const theme = useTheme();
    return (
        <button onClick={onClick} style={{
            background: 'transparent',
            border: 'none',
            color: theme.fg,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            opacity: 0.8,
            transition: 'background 0.2s',
            hover: { background: 'rgba(255,255,255,0.05)' }
        }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} 
           onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
            {icon}
            {label}
        </button>
    );
};

const NotebookCell = ({ cell, index, isActive, path, onSelect, onChange, onDelete, onAdd, onMove, theme }) => {
    const renderedRef = useRef(null);
    const [isEditing, setIsEditing] = useState(cell.cell_type === 'code' || !cell.source.length);
    const [executing, setExecuting] = useState(false);

    useEffect(() => {
        if (!isEditing && renderedRef.current) {
            try {
                const parsed = nb.parse({ cells: [cell] });
                const rendered = parsed.render();
                renderedRef.current.innerHTML = '';
                renderedRef.current.appendChild(rendered);
            } catch (e) {
                console.error('Render error:', e);
                renderedRef.current.innerHTML = `<div style="color: #ff6b6b; padding: 10px;">Render Error: ${e.message}</div>`;
            }
        }
    }, [cell, isEditing]);

    const handleRunCell = async () => {
        if (cell.cell_type !== 'code') return;
        setExecuting(true);
        console.log(`DEBUG: handleRunCell started for cell ${index}`);
        try {
            const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source || '';
            const res = await pytron.run_notebook_cell(index, source, path);
            console.log(`DEBUG: run_notebook_cell response:`, res);
            
            if (res.success) {
                onChange(source, null, true);
            }
        } catch (err) {
            console.error('DEBUG: handleRunCell error:', err);
        }
        setExecuting(false);
    };

    const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source || '';
    const lineCount = source.split('\n').length;
    const editorHeight = Math.max(40, Math.min(600, lineCount * 19 + 20));

    // Helper to render outputs directly if not in 'render' mode
    const renderOutputInternal = (output, idx) => {
        if (output.output_type === 'stream') {
            const text = Array.isArray(output.text) ? output.text.join('') : output.text;
            if (!text) return null;
            return <div key={idx} style={{ whiteSpace: 'pre-wrap', color: output.name === 'stderr' ? '#ff6b6b' : '#ccc', lineHeight: '1.5' }}>
                {text}
            </div>;
        }
        if (output.output_type === 'display_data' && output.data && output.data['image/png']) {
            return (
                <div key={idx} style={{ margin: '12px 0', background: 'white', padding: '10px', borderRadius: '4px', display: 'inline-block' }}>
                    <img 
                        src={`data:image/png;base64,${output.data['image/png']}`} 
                        alt="Plot" 
                        style={{ maxWidth: '100%', borderRadius: '2px' }} 
                    />
                </div>
            );
        }
        return null;
    };

    return (
        <div 
            className={`cell-container ${isActive ? 'active' : ''}`}
            onClick={onSelect}
            style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '4px',
                position: 'relative',
                background: isActive ? 'rgba(59, 130, 246, 0.02)' : 'transparent',
                padding: '10px 10px 10px 40px',
                borderRadius: '8px'
            }}
        >
            {/* Cell Index Prompt */}
            <div style={{ 
                position: 'absolute', 
                left: '0px', 
                top: '18px',
                fontSize: '11px',
                color: executing ? '#3b82f6' : '#666',
                width: '35px',
                textAlign: 'right',
                fontFamily: 'monospace',
                userSelect: 'none',
                fontWeight: executing ? 'bold' : 'normal'
            }}>
                {cell.cell_type === 'code' ? `[${executing ? '*' : (cell.execution_count || ' ')}]` : ''}
            </div>

            {/* Cell Wrapper */}
            <div style={{
                background: theme.surface,
                border: `1px solid ${isActive ? '#3b82f6' : theme.border}`,
                borderRadius: '8px',
                boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.2)' : '0 2px 6px rgba(0,0,0,0.1)',
                overflow: 'hidden',
                transition: 'all 0.2s ease'
            }}>
                {/* Cell Header */}
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '6px 12px', 
                    background: 'rgba(255,255,255,0.03)',
                    borderBottom: `1px solid ${theme.border}`,
                    opacity: isActive ? 1 : 0.6
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>
                            {cell.cell_type}
                        </span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {cell.cell_type === 'code' && (
                            <button onClick={handleRunCell} disabled={executing} style={{ ...cellActionStyle, color: '#4ade80' }} title="Run Cell">
                                <Play size={14} fill={executing ? "transparent" : "currentColor"} />
                            </button>
                        )}
                        {cell.cell_type === 'markdown' && (
                            <button onClick={() => setIsEditing(!isEditing)} style={cellActionStyle}>
                                {isEditing ? <Eye size={14} /> : <Edit3 size={14} />}
                            </button>
                        )}
                        <button onClick={() => onMove(-1)} style={cellActionStyle} title="Move Up"><ChevronUp size={14} /></button>
                        <button onClick={() => onMove(1)} style={cellActionStyle} title="Move Down"><ChevronDown size={14} /></button>
                        <button onClick={onDelete} style={{ ...cellActionStyle, color: '#ff6b6b' }} title="Delete Cell"><Trash2 size={14} /></button>
                    </div>
                </div>

                {/* Progress Indicator */}
                {executing && (
                    <div style={{ height: '2px', background: 'rgba(59, 130, 246, 0.1)', width: '100%', overflow: 'hidden', position: 'relative' }}>
                        <div style={{ 
                            height: '100%', 
                            background: '#3b82f6', 
                            width: '40%', 
                            position: 'absolute',
                            boxShadow: '0 0 8px #3b82f6',
                            animation: 'notebook-pulse 1.5s infinite ease-in-out'
                        }} />
                        <style dangerouslySetInnerHTML={{ __html: `
                            @keyframes notebook-pulse {
                                0% { left: -40%; }
                                100% { left: 140%; }
                            }
                        ` }} />
                    </div>
                )}

                {/* Editor / Rendered View */}
                {isEditing ? (
                    <div className="monaco-cell-editor" style={{ height: `${editorHeight}px` }}>
                        <Editor
                            height="100%"
                            language={cell.cell_type === 'code' ? 'python' : 'markdown'}
                            value={source}
                            theme="vs-dark"
                            onChange={(val) => onChange(val)}
                            options={{
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                lineNumbers: 'on',
                                folding: false,
                                glyphMargin: false,
                                cursorStyle: 'line-thin',
                                wordWrap: 'on',
                                scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
                                fontSize: 13,
                                padding: { top: 10, bottom: 10 }
                            }}
                        />
                    </div>
                ) : (
                    <div 
                        ref={renderedRef} 
                        className="nb-cell-rendered" 
                        style={{ padding: '16px 20px' }}
                        onDoubleClick={() => setIsEditing(true)}
                    />
                )}
            </div>
            
            {/* Execution Outputs (for code cells) */}
            {cell.cell_type === 'code' && cell.outputs && cell.outputs.length > 0 && (
                <div className="nb-cell-outputs" style={{ 
                    marginTop: '8px', 
                    padding: '12px 20px', 
                    background: '#131316', 
                    borderRadius: '8px',
                    border: '1px solid #3b82f6', // Bright blue border for visibility during debug
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    color: '#ccc',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    userSelect: 'text',
                    cursor: 'text',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ fontSize: '10px', color: '#3b82f6', marginBottom: '8px', opacity: 0.8, fontWeight: 'bold' }}>CELL OUTPUT</div>
                    {cell.outputs.map((o, i) => renderOutputInternal(o, i))}
                </div>
            )}
        </div>
    );
};

const cellActionStyle = {
    background: 'transparent',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '2px',
    transition: 'color 0.2s'
};

const addButtonStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#aaa',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'all 0.2s'
};

export default NotebookEditor;
