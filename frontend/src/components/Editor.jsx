import React, { useEffect, useState, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import pytron from 'pytron-client';
import { BookOpen, Code } from 'lucide-react';
import MarkdownPreview from './MarkdownPreview';
import { useToast } from 'pytron-ui';

const CodeEditor = ({ activePath, onCursorChange, settings = {} }) => {
  const { fontSize = 14, wordWrap = 'off', minimap = false, theme = 'vs-dark' } = settings;
  const [codeMap, setCodeMap] = useState({});
  const [languageMap, setLanguageMap] = useState({});
  const [isDirtyMap, setIsDirtyMap] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  const editorRef = useRef(null);
  const { addToast } = useToast();

  useEffect(() => {
    const loadContent = async (path) => {
      if (!path) return;
      try {
        const res = await pytron.read_file_content(path);
        if (res.success) {
          setCodeMap((m) => ({ ...m, [path]: res.content }));
          // detect language from ext
          const name = path.split(/[\\/]/).pop();
          const ext = (name || '').split('.').pop();
          const langMap = {
            'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
            'py': 'python', 'html': 'html', 'css': 'css', 'json': 'json', 'md': 'markdown'
          };
          setLanguageMap((m) => ({ ...m, [path]: langMap[ext] || 'plaintext' }));
          setIsDirtyMap((m) => ({ ...m, [path]: false }));
        } else {
          setCodeMap((m) => ({ ...m, [path]: `// Error reading file: ${res.error}` }));
        }
      } catch (err) {
        setCodeMap((m) => ({ ...m, [path]: `// Error: ${err}` }));
      }
    };

    if (activePath && !codeMap[activePath]) {
      loadContent(activePath);
    }
  }, [activePath, codeMap]);

  const handleSave = useCallback(async () => {
    if (!activePath) return;
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
  }, [activePath, codeMap, addToast]);

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

  const code = codeMap[activePath] ?? '// Loading...';
  const language = languageMap[activePath] ?? 'plaintext';
  const isDirty = !!isDirtyMap[activePath];
  const name = activePath.split(/[\\/]/).pop();
  const isMarkdown = language === 'markdown';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{
        height: '35px',
        background: '#1e1e1e',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        fontSize: '13px',
        borderBottom: '1px solid #333',
        flexShrink: 0
      }}>
        <span style={{ color: '#fff' }}>{name}</span>
        {isDirty && <span style={{ marginLeft: '8px', width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }}></span>}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isMarkdown && (
            <div
              onClick={() => setShowPreview(!showPreview)}
              style={{ cursor: 'pointer', color: showPreview ? '#4fc1ff' : '#888', display: 'flex', alignItems: 'center' }}
              title={showPreview ? "Hide Preview" : "Show Preview"}
            >
              {showPreview ? <Code size={14} /> : <BookOpen size={14} />}
            </div>
          )}
          <div style={{ color: '#888', fontSize: '12px' }}>{language}</div>
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
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
