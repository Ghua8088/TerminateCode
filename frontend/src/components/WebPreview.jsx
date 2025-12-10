import React, { useState } from 'react';
import { RefreshCw, ExternalLink, X, Zap, ZapOff } from 'lucide-react';
import pytron from 'pytron-client';
import { useToast } from 'pytron-ui';

const WebPreview = ({ onClose }) => {
    const [url, setUrl] = useState('http://localhost:5173'); // Default to Vite port
    const [inputUrl, setInputUrl] = useState('http://localhost:5173');
    const [key, setKey] = useState(0); // To force refresh iframe
    const [isServerRunning, setIsServerRunning] = useState(false);
    const { addToast } = useToast();

    const handleGo = (e) => {
        e.preventDefault();
        let target = inputUrl;
        if (!target.startsWith('http')) {
            target = 'http://' + target;
        }
        setUrl(target);
    };

    const handleRefresh = () => {
        setKey(k => k + 1);
    };

    const toggleServer = async () => {
        if (isServerRunning) {
            try {
                await pytron.stop_static_server();
                setIsServerRunning(false);
            } catch (e) {
                console.error(e);
            }
        } else {
            try {
                const res = await pytron.start_static_server('.');
                if (res.success) {
                    setUrl(res.url);
                    setInputUrl(res.url);
                    setIsServerRunning(true);
                } else {
                    addToast('Failed to start server: ' + res.error, { type: 'error' });
                }
            } catch (e) {
                addToast('Error: ' + e, { type: 'error' });
            }
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', borderLeft: '1px solid #333' }}>
            {/* Address Bar */}
            <div style={{
                padding: '8px',
                background: '#252526',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                borderBottom: '1px solid #333'
            }}>
                <div onClick={toggleServer} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title={isServerRunning ? "Stop Live Server" : "Go Live"}>
                    {isServerRunning ? <ZapOff size={16} color="#ff6b6b" /> : <Zap size={16} color="#4caf50" />}
                </div>
                <form onSubmit={handleGo} style={{ flex: 1, display: 'flex' }}>
                    <input
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        style={{
                            flex: 1,
                            background: '#3c3c3c',
                            border: '1px solid #333',
                            color: '#ccc',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            fontSize: '13px',
                            outline: 'none'
                        }}
                    />
                </form>
                <RefreshCw size={14} color="#ccc" style={{ cursor: 'pointer' }} onClick={handleRefresh} title="Refresh" />
                <ExternalLink size={14} color="#ccc" style={{ cursor: 'pointer' }} onClick={() => window.open(url, '_blank')} title="Open in Browser" />
                <X size={16} color="#ccc" style={{ cursor: 'pointer', marginLeft: '4px' }} onClick={onClose} title="Close Preview" />
            </div>

            {/* Iframe */}
            <div style={{ flex: 1, position: 'relative', background: '#fff' }}>
                <iframe
                    key={key}
                    src={url}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title="Web Preview"
                    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                />
            </div>
        </div>
    );
};

export default WebPreview;
