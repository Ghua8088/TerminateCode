import React from 'react';

const SettingsModal = ({ onClose, settings, onUpdateSettings }) => {
    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }} onClick={onClose}>
            <div style={{
                width: '400px',
                background: '#252526',
                border: '1px solid #454545',
                borderRadius: '5px',
                padding: '20px',
                color: '#ccc'
            }} onClick={e => e.stopPropagation()}>
                <h2 style={{ marginTop: 0, marginBottom: '20px', fontSize: '18px', color: '#fff' }}>Settings</h2>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px' }}>Editor Font Size</label>
                    <input
                        type="number"
                        value={settings.fontSize}
                        onChange={(e) => onUpdateSettings({ ...settings, fontSize: parseInt(e.target.value) || 14 })}
                        style={{ width: '100%', padding: '8px', background: '#3c3c3c', border: '1px solid #333', color: '#fff', outline: 'none' }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '8px 16px', background: '#0e639c', color: '#fff', border: 'none', borderRadius: '2px', cursor: 'pointer' }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
