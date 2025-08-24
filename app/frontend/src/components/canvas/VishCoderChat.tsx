import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

export interface ChatMessage {
    id: string;
    type: 'manager' | 'developer' | 'system' | 'user';
    content: string;
    timestamp: Date;
    agent?: string;
    llm?: string;
    progress?: number;
    isGrouped?: boolean;
    groupId?: string;
    details?: {
        file_type?: 'New' | 'Modified';
        file_name?: string;
        file_size?: string;
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
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [inputValue, setInputValue] = useState('');
    const [throttledMessages, setThrottledMessages] = useState<ChatMessage[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messageBufferRef = useRef<ChatMessage[]>([]);
    const throttleTimeoutRef = useRef<number | null>(null);

    // Message throttling to prevent UI freeze from rapid updates
    const throttleMessages = useCallback(() => {
        if (messageBufferRef.current.length > 0) {
            const batchSize = messageBufferRef.current.length;
            console.log(`📦 VishCoder: Processing batch of ${batchSize} messages`);
            
            // Take all buffered messages and add them to throttled messages
            setThrottledMessages(prev => [...prev, ...messageBufferRef.current]);
            messageBufferRef.current = [];
        }
        throttleTimeoutRef.current = null;
    }, []);

    // Buffer incoming messages and throttle updates
    useEffect(() => {
        // Find new messages that aren't in throttledMessages yet
        const newMessages = messages.filter(msg => 
            !throttledMessages.some(throttledMsg => throttledMsg.id === msg.id)
        );

        if (newMessages.length > 0) {
            // Add new messages to buffer
            messageBufferRef.current.push(...newMessages);

            // If we don't have a pending throttle, schedule one
            if (!throttleTimeoutRef.current) {
                // Use 150ms delay for fast responsive updates while preventing UI freeze
                throttleTimeoutRef.current = setTimeout(throttleMessages, 150);
            }
        }
    }, [messages, throttledMessages, throttleMessages]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (throttleTimeoutRef.current) {
                clearTimeout(throttleTimeoutRef.current);
            }
        };
    }, []);

