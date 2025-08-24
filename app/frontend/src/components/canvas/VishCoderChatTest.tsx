import React, { useState } from 'react';
import VishCoderChat, { ChatMessage } from './VishCoderChat';

const VishCoderChatTest: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [testType, setTestType] = useState<'success' | 'failure' | 'error' | null>(null);

    const runSuccessTest = () => {
        setTestType('success');
        setMessages([]);

        // Manager starts
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '1',
                type: 'manager',
                content: 'Starting feature build process',
                timestamp: new Date(),
                agent: 'Manager',
                llm: 'GPT-5 mini'
            }]);
        }, 500);

        // Developer starts
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '2',
                type: 'developer',
                content: '🚀 Starting feature build process...',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet'
            }]);
        }, 1000);

        // Build updates (grouped)
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '3',
                type: 'developer',
                content: 'Analyzing requirements',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet',
                progress: 25,
                isGrouped: true,
                groupId: 'build-process'
            }]);
        }, 1500);

        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '4',
                type: 'developer',
                content: 'Generating code',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet',
                progress: 50,
                isGrouped: true,
                groupId: 'build-process'
            }]);
        }, 2000);

        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '5',
                type: 'developer',
                content: 'Feature build completed successfully! 🎉',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet',
                progress: 100,
                isGrouped: true,
                groupId: 'build-process'
            }]);
        }, 2500);
    };

    const runFailureTest = () => {
        setTestType('failure');
        setMessages([]);

        // Manager starts
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '1',
                type: 'manager',
                content: 'Starting feature build process',
                timestamp: new Date(),
                agent: 'Manager',
                llm: 'GPT-5 mini'
            }]);
        }, 500);

        // Developer starts
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '2',
                type: 'developer',
                content: '🚀 Starting feature build process...',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet'
            }]);
        }, 1000);

        // Build updates (grouped)
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '3',
                type: 'developer',
                content: 'Analyzing requirements',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet',
                progress: 30,
                isGrouped: true,
                groupId: 'build-process'
            }]);
        }, 1500);

        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '4',
                type: 'developer',
                content: 'Build process failed due to dependency issues',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet',
                progress: 0,
                isGrouped: true,
                groupId: 'build-process'
            }]);
        }, 2000);
    };

    const runErrorTest = () => {
        setTestType('error');
        setMessages([]);

        // Manager starts
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '1',
                type: 'manager',
                content: 'Starting feature build process',
                timestamp: new Date(),
                agent: 'Manager',
                llm: 'GPT-5 mini'
            }]);
        }, 500);

        // Developer starts
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '2',
                type: 'developer',
                content: '🚀 Starting feature build process...',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet'
            }]);
        }, 1000);

        // Build updates (grouped)
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '3',
                type: 'developer',
                content: 'Analyzing requirements',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet',
                progress: 20,
                isGrouped: true,
                groupId: 'build-process'
            }]);
        }, 1500);

        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '4',
                type: 'developer',
                content: '⚠️ Error: Invalid configuration detected',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet',
                progress: 0,
                isGrouped: true,
                groupId: 'build-process'
            }]);
        }, 2000);
    };

    const resetTest = () => {
        setMessages([]);
        setTestType(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        VishCoder Chat - Auto-Expand Test
                    </h1>
                    <p className="text-gray-600">
                        Test the automatic expansion of grouped updates based on build status
                    </p>
                </div>

                {/* Test Controls */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Test Scenarios</h2>
                            <p className="text-sm text-gray-600">
                                Run different tests to see auto-expand behavior
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={runSuccessTest}
                                disabled={testType === 'success'}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed transition-colors"
                            >
                                Test Success
                            </button>
                            <button
                                onClick={runFailureTest}
                                disabled={testType === 'failure'}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed transition-colors"
                            >
                                Test Failure
                            </button>
                            <button
                                onClick={runErrorTest}
                                disabled={testType === 'error'}
                                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-yellow-300 disabled:cursor-not-allowed transition-colors"
                            >
                                Test Error
                            </button>
                            <button
                                onClick={resetTest}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    {/* Test Status */}
                    {testType && (
                        <div className={`p-3 rounded-lg border ${
                            testType === 'success' ? 'bg-green-50 border-green-200' :
                            testType === 'failure' ? 'bg-red-50 border-red-200' :
                            'bg-yellow-50 border-yellow-200'
                        }`}>
                            <div className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${
                                    testType === 'success' ? 'bg-green-500' :
                                    testType === 'failure' ? 'bg-red-500' :
                                    'bg-yellow-500'
                                }`}></span>
                                <span className={`font-medium ${
                                    testType === 'success' ? 'text-green-800' :
                                    testType === 'failure' ? 'text-red-800' :
                                    'text-yellow-800'
                                }`}>
                                    Running {testType} test...
                                </span>
                            </div>
                            <p className={`text-sm mt-1 ${
                                testType === 'success' ? 'text-green-700' :
                                testType === 'failure' ? 'text-red-700' :
                                'text-yellow-700'
                            }`}>
                                {testType === 'success' && 'Watch the grouped updates auto-expand when the build completes successfully!'}
                                {testType === 'failure' && 'Watch the grouped updates auto-expand when the build fails!'}
                                {testType === 'error' && 'Watch the grouped updates auto-expand when an error occurs!'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Chat Interface */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Chat */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <VishCoderChat
                            messages={messages}
                            onSendMessage={(message) => {
                                setMessages(prev => [...prev, {
                                    id: Date.now().toString(),
                                    type: 'user',
                                    content: message,
                                    timestamp: new Date(),
                                    agent: 'User'
                                }]);
                            }}
                            className="h-[500px]"
                        />
                    </div>

                    {/* Instructions */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h3 className="font-semibold text-gray-900 mb-4">How Auto-Expand Works</h3>
                        
                        <div className="space-y-4">
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                <h4 className="font-medium text-green-800 mb-2">✅ Success Scenario</h4>
                                <p className="text-sm text-green-700">
                                    When a message contains "completed", "successfully", or "🎉", 
                                    the grouped updates automatically expand to show all details.
                                </p>
                            </div>

                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                <h4 className="font-medium text-red-800 mb-2">❌ Failure Scenario</h4>
                                <p className="text-sm text-red-700">
                                    When a message contains "failed" or "❌", 
                                    the grouped updates automatically expand to show all details.
                                </p>
                            </div>

                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <h4 className="font-medium text-yellow-800 mb-2">⚠️ Error Scenario</h4>
                                <p className="text-sm text-yellow-700">
                                    When a message contains "error" or "⚠️", 
                                    the grouped updates automatically expand to show all details.
                                </p>
                            </div>

                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <h4 className="font-medium text-blue-800 mb-2">🔍 Manual Control</h4>
                                <p className="text-sm text-blue-700">
                                    You can still manually expand/collapse groups by clicking on the header. 
                                    The auto-expand feature works alongside manual control.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VishCoderChatTest;
