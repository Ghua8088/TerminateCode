import React from 'react';
import { Modal, Button, Switch, Select, Input } from 'pytron-ui';

const SettingsModal = ({ onClose, settings, onUpdateSettings, currentTheme, onThemeChange }) => {

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
        <Modal
            isOpen={true} // Controlled by parent rendering
            onClose={onClose}
            title="Settings"
            width="450px"
            footer={
                <Button onClick={onClose} variant="primary" style={{ minWidth: '80px' }}>
                    Close
                </Button>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <Input
                    label="Editor Font Size"
                    type="number"
                    value={settings.fontSize}
                    onChange={(e) => onUpdateSettings({ ...settings, fontSize: parseInt(e.target.value) || 14 })}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>Word Wrap</span>
                    <Switch
                        checked={settings.wordWrap === 'on'}
                        onChange={(checked) => onUpdateSettings({ ...settings, wordWrap: checked ? 'on' : 'off' })}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>Show Minimap</span>
                    <Switch
                        checked={settings.minimap}
                        onChange={(checked) => onUpdateSettings({ ...settings, minimap: checked })}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--pytron-fg, #fff)' }}>UI Theme</label>
                    <Select
                        options={uiThemeOptions}
                        value={currentTheme}
                        onChange={onThemeChange}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--pytron-fg, #fff)' }}>Editor Theme</label>
                    <Select
                        options={themeOptions}
                        value={settings.theme || 'vs-dark'}
                        onChange={(val) => onUpdateSettings({ ...settings, theme: val })}
                    />
                </div>
            </div>
        </Modal>
    );
};

export default SettingsModal;