    // Throttled auto-scroll to bottom when new messages arrive
    const autoScrollTimeoutRef = useRef<number | null>(null);
    useEffect(() => {
        // Clear existing timeout
        if (autoScrollTimeoutRef.current) {
            clearTimeout(autoScrollTimeoutRef.current);
        }

        // Debounce auto-scroll to prevent excessive scrolling
        autoScrollTimeoutRef.current = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 200);

        return () => {
            if (autoScrollTimeoutRef.current) {
                clearTimeout(autoScrollTimeoutRef.current);
            }
        };
    }, [throttledMessages]);

    // Group messages by type and time - using useMemo to prevent recalculation
    const groupedMessages = useMemo(() => {
        const groups: Record<string, ChatMessage[]> = {};
        const regular: ChatMessage[] = [];
        let currentGroupId: string | null = null;
        let groupCounter = 0;

        throttledMessages.forEach((message) => {
            // Check if this message starts a new build process
            if (message.type === 'manager' && 
                message.content.toLowerCase().includes('starting feature build process')) {
                currentGroupId = `build-process-${groupCounter++}`;
                regular.push(message);
            }
            // Check if this message indicates completion, failure, or error
            else if (message.type === 'developer' && currentGroupId && 
                     (message.content.toLowerCase().includes('completed') || 
                      message.content.toLowerCase().includes('failed') || 
                      message.content.toLowerCase().includes('error') ||
                      message.content.toLowerCase().includes('successfully') ||
                      message.content.toLowerCase().includes('🎉') ||
                      message.content.toLowerCase().includes('❌') ||
                      message.content.toLowerCase().includes('⚠️'))) {
                // Add the final message to the group and close it
                if (!groups[currentGroupId]) {
                    groups[currentGroupId] = [];
                }
                groups[currentGroupId].push(message);
                currentGroupId = null; // Close the group
            }
            // Add developer messages to current group if we're in a build process
            else if (message.type === 'developer' && currentGroupId) {
                if (!groups[currentGroupId]) {
                    groups[currentGroupId] = [];
                }
                groups[currentGroupId].push(message);
            }
            // Handle manually grouped messages
            else if (message.isGrouped && message.groupId) {
                if (!groups[message.groupId]) {
                    groups[message.groupId] = [];
                }
                groups[message.groupId].push(message);
            }
            // All other messages go to regular
            else {
                regular.push(message);
            }
        });

        return { regular, groups };
    }, [throttledMessages]);

    // Auto-expand groups when status is completed, failed, or error
    useEffect(() => {
        const newExpandedGroups = new Set(expandedGroups);
        let hasChanges = false;
        
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
                if (!newExpandedGroups.has(groupId)) {
                    newExpandedGroups.add(groupId);
                    hasChanges = true;
                }
            }
        });
        
        if (hasChanges) {
            setExpandedGroups(newExpandedGroups);
        }
    }, [throttledMessages, expandedGroups]);

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

    const renderFileUpdate = (message: ChatMessage) => {
        const isNewFile = message.details?.file_type === 'New';
        const isModifiedFile = message.details?.file_type === 'Modified';
        
        if (!isNewFile && !isModifiedFile) return null;

        return (
            <div key={message.id} className="flex justify-start mb-3">
                <div className={`max-w-[85%] rounded-lg px-4 py-3 shadow-sm border-2 ${
                    isNewFile 
                        ? 'bg-emerald-50 border-emerald-300' 
                        : 'bg-amber-50 border-amber-300'
                }`}>
                    {/* File Update Header */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <span className={`text-lg ${
                                isNewFile ? 'text-emerald-600' : 'text-amber-600'
                            }`}>
                                {isNewFile ? '📄' : '✏️'}
                            </span>
                            <div>
                                <span className={`font-semibold text-sm ${
                                    isNewFile ? 'text-emerald-800' : 'text-amber-800'
                                }`}>
                                    {isNewFile ? 'New File Created' : 'File Modified'}
                                </span>
                                <div className="text-xs text-gray-600">
                                    {message.agent} • {message.llm}
                                </div>
                            </div>
                        </div>
                        <div className={`text-xs font-bold px-2 py-1 rounded ${
                            isNewFile ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                            {message.details?.file_type}
                        </div>
                    </div>

                    {/* File Details */}
                    <div className="bg-white rounded-lg p-3 mb-3 border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                            <span className={`font-medium text-sm ${
                                isNewFile ? 'text-emerald-800' : 'text-amber-800'
                            }`}>
                                📁 {message.details?.file_name}
                            </span>
                            {message.details?.file_size && (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                    {message.details.file_size}
                                </span>
                            )}
                        </div>
                        
                        {/* File Type Badge */}
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                isNewFile 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-amber-100 text-amber-800'
                            }`}>
                                {isNewFile ? '🆕 New' : '📝 Modified'}
                            </span>
                        </div>
                    </div>

                    {/* Timestamp */}
                    <div className="text-xs text-gray-500">
                        {formatTimestamp(message.timestamp)}
                    </div>
                </div>
            </div>
        );
    };

    const renderMessage = (message: ChatMessage) => {
        // Check if this is a file update message first
        if (message.details?.file_type) {
            return renderFileUpdate(message);
        }

        const isManager = message.type === 'manager';
        const isDeveloper = message.type === 'developer';
        const isSystem = message.type === 'system';
        const isUser = message.type === 'user';

        return (
            <div key={message.id} className={`flex mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-4 py-3 shadow-sm ${
                    isManager 
                        ? 'bg-blue-50 border border-blue-200' 
                        : isDeveloper
                        ? 'bg-green-50 border border-green-200'
                        : isSystem
                        ? 'bg-gray-50 border border-gray-200'
                        : 'bg-purple-50 border border-purple-200'
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
                            {isUser && (
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                            )}
                            <span className={`font-semibold text-sm ${
                                isManager ? 'text-blue-800' : 
                                isDeveloper ? 'text-green-800' : 
                                isSystem ? 'text-gray-800' :
                                'text-purple-800'
                            }`}>
                                {isManager ? 'Manager' : 
                                 isDeveloper ? `Developer (${message.agent || 'Claude Code'})` : 
                                 isSystem ? 'System' :
                                 'You'}
                            </span>
                            {message.llm && (
                                <span className={`text-xs px-2 py-1 rounded ${
                                    isManager ? 'bg-blue-100 text-blue-600' :
                                    isDeveloper ? 'bg-green-100 text-green-600' :
                                    isSystem ? 'bg-gray-100 text-gray-600' :
                                    'bg-purple-100 text-purple-600'
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
                        isSystem ? 'text-gray-800' :
                        'text-purple-800'
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
                        {throttledMessages.length} messages
                    </span>
                    {messageBufferRef.current.length > 0 && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                            +{messageBufferRef.current.length} pending
                        </span>
                    )}
                </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {throttledMessages.length === 0 ? (
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

// Memoize the component to prevent unnecessary re-renders
export default React.memo(VishCoderChat);
