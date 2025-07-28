// app-ui/src/components/Settings.tsx
import React, { useState, useEffect } from 'react';

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SettingsData {
    apiKeys: {
        openai?: string;
        anthropic?: string;
        google?: string;
    };
    aws: {
        accessKeyId?: string;
        secretAccessKey?: string;
        region?: string;
    };
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState<SettingsData>({
        apiKeys: {},
        aws: {}
    });
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    // Load settings from localStorage on mount
    useEffect(() => {
        const savedSettings = localStorage.getItem('appSettings');
        if (savedSettings) {
            try {
                setSettings(JSON.parse(savedSettings));
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        }
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save to localStorage
            localStorage.setItem('appSettings', JSON.stringify(settings));
            setSaveMessage('Settings saved successfully!');
            
            // Clear message after 3 seconds
            setTimeout(() => {
                setSaveMessage(null);
            }, 3000);
        } catch (error) {
            setSaveMessage('Failed to save settings');
            console.error('Save error:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const updateApiKey = (provider: string, value: string) => {
        setSettings(prev => ({
            ...prev,
            apiKeys: {
                ...prev.apiKeys,
                [provider]: value
            }
        }));
    };

    const updateAwsField = (field: string, value: string) => {
        setSettings(prev => ({
            ...prev,
            aws: {
                ...prev.aws,
                [field]: value
            }
        }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0A071B] border border-white/20 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h2 className="text-xl font-semibold text-white flex items-center">
                        <svg className="w-6 h-6 mr-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-white/50 hover:text-white/80 transition-colors p-1"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-8">
                    {/* API Keys Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-white flex items-center">
                            <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3.586l4.293-4.293A6 6 0 0119 9z" />
                            </svg>
                            API Keys
                        </h3>
                        
                        <div className="space-y-4">
                            {/* OpenAI API Key */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-white/90">
                                    OpenAI API Key
                                </label>
                                <input
                                    type="password"
                                    value={settings.apiKeys.openai || ''}
                                    onChange={(e) => updateApiKey('openai', e.target.value)}
                                    placeholder="sk-..."
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                />
                            </div>

                            {/* Anthropic API Key */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-white/90">
                                    Anthropic API Key
                                </label>
                                <input
                                    type="password"
                                    value={settings.apiKeys.anthropic || ''}
                                    onChange={(e) => updateApiKey('anthropic', e.target.value)}
                                    placeholder="sk-ant-..."
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                />
                            </div>

                            {/* Google API Key */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-white/90">
                                    Google API Key
                                </label>
                                <input
                                    type="password"
                                    value={settings.apiKeys.google || ''}
                                    onChange={(e) => updateApiKey('google', e.target.value)}
                                    placeholder="AIza..."
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                />
                            </div>
                        </div>
                    </div>

                    {/* AWS Account Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-medium text-white flex items-center">
                            <svg className="w-5 h-5 mr-2 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            AWS Account
                        </h3>
                        
                        <div className="space-y-4">
                            {/* AWS Access Key ID */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-white/90">
                                    Access Key ID
                                </label>
                                <input
                                    type="text"
                                    value={settings.aws.accessKeyId || ''}
                                    onChange={(e) => updateAwsField('accessKeyId', e.target.value)}
                                    placeholder="AKIA..."
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                />
                            </div>

                            {/* AWS Secret Access Key */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-white/90">
                                    Secret Access Key
                                </label>
                                <input
                                    type="password"
                                    value={settings.aws.secretAccessKey || ''}
                                    onChange={(e) => updateAwsField('secretAccessKey', e.target.value)}
                                    placeholder="..."
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                />
                            </div>

                            {/* AWS Region */}
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-white/90">
                                    Region
                                </label>
                                <select
                                    value={settings.aws.region || ''}
                                    onChange={(e) => updateAwsField('region', e.target.value)}
                                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                >
                                    <option value="" className="bg-gray-800">Select a region...</option>
                                    <option value="us-east-1" className="bg-gray-800">US East (N. Virginia)</option>
                                    <option value="us-east-2" className="bg-gray-800">US East (Ohio)</option>
                                    <option value="us-west-1" className="bg-gray-800">US West (N. California)</option>
                                    <option value="us-west-2" className="bg-gray-800">US West (Oregon)</option>
                                    <option value="eu-west-1" className="bg-gray-800">Europe (Ireland)</option>
                                    <option value="eu-west-2" className="bg-gray-800">Europe (London)</option>
                                    <option value="eu-central-1" className="bg-gray-800">Europe (Frankfurt)</option>
                                    <option value="ap-southeast-1" className="bg-gray-800">Asia Pacific (Singapore)</option>
                                    <option value="ap-southeast-2" className="bg-gray-800">Asia Pacific (Sydney)</option>
                                    <option value="ap-northeast-1" className="bg-gray-800">Asia Pacific (Tokyo)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Save Message */}
                    {saveMessage && (
                        <div className={`p-4 rounded-xl backdrop-blur-sm ${
                            saveMessage.includes('success') 
                                ? 'bg-green-500/10 border border-green-400/30' 
                                : 'bg-red-500/10 border border-red-400/30'
                        }`}>
                            <p className={`text-sm flex items-center ${
                                saveMessage.includes('success') ? 'text-green-300' : 'text-red-300'
                            }`}>
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {saveMessage.includes('success') ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    )}
                                </svg>
                                {saveMessage}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end space-x-4 p-6 border-t border-white/10">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-medium text-white/70 hover:text-white border border-white/20 rounded-lg hover:bg-white/5 transition-all duration-300"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`
                            px-6 py-2 text-sm font-semibold rounded-lg transition-all duration-300
                            ${isSaving
                                ? 'bg-white/10 text-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white shadow-lg hover:shadow-purple-500/25'
                            }
                        `}
                    >
                        {isSaving ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Saving...
                            </>
                        ) : (
                            'Save Settings'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Settings; 