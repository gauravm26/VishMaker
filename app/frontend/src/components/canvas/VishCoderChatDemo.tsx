import React, { useState, useEffect } from 'react';
import VishCoderChat, { ChatMessage } from './VishCoderChat';

const VishCoderChatDemo: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isRunning, setIsRunning] = useState(false);

    // Demo scenario: Manager starts build, then developer updates are grouped
    const runDemo = () => {
        setIsRunning(true);
        setMessages([]);

        // Step 1: Manager sends initial message
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '1',
                type: 'manager',
                content: 'Starting feature build process',
                timestamp: new Date(),
                agent: 'Manager',
                llm: 'GPT-5 mini'
            }]);
        }, 1000);

        // Step 2: Developer starts (normal message)
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '2',
                type: 'developer',
                content: '🚀 Starting feature build process...',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet'
            }]);
        }, 2000);

        // Step 3: Build updates start (grouped)
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '3',
                type: 'developer',
                content: '✅ Contract saved successfully',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet',
                progress: 3,
                isGrouped: true,
                groupId: 'build-process'
            }]);
        }, 3000);

        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '4',
                type: 'developer',
                content: 'Cloning repository: spicechemistryaustin/spicechemistry-website',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet',
                progress: 3,
                isGrouped: true,
                groupId: 'build-process'
            }]);
        }, 4000);

        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '5',
                type: 'developer',
                content: 'Repository cloned and ready for use',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet',
                progress: 3,
                isGrouped: true,
                groupId: 'build-process'
            }]);
        }, 5000);

        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '6',
                type: 'developer',
                content: 'Analyzing project structure',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet',
                progress: 15,
                isGrouped: true,
                groupId: 'build-process'
            }]);
        }, 6000);

        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '7',
                type: 'developer',
                content: 'Generating feature code',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet',
                progress: 45,
                isGrouped: true,
                groupId: 'build-process'
            }]);
        }, 7000);

        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '8',
                type: 'developer',
                content: 'Running tests and validation',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet',
                progress: 75,
                isGrouped: true,
                groupId: 'build-process'
            }]);
        }, 8000);

        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '9',
                type: 'developer',
                content: 'Feature build completed successfully! 🎉',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet',
                progress: 100,
                isGrouped: true,
                groupId: 'build-process'
            }]);
            setIsRunning(false);
        }, 9000);

        // Add a failed scenario example after completion
        setTimeout(() => {
            setMessages(prev => [...prev, {
                id: '10',
                type: 'developer',
                content: '❌ Build process failed due to dependency issues',
                timestamp: new Date(),
                agent: 'Claude Code',
                llm: 'Claude 3.5 Sonnet',
                progress: 0,
                isGrouped: true,
                groupId: 'build-process-2'
            }]);
        }, 11000);
    };

    const resetDemo = () => {
        setMessages([]);
        setIsRunning(false);
    };

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        VishCoder Chat Demo
                    </h1>
                    <p className="text-gray-600">
                        Experience the intelligent chat interface for feature building
                    </p>
                </div>

                {/* Demo Controls */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Demo Controls</h2>
                            <p className="text-sm text-gray-600">
                                Run the demo to see how the chat interface works
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={runDemo}
                                disabled={isRunning}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                            >
                                {isRunning ? 'Running...' : 'Run Demo'}
                            </button>
                            <button
                                onClick={resetDemo}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    {/* Demo Description */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-medium text-blue-900 mb-2">Demo Scenario:</h3>
                        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                            <li>Manager sends: "Starting feature build process" (normal chat)</li>
                            <li>Developer starts: "🚀 Starting feature build process..." (normal chat)</li>
                            <li>Build updates are grouped in a collapsible box</li>
                            <li>Box shows last 3 messages when collapsed</li>
                            <li>Click to expand and see all updates</li>
                            <li>Box header shows latest status</li>
                            <li><strong>Auto-expands when status is "Completed", "Failed", or "Error"</strong></li>
                        </ol>
                    </div>
                </div>

                {/* Chat Interface */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <VishCoderChat
                        messages={messages}
                        onSendMessage={(message) => {
                            // Add user message
                            setMessages(prev => [...prev, {
                                id: Date.now().toString(),
                                type: 'user',
                                content: message,
                                timestamp: new Date(),
                                agent: 'User'
                            }]);
                        }}
                        className="h-[600px]"
                    />
                </div>

                {/* Features Overview */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="text-2xl mb-3">💬</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Smart Grouping</h3>
                        <p className="text-sm text-gray-600">
                            Automatically groups related build updates into collapsible sections
                        </p>
                    </div>
                    
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="text-2xl mb-3">📊</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Progress Tracking</h3>
                        <p className="text-sm text-gray-600">
                            Visual progress bars and percentage indicators for build status
                        </p>
                    </div>
                    
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="text-2xl mb-3">🎯</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Context Aware</h3>
                        <p className="text-sm text-gray-600">
                            Different message types with appropriate styling and icons
                        </p>
                    </div>
                    
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="text-2xl mb-3">🚀</div>
                        <h3 className="font-semibold text-gray-900 mb-2">Auto-Expand</h3>
                        <p className="text-sm text-gray-600">
                            Automatically expands groups when builds complete, fail, or encounter errors
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VishCoderChatDemo;
