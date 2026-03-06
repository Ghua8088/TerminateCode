import React, { useEffect, useState, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import pytron from 'pytron-client';
import { BookOpen, Code, ChevronRight } from 'lucide-react';
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
  const editorRef = useRef(null);
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
            // detect language from ext
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

  // Keyboard shortcut for save
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
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555' }}>
        Select a file to start editing
      </div>
    );
  }

  if (isDiff) {
    return <GitDiffViewer path={activePath} settings={settings} />;
  }

  const code = codeMap[activePath] ?? '// Loading...';
  const language = languageMap[activePath] ?? 'plaintext';
  const isDirty = !!isDirtyMap[activePath];
  const isMarkdown = language === 'markdown';

  // Breadcrumbs logic
  const pathParts = activePath ? activePath.split(/[\\/]/) : [];
  const breadcrumbs = pathParts.length > 3 ? ['...', ...pathParts.slice(-3)] : pathParts;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: '#1e1e1e' }}>
      <div style={{
        height: '35px',
        background: '#1a1a1a',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        fontSize: '12px',
        borderBottom: '1px solid #282828',
        flexShrink: 0,
        userSelect: 'none'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', color: '#888', flex: 1, overflow: 'hidden' }}>
          {breadcrumbs.map((part, i) => (
            <React.Fragment key={i}>
              <span style={{
                color: i === breadcrumbs.length - 1 ? '#ccc' : '#666',
                fontWeight: i === breadcrumbs.length - 1 ? '600' : '400',
                whiteSpace: 'nowrap'
              }}>{part}</span>
              {i < breadcrumbs.length - 1 && <ChevronRight size={12} style={{ margin: '0 4px', opacity: 0.5 }} />}
            </React.Fragment>
          ))}
          {isDirty && <div style={{ marginLeft: '10px', width: '6px', height: '6px', borderRadius: '50%', background: '#4fc1ff' }}></div>}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '15px' }}>
          {isMarkdown && (
            <div
              onClick={() => setShowPreview(!showPreview)}
              style={{ cursor: 'pointer', color: showPreview ? '#4fc1ff' : '#888', display: 'flex', alignItems: 'center' }}
              title={showPreview ? "Hide Preview" : "Show Preview"}
            >
              {showPreview ? <Code size={14} /> : <BookOpen size={14} />}
            </div>
          )}
          <div style={{ color: '#555', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase' }}>{language}</div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0, display: language === 'image' ? 'none' : 'flex' }}>
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
      </div>
    </div>
  );
};

export default CodeEditor;
