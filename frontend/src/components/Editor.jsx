import React, { useEffect, useState, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import pytron from 'pytron-client';
import { BookOpen, Code, ChevronRight, GitCompare } from 'lucide-react';
import MarkdownPreview from './MarkdownPreview';
import ImageViewer from './ImageViewer';
import { useToast } from 'pytron-ui/react';
import GitDiffViewer from './GitDiffViewer';

const CodeEditor = ({ activeFile, onCursorChange, settings = {} }) => {
  const isDiff = activeFile?.type === 'diff' || activeFile?.path?.startsWith('diff:');
  const activePath = isDiff ? activeFile.path.substring(5) : activeFile?.path;

  const { fontSize = 14, wordWrap = 'off', minimap = false, theme = 'vs-dark' } = settings;
  const [codeMap, setCodeMap] = useState({});
  const [binaryDataMap, setBinaryDataMap] = useState({}); // Stores base64
  const [languageMap, setLanguageMap] = useState({});
  const [isDirtyMap, setIsDirtyMap] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  const [diffPathToRender, setDiffPathToRender] = useState(isDiff ? activePath : null);
  const editorRef = useRef(null);

  useEffect(() => {
    if (isDiff) {
      setDiffPathToRender(activePath);
    }
  }, [isDiff, activePath]);
  const { addToast } = useToast();

  useEffect(() => {
    if (isDiff) return; // Don't try to load content for diff special tabs
    const loadContent = async (path) => {
      if (!path) return;
      try {
        const name = path.split(/[\\/]/).pop();
        const ext = (name || '').split('.').pop().toLowerCase();
        const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'ico', 'webp'].includes(ext);

        if (isImage) {
           const res = await pytron.read_file_base64(path);
           if (res.success) {
             setBinaryDataMap(m => ({ ...m, [path]: res.content }));
             setLanguageMap(m => ({ ...m, [path]: 'image' }));
           }
        } else {
           const res = await pytron.read_file_content(path);
           if (res.success) {
             setCodeMap((m) => ({ ...m, [path]: res.content }));
             const langMap = {
               'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
               'py': 'python', 'html': 'html', 'css': 'css', 'json': 'json', 'md': 'markdown'
             };
             setLanguageMap((m) => ({ ...m, [path]: langMap[ext] || 'plaintext' }));
             setIsDirtyMap((m) => ({ ...m, [path]: false }));
           } else {
             setCodeMap((m) => ({ ...m, [path]: `// Error reading file: ${res.error}` }));
           }
        }
      } catch (err) {
        setCodeMap((m) => ({ ...m, [path]: `// Error: ${err}` }));
      }
    };

    if (activePath && !codeMap[activePath] && !binaryDataMap[activePath]) {
      loadContent(activePath);
    }
  }, [activePath, codeMap, isDiff]);

  const handleSave = useCallback(async () => {
    if (!activePath || isDiff) return;
    const content = codeMap[activePath] || '';
    try {
      const res = await pytron.save_file_content(activePath, content);
      if (res.success) {
        setIsDirtyMap((m) => ({ ...m, [activePath]: false }));
        addToast('Saved!', { type: 'success' });
      } else {
        addToast('Failed to save: ' + res.error, { type: 'error' });
      }
    } catch (err) {
      addToast('Error: ' + err, { type: 'error' });
    }
  }, [activePath, codeMap, addToast, isDiff]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const onEditorMount = (editor) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((evt) => {
      const pos = evt.position;
      if (onCursorChange) onCursorChange({ line: pos.lineNumber, column: pos.column });
    });
  };

  if (!activePath) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', background: '#1e1e1e' }}>
        Select a file to start editing
      </div>
    );
  }

  const code = codeMap[activePath] ?? '// Loading...';
  const language = languageMap[activePath] ?? 'plaintext';
  const isDirty = !!isDirtyMap[activePath];
  const isMarkdown = language === 'markdown';

  const pathParts = activePath ? activePath.split(/[\\/]/) : [];
  const fileName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : '';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#1e1e1e', position: 'relative' }}>
      {isMarkdown && !isDiff && (
        <div
          onClick={() => setShowPreview(!showPreview)}
          style={{ 
            position: 'absolute', 
            top: '12px', 
            right: '25px', 
            zIndex: 10, 
            cursor: 'pointer', 
            background: 'var(--surface)', 
            padding: '6px', 
            borderRadius: '6px', 
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
            color: showPreview ? '#4fc1ff' : '#888', 
            display: 'flex', 
            alignItems: 'center' 
          }}
          title={showPreview ? "Hide Preview" : "Show Preview"}
        >
          {showPreview ? <Code size={14} /> : <BookOpen size={14} />}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
        
        {/* NORMAL EDITOR */}
        <div style={{
          position: 'absolute',
          inset: 0,
          opacity: (isDiff || language === 'image') ? 0 : 1,
          pointerEvents: (isDiff || language === 'image') ? 'none' : 'auto',
          zIndex: (isDiff || language === 'image') ? -1 : 1,
          display: 'flex'
        }}>
          <Editor
            height="100%"
            defaultLanguage={language}
            language={language}
            value={code}
            theme={theme}
            onMount={onEditorMount}
            onChange={(value) => {
              setCodeMap((m) => ({ ...m, [activePath]: value }));
              setIsDirtyMap((m) => ({ ...m, [activePath]: true }));
            }}
            options={{
              minimap: { enabled: minimap },
              fontSize: fontSize,
              wordWrap: wordWrap,
              scrollBeyondLastLine: false,
              automaticLayout: true
            }}
          />
        </div>

        {language === 'image' && binaryDataMap[activePath] && (
          <ImageViewer path={activePath} data={binaryDataMap[activePath]} />
        )}

        {isMarkdown && showPreview && (
          <div style={{ flex: 1, borderLeft: '1px solid #333', minWidth: 0 }}>
            <MarkdownPreview content={code} />
          </div>
        )}

        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          opacity: isDiff ? 1 : 0,
          pointerEvents: isDiff ? 'auto' : 'none'
        }}>
          {diffPathToRender && <GitDiffViewer path={diffPathToRender} settings={settings} />}
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;
