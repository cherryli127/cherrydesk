import { useState, useEffect } from 'react';
import { ModelProviderConfig, MODEL_PROVIDER_PRESETS, getDefaultModelProviderConfig } from '../../common/modelProvider';

interface SettingsProps {
    onClose: () => void;
}

type TestStatus = 'idle' | 'success' | 'error';

export function Settings({ onClose }: SettingsProps) {
    const [config, setConfig] = useState<ModelProviderConfig>(getDefaultModelProviderConfig());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [testMessage, setTestMessage] = useState<string | null>(null);
    const [testStatus, setTestStatus] = useState<TestStatus>('idle');
    const [lastTestTimestamp, setLastTestTimestamp] = useState<number | null>(null);

    useEffect(() => {
        loadConfig();
        if (window.api?.onModelProviderConfigUpdated) {
            const unsubscribe = window.api.onModelProviderConfigUpdated(updated => {
                console.log('[Settings] Received config update from main process');
                setConfig(updated);
                setTestStatus('idle');
            });
            return () => unsubscribe?.();
        }
    }, []);

    const loadConfig = async () => {
        if (!window.api?.getModelProviderConfig) {
            setIsLoading(false);
            return;
        }
        try {
            const saved = await window.api.getModelProviderConfig();
            console.log('[Settings] Loaded config:', { ...saved, apiKey: saved?.apiKey ? '***' : 'empty' });
            if (saved) {
                setConfig(saved);
            } else {
                console.warn('[Settings] No saved config found, using default');
            }
            setTestStatus('idle');
            setLastTestTimestamp(null);
        } catch (e) {
            console.error('[Settings] Failed to load config:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!window.api?.saveModelProviderConfig) return;
        setIsSaving(true);
        setSaveMessage(null);
        try {
            console.log('[Settings] Saving config:', { ...config, apiKey: config.apiKey ? '***' : 'empty' });
            await window.api.saveModelProviderConfig(config);
            console.log('[Settings] Config saved successfully');
            setSaveMessage('Configuration saved successfully!');
            setTimeout(() => setSaveMessage(null), 3000);
        } catch (e) {
            console.error('[Settings] Failed to save config:', e);
            setSaveMessage(`Failed to save: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestConnection = async () => {
        if (!window.api?.testModelProviderConfig) return;
        if (!config.apiKey || !config.baseURL || !config.defaultModel) {
            setTestMessage('Please fill in API Key, Base URL, and Default Model before testing.');
            setTimeout(() => setTestMessage(null), 3000);
            return;
        }

        setIsTesting(true);
        setTestMessage(null);
        setTestStatus('idle');
        setLastTestTimestamp(null);
        console.log('[Settings] Testing connection with config:', {
            baseURL: config.baseURL,
            model: config.defaultModel,
            hasApiKey: !!config.apiKey
        });
        try {
            const result = await window.api.testModelProviderConfig(config);
            console.log('[Settings] Test result:', result);
            setTestMessage(result.message);
            setTestStatus(result.success ? 'success' : 'error');
            setLastTestTimestamp(Date.now());
            setTimeout(() => setTestMessage(null), 5000);
        } catch (e) {
            console.error('[Settings] Test connection error:', e);
            setTestMessage(`Test failed: ${e instanceof Error ? e.message : String(e)}`);
            setTestStatus('error');
            setTimeout(() => setTestMessage(null), 5000);
        } finally {
            setIsTesting(false);
        }
    };

    const handlePresetSelect = (presetId: string) => {
        const preset = MODEL_PROVIDER_PRESETS[presetId];
        if (preset) {
            setConfig(prev => ({
                ...prev,
                id: preset.id,
                name: preset.name,
                description: preset.description,
                baseURL: preset.baseURL,
                defaultModel: preset.defaultModel,
            }));
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">Loading settings...</div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-xl font-semibold">Model Provider Settings</h2>
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                >
                    Close
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto space-y-6">
                    {/* Preset Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Quick Preset
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            {Object.values(MODEL_PROVIDER_PRESETS).map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => handlePresetSelect(preset.id)}
                                    className={`p-3 text-left border rounded-lg transition-colors ${config.id === preset.id
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className="font-medium text-sm">{preset.name}</div>
                                    <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                        {preset.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Provider Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Provider Name
                        </label>
                        <input
                            type="text"
                            value={config.name}
                            onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Moonshot (Kimi)"
                        />
                    </div>

                    {/* API Key */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            API Key <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="password"
                            value={config.apiKey}
                            onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="sk-..."
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Your API key is stored locally and never shared.
                        </p>
                    </div>

                    {/* Base URL */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Base URL <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={config.baseURL}
                            onChange={(e) => setConfig(prev => ({ ...prev, baseURL: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            placeholder="https://api.moonshot.cn/v1"
                        />
                    </div>

                    {/* Default Model */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Default Model <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={config.defaultModel}
                            onChange={(e) => setConfig(prev => ({ ...prev, defaultModel: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                            placeholder="kimi-k2-0905-preview"
                        />
                    </div>

                    {/* Enabled Toggle */}
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="enabled"
                            checked={config.enabled}
                            onChange={(e) => setConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="enabled" className="ml-2 text-sm text-gray-700">
                            Enable this provider
                        </label>
                    </div>

                    {/* Description */}
                    {config.description && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description
                            </label>
                            <textarea
                                value={config.description}
                                onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Provider description..."
                            />
                        </div>
                    )}

                    {/* Test Connection Button */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleTestConnection}
                                disabled={isTesting || !config.apiKey || !config.baseURL || !config.defaultModel}
                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                            >
                                {isTesting ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Testing...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Test Connection
                                    </>
                                )}
                            </button>
                            {testStatus !== 'idle' && (
                                <div className={`flex items-center gap-1 text-sm font-medium ${testStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                    {testStatus === 'success' ? (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    )}
                                    <span>{testStatus === 'success' ? 'Connected' : 'Failed'}</span>
                                </div>
                            )}
                        </div>
                        {lastTestTimestamp && (
                            <div className="text-xs text-gray-500">
                                Last tested {new Date(lastTestTimestamp).toLocaleTimeString()}
                            </div>
                        )}
                    </div>

                    {/* Test Message */}
                    {testMessage && (
                        <div
                            className={`p-3 rounded-md flex items-center gap-2 ${testStatus === 'success'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-red-50 text-red-700'
                                }`}
                        >
                            {testStatus === 'success' ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            )}
                            <span>{testMessage}</span>
                        </div>
                    )}

                    {/* Save Message */}
                    {saveMessage && (
                        <div
                            className={`p-3 rounded-md ${saveMessage.includes('Failed')
                                ? 'bg-red-50 text-red-700'
                                : 'bg-green-50 text-green-700'
                                }`}
                        >
                            {saveMessage}
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="border-t p-4 flex justify-end gap-3">
                <button
                    onClick={handleSave}
                    disabled={isSaving || !config.apiKey || !config.baseURL || !config.defaultModel}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>
        </div>
    );
}
