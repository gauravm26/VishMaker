import React, { useState, useRef, useEffect } from 'react';

export interface ChatMessage {
    id: string;
    type: 'manager' | 'developer' | 'system';
    content: string;
    timestamp: Date;
    agent?: string;
    llm?: string;
    progress?: number;
    isGrouped?: boolean;
    groupId?: string;
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
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-expand groups when status is completed, failed, or error
    useEffect(() => {
        const newExpandedGroups = new Set(expandedGroups);
        
        Object.entries(groupedMessages.groups).forEach(([groupId, groupMessages]) => {
            const latestMessage = groupMessages[groupMessages.length - 1];
            const content = latestMessage.content.toLowerCase();
            
            // Auto-expand if the latest message indicates completion, failure, or error
            if (content.includes('completed') || 
                content.includes('failed') || 
                content.includes('error') ||
                content.includes('successfully') ||
                content.includes('🎉') ||
                content.includes('❌') ||
                content.includes('⚠️')) {
                newExpandedGroups.add(groupId);
            }
        });
        
        if (newExpandedGroups.size !== expandedGroups.size) {
            setExpandedGroups(newExpandedGroups);
        }
    }, [messages, groupedMessages.groups, expandedGroups]);

    // Group messages by type and time
    const groupedMessages = messages.reduce((acc, message) => {
        if (message.type === 'developer' && message.isGrouped) {
            const groupId = message.groupId || 'default';
            if (!acc.groups[groupId]) {
                acc.groups[groupId] = [];
            }
            acc.groups[groupId].push(message);
        } else {
            acc.regular.push(message);
        }
        return acc;
    }, { regular: [] as ChatMessage[], groups: {} as Record<string, ChatMessage[]> });

