import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MarkdownPreview = ({ content }) => {
    return (
        <div style={{
            padding: '20px',
            color: '#ccc',
            overflowY: 'auto',
            height: '100%',
            background: '#1e1e1e',
            fontFamily: 'sans-serif',
            lineHeight: '1.6'
        }} className="markdown-preview">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
            </ReactMarkdown>
            <style>{`
        .markdown-preview h1, .markdown-preview h2, .markdown-preview h3 { color: #fff; border-bottom: 1px solid #333; padding-bottom: 0.3em; }
        .markdown-preview a { color: #4fc1ff; }
        .markdown-preview code { background: #333; padding: 2px 4px; borderRadius: 3px; font-family: monospace; }
        .markdown-preview pre { background: #2d2d2d; padding: 10px; borderRadius: 5px; overflow-x: auto; }
        .markdown-preview pre code { background: transparent; padding: 0; }
        .markdown-preview table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
        .markdown-preview th, .markdown-preview td { border: 1px solid #444; padding: 6px 13px; }
        .markdown-preview th { background: #2d2d2d; }
        .markdown-preview blockquote { border-left: 4px solid #444; padding-left: 1em; color: #888; margin-left: 0; }
        .markdown-preview ul, .markdown-preview ol { padding-left: 2em; }
      `}</style>
        </div>
    );
};

export default MarkdownPreview;
