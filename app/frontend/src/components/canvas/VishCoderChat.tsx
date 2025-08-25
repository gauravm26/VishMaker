import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

export interface ChatMessage {
    id: string;
    type: 'manager' | 'developer' | 'system' | 'user';
    content: string;
    timestamp: Date;
    agent?: string;
    llm?: string;
    progress?: number;
    details?: string | {
        file_type?: 'New' | 'Modified';
        file_name?: string;
        file_size?: string | number;
    };
}

interface VishCoderChatProps {
    messages: ChatMessage[];
    onSendMessage?: (message: string) => void;
    className?: string;
}

const VishCoderChat: React.FC<VishCoderChatProps> = ({ 
    messages, 
    onSendMessage, 
    className = '' 
}) => {
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Group messages by type
    const groupedMessages = useMemo(() => {
        const managerMessages: ChatMessage[] = [];
        const buildStatusMessages: ChatMessage[] = [];
        const fileMessages: ChatMessage[] = [];
        const userMessages: ChatMessage[] = [];

        let buildProcessActive = false;

        messages.forEach((message) => {
            if (message.type === 'manager') {
                managerMessages.push(message);
                
                // Check if Manager is starting a build process
                if (message.content.toLowerCase().includes('starting feature build process')) {
                    buildProcessActive = true;
                }
                // Check if Manager indicates completion, failure, or error
                else if (message.content.toLowerCase().includes('completed') || 
                         message.content.toLowerCase().includes('failed') || 
                         message.content.toLowerCase().includes('error') ||
                         message.content.toLowerCase().includes('successfully') ||
                         message.content.toLowerCase().includes('🎉') ||
                         message.content.toLowerCase().includes('❌') ||
                         message.content.toLowerCase().includes('⚠️')) {
                    buildProcessActive = false;
                }
            } else if (message.type === 'developer' && message.progress !== undefined && buildProcessActive) {
                // Only add developer messages with progress if build process is active
                buildStatusMessages.push(message);
            } else if (message.details && typeof message.details === 'object' && message.details.file_type && buildProcessActive) {
                // Only add file messages if build process is active
                fileMessages.push(message);
            } else if (message.type === 'user') {
                userMessages.push(message);
            }
        });

        return { managerMessages, buildStatusMessages, fileMessages, userMessages };
    }, [messages]);

    const handleSendMessage = () => {
        if (inputValue.trim() && onSendMessage) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    const formatTimestamp = (date: Date) => {
        return date.toLocaleDateString('en-US', { 
            month: '2-digit', 
            day: '2-digit', 
            year: '2-digit' 
        }) + ' • ' + date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    };

    const formatFileSize = (fileSize: string | number | undefined): string => {
        if (fileSize === undefined || fileSize === null) return '';
        
        if (typeof fileSize === 'number') {
            if (fileSize < 1024) return `${fileSize} bytes`;
            if (fileSize < 1024 * 1024) return `${(fileSize / 1024).toFixed(1)} KB`;
            if (fileSize < 1024 * 1024 * 1024) return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
            return `${(fileSize / (1024 * 1024 * 1024)).toFixed(1)} GB`;
        }
        
        return fileSize;
    };

    const renderManagerMessage = (message: ChatMessage) => (
        <div key={message.id} className="flex justify-start mb-4">
            <div className="max-w-[85%] rounded-lg px-4 py-3 bg-blue-50 border border-blue-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="font-semibold text-blue-800 text-sm">Manager</span>
                    {message.llm && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                            {message.llm}
                        </span>
                    )}
                </div>
                <div className="text-blue-800 text-sm mb-2">{message.content}</div>
                <div className="text-xs text-gray-500">{formatTimestamp(message.timestamp)}</div>
            </div>
        </div>
    );

    const renderBuildStatusBox = () => {
        if (groupedMessages.buildStatusMessages.length === 0) return null;

        const latestMessage = groupedMessages.buildStatusMessages[groupedMessages.buildStatusMessages.length - 1];
        const progress = latestMessage.progress || 0;

        return (
            <div className="mb-4">
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🚀</span>
                            <div>
                                <div className="font-semibold text-green-800 text-sm">Build Status Updates</div>
                                <div className="text-xs text-green-600">
                                    {groupedMessages.buildStatusMessages.length} update{groupedMessages.buildStatusMessages.length !== 1 ? 's' : ''}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-green-700">{progress}%</div>
                            <div className="text-xs text-green-600">Progress</div>
                        </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="w-full bg-green-100 rounded-full h-3 mb-3">
                        <div 
                            className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-700 shadow-sm" 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>

                    {/* Latest Status */}
                    <div className="text-green-800 text-sm font-medium">
                        {latestMessage.content}
                    </div>

                    {/* All Status Messages */}
                    <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
                        {groupedMessages.buildStatusMessages.map((message, index) => (
                            <div key={`${message.id}-${index}`} className="flex items-center gap-2 text-xs">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <span className="text-green-700">{message.content}</span>
                                <span className="text-green-500 ml-auto">
                                    {message.progress !== undefined ? `${message.progress}%` : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderFilesBox = () => {
        if (groupedMessages.fileMessages.length === 0) return null;

        return (
            <div className="mb-4">
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-lg">📁</span>
                        <div>
                            <div className="font-semibold text-purple-800 text-sm">Files Generated</div>
                            <div className="text-xs text-purple-600">
                                {groupedMessages.fileMessages.length} file{groupedMessages.fileMessages.length !== 1 ? 's' : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        {groupedMessages.fileMessages.map((message) => {
                            if (!message.details || typeof message.details === 'string') return null;
                            
                            const isNewFile = message.details.file_type === 'New';
                            const fileName = message.details.file_name || 'Unknown file';
                            const fileSize = formatFileSize(message.details.file_size);
                            const agent = message.agent || 'Unknown agent';
                            const llm = message.llm || 'Unknown LLM';

                            return (
                                <div key={message.id} className={`rounded-lg p-3 border-2 ${
                                    isNewFile 
                                        ? 'bg-emerald-50 border-emerald-300' 
                                        : 'bg-amber-50 border-amber-300'
                                }`}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-lg ${
                                                isNewFile ? 'text-emerald-600' : 'text-amber-600'
                                            }`}>
                                                {isNewFile ? '📄' : '✏️'}
                                            </span>
                                            <div>
                                                <span className={`font-medium text-sm ${
                                                    isNewFile ? 'text-emerald-800' : 'text-amber-800'
                                                }`}>
                                                    {fileName}
                                                </span>
                                                <div className="text-xs text-gray-600">
                                                    {agent} • {llm}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-xs font-bold px-2 py-1 rounded ${
                                                isNewFile ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {message.details.file_type}
                                            </div>
                                            {fileSize && (
                                                <div className="text-xs text-gray-600 mt-1">
                                                    {fileSize}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const renderUserMessage = (message: ChatMessage) => (
        <div key={message.id} className="flex justify-end mb-4">
            <div className="max-w-[85%] rounded-lg px-4 py-3 bg-purple-50 border border-purple-200 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-purple-800 text-sm">You</span>
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                </div>
                <div className="text-purple-800 text-sm mb-2">{message.content}</div>
                <div className="text-xs text-gray-500">{formatTimestamp(message.timestamp)}</div>
            </div>
        </div>
    );

    return (
        <div className={`flex flex-col h-full bg-white rounded-lg border border-gray-200 ${className}`}>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-center gap-2">
                    <span className="text-lg">💬</span>
                    <h3 className="font-semibold text-gray-800">VishCoder Chat</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        {messages.length} messages
                    </span>
                </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                        <div className="mb-2">🚀 Ready to start building</div>
                        <div className="text-sm text-gray-400">
                            Send a message to begin the feature build process
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Manager Messages */}
                        {groupedMessages.managerMessages.map(renderManagerMessage)}
                        
                        {/* Build Status Box */}
                        {renderBuildStatusBox()}
                        
                        {/* Files Box */}
                        {renderFilesBox()}
                        
                        {/* User Messages */}
                        {groupedMessages.userMessages.map(renderUserMessage)}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Chat Input */}
            <div className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        placeholder="Type your message..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};

export default React.memo(VishCoderChat);