    const handleSendMessage = () => {
        if (inputValue.trim() && onSendMessage) {
            onSendMessage(inputValue.trim());
            setInputValue('');
        }
    };

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupId)) {
                newSet.delete(groupId);
            } else {
                newSet.add(groupId);
            }
            return newSet;
        });
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

    const renderMessage = (message: ChatMessage) => {
        const isManager = message.type === 'manager';
        const isDeveloper = message.type === 'developer';
        const isSystem = message.type === 'system';

        return (
            <div key={message.id} className="flex justify-start mb-3">
                <div className={`max-w-[85%] rounded-lg px-4 py-3 shadow-sm ${
                    isManager 
                        ? 'bg-blue-50 border border-blue-200' 
                        : isDeveloper
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-gray-50 border border-gray-200'
                }`}>
                    {/* Message Header */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {isManager && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                            {isDeveloper && (
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            )}
                            {isSystem && (
                                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                            )}
                            <span className={`font-semibold text-sm ${
                                isManager ? 'text-blue-800' : 
                                isDeveloper ? 'text-green-800' : 
                                'text-gray-800'
                            }`}>
                                {isManager ? 'Manager' : 
                                 isDeveloper ? `Developer (${message.agent || 'Claude Code'})` : 
                                 'System'}
                            </span>
                            {message.llm && (
                                <span className={`text-xs px-2 py-1 rounded ${
                                    isManager ? 'bg-blue-100 text-blue-600' :
                                    isDeveloper ? 'bg-green-100 text-green-600' :
                                    'bg-gray-100 text-gray-600'
                                }`}>
                                    {message.llm}
                                </span>
                            )}
                        </div>
                        {message.progress !== undefined && (
                            <div className={`text-xs font-bold px-2 py-1 rounded ${
                                isDeveloper ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                                {message.progress}%
                            </div>
                        )}
                    </div>

                    {/* Message Content */}
                    <div className={`text-sm mb-2 ${
                        isManager ? 'text-blue-800' : 
                        isDeveloper ? 'text-green-800' : 
                        'text-gray-800'
                    }`}>
                        {message.content}
                    </div>

                    {/* Progress Bar */}
                    {message.progress !== undefined && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                            <div 
                                className={`h-2 rounded-full transition-all duration-700 shadow-sm ${
                                    isDeveloper ? 'bg-gradient-to-r from-green-400 to-green-600' :
                                    'bg-gradient-to-r from-blue-400 to-blue-600'
                                }`}
                                style={{ width: `${message.progress}%` }}
                            ></div>
                        </div>
                    )}

                    {/* Timestamp */}
                    <div className="text-xs text-gray-500">
                        {formatTimestamp(message.timestamp)}
                    </div>
                </div>
            </div>
        );
    };

    const renderGroupedUpdates = (groupId: string, groupMessages: ChatMessage[]) => {
        const isExpanded = expandedGroups.has(groupId);
        const latestMessage = groupMessages[groupMessages.length - 1];
        const lastThreeMessages = groupMessages.slice(-3);

        return (
            <div key={groupId} className="mb-3">
                {/* Group Header - Always Visible */}
                <div 
                    className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3 cursor-pointer hover:from-purple-100 hover:to-blue-100 transition-all duration-200"
                    onClick={() => toggleGroup(groupId)}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">🚀</span>
                            <div>
                                <div className="font-semibold text-purple-800 text-sm">
                                    Build Process Updates
                                </div>
                                <div className="text-xs text-purple-600">
                                    {groupMessages.length} update{groupMessages.length !== 1 ? 's' : ''}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {/* Latest Status */}
                            <div className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                {latestMessage.content}
                            </div>
                            {/* Status Indicator */}
                            {isExpanded && (
                                <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                    Auto-expanded
                                </div>
                            )}
                            {/* Expand/Collapse Icon */}
                            <div className={`text-purple-500 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180' : ''
                            }`}>
                                ▼
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grouped Messages - Conditionally Visible */}
                {isExpanded && (
                    <div className="ml-4 mt-2 space-y-2">
                        {groupMessages.map((message, index) => (
                            <div key={`${groupId}-${index}`} className="flex justify-start">
                                <div className="max-w-[85%] rounded-lg px-3 py-2 bg-white border border-gray-200 shadow-sm">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                            <span className="font-medium text-green-800 text-xs">
                                                Developer ({message.agent || 'Claude Code'})
                                            </span>
                                        </div>
                                        {message.progress !== undefined && (
                                            <div className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded">
                                                {message.progress}%
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-green-800 text-xs mb-2 pl-3 border-l-2 border-green-300">
                                        {message.content}
                                    </div>
                                    {message.progress !== undefined && (
                                        <div className="w-full bg-green-100 rounded-full h-2 mb-1">
                                            <div 
                                                className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-700 shadow-sm" 
                                                style={{ width: `${message.progress}%` }}
                                            ></div>
                                        </div>
                                    )}
                                    <div className="text-xs text-gray-500">
                                        {formatTimestamp(message.timestamp)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Collapsed View - Show Last 3 Messages */}
                {!isExpanded && (
                    <div className="ml-4 mt-2 space-y-1">
                        {lastThreeMessages.map((message, index) => (
                            <div key={`${groupId}-collapsed-${index}`} className="flex justify-start">
                                <div className="max-w-[85%] rounded-lg px-2 py-1 bg-white border border-gray-200 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="text-green-800 text-xs truncate max-w-[200px]">
                                            {message.content}
                                        </div>
                                        {message.progress !== undefined && (
                                            <div className="text-xs font-bold bg-green-100 text-green-700 px-1 py-0.5 rounded ml-2">
                                                {message.progress}%
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {groupMessages.length > 3 && (
                            <div className="text-xs text-gray-500 text-center py-1">
                                +{groupMessages.length - 3} more updates
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

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
                        {/* Regular Messages */}
                        {groupedMessages.regular.map(renderMessage)}
                        
                        {/* Grouped Updates */}
                        {Object.entries(groupedMessages.groups).map(([groupId, groupMessages]) =>
                            renderGroupedUpdates(groupId, groupMessages)
                        )}
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

export default VishCoderChat;
