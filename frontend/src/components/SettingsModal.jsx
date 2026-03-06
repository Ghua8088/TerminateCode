import React, { useState, useEffect } from 'react';
import { PytronModal, PytronButton, PytronSwitch, PytronSelect, PytronInput } from 'pytron-ui/react';
import pytron from 'pytron-client';
import { ShieldCheck, ShieldAlert, Key } from 'lucide-react';

const SettingsModal = ({ onClose, settings, onUpdateSettings, currentTheme, onThemeChange }) => {
    const [apiKey, setApiKey] = useState('');
    const [keyStatus, setKeyStatus] = useState({ present: false, masked: '' });

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await pytron.get_api_key_status();
                if (res.success) setKeyStatus({ present: res.present, masked: res.masked });
            } catch (e) { console.error(e); }
        };
        fetchStatus();
    }, []);

    const handleSaveKey = async () => {
        if (!apiKey.trim()) return;
        try {
            const res = await pytron.set_api_key(apiKey);
            if (res.success) {
                const status = await pytron.get_api_key_status();
                setKeyStatus({ present: status.present, masked: status.masked });
                setApiKey('');
            }
        } catch (e) { console.error(e); }
    };

    const handleClearKey = async () => {
        try {
            const res = await pytron.clear_api_key();
            if (res.success) setKeyStatus({ present: false, masked: '' });
        } catch (e) { console.error(e); }
    };

    // Theme options for Select
    const themeOptions = [
        { label: 'Dark (VS Code)', value: 'vs-dark' },
        { label: 'Light', value: 'light' }
    ];

    const uiThemeOptions = [
        { label: 'VS Dark', value: 'vs-dark' },
        { label: 'Light', value: 'light' },
        { label: 'High Contrast', value: 'high-contrast' }
    ];

    return (
        <PytronModal
            isOpen={true} // Controlled by parent rendering
            onClose={onClose}
            title="Settings"
            width="450px"
            footer={
                <PytronButton onClick={onClose} variant="primary" style={{ minWidth: '80px' }}>
                    Close
                </PytronButton>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <Key size={16} color="#4fc1ff" />
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>Gemini AI Integration</span>
                    </div>

                    {keyStatus.present ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4caf50' }}>
                                <ShieldCheck size={16} />
                                <span style={{ fontSize: '13px' }}>API Key Configured ({keyStatus.masked})</span>
                            </div>
                            <PytronButton onClick={handleClearKey} variant="secondary" style={{ padding: '2px 8px', fontSize: '11px' }}>
                                Remove
                            </PytronButton>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff9800', marginBottom: '4px' }}>
                                <ShieldAlert size={16} />
                                <span style={{ fontSize: '13px' }}>No API Key Found</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <div style={{ flex: 1 }}>
                                    <PytronInput
                                        placeholder="Enter Gemini API Key..."
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => setApiKey(e.target.value)}
                                        style={{ marginBottom: 0 }}
                                    />
                                </div>
                                <PytronButton onClick={handleSaveKey} variant="primary" style={{ padding: '0 12px' }}>
                                    Save
                                </PytronButton>
                            </div>
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#007fd4', textDecoration: 'none' }}>
                                Get a free key from Google AI Studio
                            </a>
                        </div>
                    )}
                </div>

                <PytronInput
                    label="Editor Font Size"
                    type="number"
                    value={settings.fontSize}
                    onChange={(e) => onUpdateSettings({ ...settings, fontSize: parseInt(e.target.value) || 14 })}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>Word Wrap</span>
                    <PytronSwitch
                        checked={settings.wordWrap === 'on'}
                        onChange={(checked) => onUpdateSettings({ ...settings, wordWrap: checked ? 'on' : 'off' })}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>Show Minimap</span>
                    <PytronSwitch
                        checked={settings.minimap}
                        onChange={(checked) => onUpdateSettings({ ...settings, minimap: checked })}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--pytron-fg, #fff)' }}>UI Theme</label>
                    <PytronSelect
                        options={uiThemeOptions}
                        value={currentTheme}
                        onChange={onThemeChange}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--pytron-fg, #fff)' }}>Editor Theme</label>
                    <PytronSelect
                        options={themeOptions}
                        value={settings.theme || 'vs-dark'}
                        onChange={(val) => onUpdateSettings({ ...settings, theme: val })}
                    />
                </div>

            </div>
        </PytronModal>
    );
};

export default SettingsModal;
