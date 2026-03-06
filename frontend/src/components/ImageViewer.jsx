import React from 'react';

const ImageViewer = ({ path, data }) => {
    const name = path.split(/[\\/]/).pop();
    const ext = name.split('.').pop()?.toLowerCase();

    // Mime type detection
    const mimeMap = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'webp': 'image/webp'
    };

    const mime = mimeMap[ext] || 'image/png';

    return (
        <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1a1a1a',
            overflow: 'auto',
            padding: '40px'
        }}>
            <div style={{
                padding: '20px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
            }}>
                <img
                    src={`data:${mime};base64,${data}`}
                    alt={name}
                    style={{
                        maxWidth: '100%',
                        maxHeight: '70vh',
                        objectFit: 'contain',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                    }}
                />
                <div style={{ marginTop: '20px', color: '#888', fontSize: '13px', fontWeight: 'bold' }}>
                    {name} ({ext.toUpperCase()})
                </div>
            </div>
        </div>
    );
};

export default ImageViewer;
