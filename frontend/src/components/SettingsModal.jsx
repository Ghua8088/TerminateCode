import React, { useState, useEffect } from 'react';
import { PytronModal, PytronButton, PytronSwitch, PytronSelect, PytronInput, useToast, useTheme } from 'pytron-ui/react';
import pytron from 'pytron-client';
import { ShieldCheck, ShieldAlert, Key, Sparkles, Bot, BrainCircuit } from 'lucide-react';

const ProviderKeySection = ({ provider, title, icon, color, status, onSave, onClear, children }) => {
    const [apiKey, setApiKey] = useState('');
    const theme = useTheme();

    return (
        <div style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                {icon}
                <span style={{ fontSize: '14px', fontWeight: 600 }}>{title}</span>
            </div>

            {children && <div style={{ marginBottom: '12px' }}>{children}</div>}

            {status.present ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4caf50' }}>
                        <ShieldCheck size={16} />
                        <span style={{ fontSize: '13px' }}>Configured ({status.masked})</span>
                    </div>
                    <PytronButton onClick={() => onClear(provider)} variant="secondary" style={{ padding: '2px 8px', fontSize: '11px' }}>
                        Remove
                    </PytronButton>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                            <PytronInput
                                placeholder={`Enter ${title} API Key...`}
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                style={{ marginBottom: 0 }}
                                onKeyDown={(e) => e.key === 'Enter' && onSave(provider, apiKey)}
                            />
                        </div>
                        <PytronButton onClick={() => { onSave(provider, apiKey); setApiKey(''); }} variant="primary" style={{ padding: '0 12px' }}>
                            Save
                        </PytronButton>
                    </div>
                </div>
            )}
        </div>
    );
};

const SettingsModal = ({ onClose, settings, onUpdateSettings, currentTheme, onThemeChange }) => {
    const [allStatus, setAllStatus] = useState({});
    const { addToast } = useToast();

    const fetchAllStatus = async () => {
        try {
            const res = await pytron.get_all_api_key_status();
            if (res.success) setAllStatus(res.status);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchAllStatus();
    }, []);

    const handleSaveKey = async (provider, key) => {
        if (!key.trim()) return;
        try {
            const res = await pytron.set_api_key(key, provider);
            if (res.success) {
                addToast(`${provider.toUpperCase()} key saved!`, { type: 'success' });
                fetchAllStatus();
            }
        } catch (e) { addToast(`Error: ${e}`, { type: 'error' }); }
    };

    const handleClearKey = async (provider) => {
        try {
            const res = await pytron.clear_api_key(provider);
            if (res.success) {
                addToast(`${provider.toUpperCase()} key cleared`, { type: 'info' });
                fetchAllStatus();
            }
        } catch (e) { console.error(e); }
    };

    const handleSaveCustomConfig = async () => {
        try {
            await pytron.set_custom_ai_config(settings.customEndpoint);
            addToast('Custom provider config updated', { type: 'success' });
        } catch (e) { addToast('Error updating custom provider', { type: 'error' }); }
    };

    return (
        <PytronModal
            isOpen={true}
            onClose={onClose}
            title="IDE Settings"
            width="500px"
            footer={
                <PytronButton onClick={onClose} variant="primary" style={{ minWidth: '80px' }}>
                    Done
                </PytronButton>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h3 style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '5px' }}>AI Providers</h3>

                <ProviderKeySection
                    provider="google" title="Google Gemini"
                    icon={<Sparkles size={16} color="#4fc1ff" />}
                    status={allStatus.google || {}}
                    onSave={handleSaveKey} onClear={handleClearKey}
                />

                <ProviderKeySection
                    provider="openai" title="OpenAI"
                    icon={<Bot size={16} color="#4caf50" />}
                    status={allStatus.openai || {}}
                    onSave={handleSaveKey} onClear={handleClearKey}
                />

                <ProviderKeySection
                    provider="anthropic" title="Claude (Anthropic)"
                    icon={<BrainCircuit size={16} color="#9b59b6" />}
                    status={allStatus.anthropic || {}}
                    onSave={handleSaveKey} onClear={handleClearKey}
                />

                <ProviderKeySection
                    provider="custom" title="Custom (OpenAI Compatible)"
                    icon={<Key size={16} color="#ff9800" />}
                    status={allStatus.custom || {}}
                    onSave={handleSaveKey} onClear={handleClearKey}
                >
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <div style={{ flex: 1 }}>
                            <PytronInput
                                label="Endpoint URL"
                                placeholder="http://..."
                                value={settings.customEndpoint}
                                onChange={(e) => onUpdateSettings({ ...settings, customEndpoint: e.target.value })}
                                onBlur={handleSaveCustomConfig}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <PytronInput
                                label="Default Model"
                                placeholder="llama3..."
                                value={settings.customModel}
                                onChange={(e) => onUpdateSettings({ ...settings, customModel: e.target.value })}
                            />
                        </div>
                    </div>
                    <div style={{ fontSize: '10px', color: '#666', marginTop: '-10px' }}>
                        Example: Local Ollama (http://localhost:11434/v1) or LiteLLM.
                    </div>
                </ProviderKeySection>

                <h3 style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '10px' }}>Appearance & Editor</h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <PytronInput
                        label="Font Size"
                        type="number"
                        value={settings.fontSize}
                        onChange={(e) => onUpdateSettings({ ...settings, fontSize: parseInt(e.target.value) || 14 })}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 500 }}>UI Theme</label>
                        <PytronSelect
                            options={[
                                { label: 'VS Dark', value: 'vs-dark' },
                                { label: 'Light', value: 'light' },
                                { label: 'High Contrast', value: 'high-contrast' }
                            ]}
                            value={currentTheme}
                            onChange={onThemeChange}
                        />
                    </div>
                </div>

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
            </div>
        </PytronModal>
    );
};

export default SettingsModal;
