import React, { useState, useEffect } from 'react';
import { ChatMessage } from './VishCoderChat';

// This component shows how to integrate VishCoderChat with the existing CanvasViewer
// It converts the existing chat message format to the new VishCoderChat format

interface ExistingChatMessage {
    id: string;
    type: 'user' | 'assistant' | 'status';
    content: string;
    timestamp: Date;
    isContract?: boolean;
    contractData?: any;
    agent?: string;
    llm?: string;
    progress?: number;
}

interface VishCoderChatIntegrationProps {
    existingMessages: ExistingChatMessage[];
    onSendMessage?: (message: string) => void;
    className?: string;
}

const VishCoderChatIntegration: React.FC<VishCoderChatIntegrationProps> = ({
    existingMessages,
    onSendMessage,
    className = ''
}) => {
    const [vishCoderMessages, setVishCoderMessages] = useState<ChatMessage[]>([]);

    // Convert existing chat messages to VishCoderChat format
    useEffect(() => {
        const convertedMessages: ChatMessage[] = existingMessages.map(msg => {
            // Convert message types
            let newType: 'manager' | 'developer' | 'system';
            let isGrouped = false;
            let groupId: string | undefined;

            if (msg.type === 'status') {
                newType = 'developer';
                // Group status messages by time proximity (within 5 minutes)
                const now = new Date();
                const timeDiff = Math.abs(now.getTime() - msg.timestamp.getTime());
                const fiveMinutes = 5 * 60 * 1000;
                
                if (timeDiff < fiveMinutes) {
                    isGrouped = true;
                    groupId = 'build-process';
                }
            } else if (msg.type === 'assistant') {
                newType = 'manager';
            } else {
                newType = 'system';
            }

            return {
                id: msg.id,
                type: newType,
                content: msg.content,
                timestamp: msg.timestamp,
                agent: msg.agent,
                llm: msg.llm,
                progress: msg.progress,
                isGrouped,
                groupId
            };
        });

        setVishCoderMessages(convertedMessages);
    }, [existingMessages]);

    // Example of how to add new messages in the new format
    const addManagerMessage = (content: string) => {
        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'manager',
            content,
            timestamp: new Date(),
            agent: 'Manager',
            llm: 'GPT-5 mini'
        };
        setVishCoderMessages(prev => [...prev, newMessage]);
    };

    const addDeveloperMessage = (content: string, progress?: number, isGrouped = false) => {
        const newMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'developer',
            content,
            timestamp: new Date(),
            agent: 'Claude Code',
            llm: 'Claude 3.5 Sonnet',
            progress,
            isGrouped,
            groupId: isGrouped ? 'build-process' : undefined
        };
        setVishCoderMessages(prev => [...prev, newMessage]);
    };

    return (
        <div className={className}>
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Integration Example</h3>
                <p className="text-sm text-blue-800 mb-3">
                    This shows how to integrate VishCoderChat with your existing chat system.
                </p>
                
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={() => addManagerMessage('Starting feature build process')}
                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    >
                        Add Manager Message
                    </button>
                    <button
                        onClick={() => addDeveloperMessage('🚀 Starting feature build process...')}
                        className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                    >
                        Add Developer Message
                    </button>
                    <button
                        onClick={() => addDeveloperMessage('✅ Contract saved successfully', 3, true)}
                        className="px-3 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700"
                    >
                        Add Grouped Update
                    </button>
                </div>
            </div>

            {/* Import and use VishCoderChat here */}
            {/* 
            import VishCoderChat from './VishCoderChat';
            
            <VishCoderChat
                messages={vishCoderMessages}
                onSendMessage={onSendMessage}
                className="h-[500px]"
            />
            */}
            
            {/* For now, show the converted messages */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Converted Messages ({vishCoderMessages.length})</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {vishCoderMessages.map(msg => (
                        <div key={msg.id} className="text-xs p-2 bg-gray-50 rounded border">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-1 rounded text-white text-xs ${
                                    msg.type === 'manager' ? 'bg-blue-500' :
                                    msg.type === 'developer' ? 'bg-green-500' :
                                    'bg-gray-500'
                                }`}>
                                    {msg.type}
                                </span>
                                {msg.isGrouped && (
                                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                        Grouped
                                    </span>
                                )}
                                {msg.progress !== undefined && (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                                        {msg.progress}%
                                    </span>
                                )}
                            </div>
                            <div className="text-gray-700">{msg.content}</div>
                            <div className="text-gray-500 text-xs mt-1">
                                {msg.timestamp.toLocaleTimeString()}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default VishCoderChatIntegration;
