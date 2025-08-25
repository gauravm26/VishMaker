// app-ui/src/components/canvas/CanvasViewer.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, {
    Controls,
    Background,
    NodeChange,
    EdgeChange,
    Connection,
    addEdge,
    MiniMap,
    NodeTypes,
    BackgroundVariant,
    useNodesState,
    useEdgesState,
    Position,
    ConnectionLineType,
    Node,
    Edge,
    OnNodesChange,
    applyNodeChanges,
    EdgeProps,
    EdgeTypes,
    getSmoothStepPath,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Menu, Item, useContextMenu } from "react-contexify";
import "react-contexify/dist/ReactContexify.css";

import apiClient from '@/utils/apiClient';
import LlmService from '@/utils/llmService';
import { 
    ProjectRequirementsResponse, 
    UserFlow, 
    BuildFeatureRequest, 
    BuildFeatureResponse,
    DockerBuildContract
} from '@/types/project';
import { CustomNode, TableNodeData, TableRowData, ColumnDef } from '@/types/canvas';
import TableNode from './TableNode';
import BuildSummaryModal from './BuildSummaryModal';
import { 
    commManager, 
    createContractPayload, 
    createMessagePayload,
    type ContractPayload,
    type MessagePayload,
    type VishCoderPayload
} from '@/utils/comm';

// Constants for layout calculations
const BASE_ROW_HEIGHT = 40;
const NODE_HEADER_HEIGHT = 50;
const NODE_HORIZONTAL_SPACING = 500; // Increased horizontal spacing between nodes
const NODE_VERTICAL_SPACING = 300;   // Increased vertical spacing between nodes
const DEFAULT_VISIBLE_ROWS = 3;      // Default number of rows to show when minimized

// Helper function to format display names
const formatDisplayName = (key: string): string => {
    return key
        .replace(/_list$/, '') // Remove '_list' suffix
        .replace(/_/g, ' ')    // Replace underscores with spaces
        .split(' ')            // Split into words
        .map(word => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter
        .join(' ');            // Join back with spaces
};

// Helper function to determine field names for a data object
const determineFields = (item: any): { 
    displayField: string, 
    descriptionField: string | null,
    childrenField: string | null 
} => {
    // Common field names for display/title
    const possibleDisplayFields = ['name', 'title', 'requirement_text', 'description'];
    // Common field names for description
    const possibleDescFields = ['description', 'desc', 'expected_result', 'details'];
    // Field names that might contain child items (usually ending with _list)
    const possibleChildrenFields = Object.keys(item || {}).filter(key => 
        key.endsWith('_list') && Array.isArray(item[key])
    );

    // Find the first matching field that exists in the item
    const displayField = possibleDisplayFields.find(field => item && item[field]) || 
                        Object.keys(item || {}).find(key => typeof item[key] === 'string') || 
                        'id';

    // Don't use the same field for both display and description
    const descriptionField = possibleDescFields
        .filter(field => field !== displayField)
        .find(field => item && item[field]) || null;

    // The first field ending with _list that contains an array
    const childrenField = possibleChildrenFields.length > 0 ? possibleChildrenFields[0] : null;

    return { displayField, descriptionField, childrenField };
};

interface CanvasViewerProps {
    projectId: number | null;
    refreshTrigger: number;
    onToggleSidebar?: () => void;
    showCanvas?: boolean;
    isBottomPanelOpen?: boolean;
    isRightPanelOpen?: boolean;
    onToggleBottomPanel?: () => void;
    onToggleRightPanel?: () => void;
}

// Custom edge component to handle errors with missing handles
const CustomSmoothStepEdge: React.FC<EdgeProps> = (props) => {
    // Just render a basic smooth step edge
    const { id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style } = props;
    
    // If we don't have all the required coordinates, return null
    if (sourceX === undefined || sourceY === undefined || targetX === undefined || targetY === undefined) {
        console.warn(`Cannot render edge ${id} due to missing coordinates`);
        return null;
    }
    
    // Get path for the edge
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition: sourcePosition || Position.Right,
        targetX,
        targetY,
        targetPosition: targetPosition || Position.Left,
    });
    
    return (
        <path
            id={id}
            style={{
                ...style,
                stroke: '#8B5CF6',
                strokeWidth: 2,
                strokeDasharray: '5,5',
            }}
            className="react-flow__edge-path"
            d={edgePath}
            markerEnd={MarkerType.ArrowClosed}
        />
    );
};

// Define the custom edge types
const edgeTypes: EdgeTypes = {
    smoothstep: CustomSmoothStepEdge,
};

// Define the custom node types for React Flow
const nodeTypes: NodeTypes = {
    tableNode: TableNode,
};

const createNewRow = (idPrefix: string, nextSno: number, columns: ColumnDef[]): TableRowData => {
    const newRow: TableRowData = {
        id: `${idPrefix}-row-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        sno: nextSno,
        name: 'New Item',
        desc: '',
    };
    
    columns.forEach(col => {
        if (col.key !== 'sno' && col.editable !== false) {
            newRow[col.key] = '';
        }
    });
    
    return newRow;
};

const CanvasViewer: React.FC<CanvasViewerProps> = ({ 
    projectId, 
    onToggleSidebar, 
    showCanvas = true,
    isBottomPanelOpen = false,
    isRightPanelOpen = false,
    onToggleBottomPanel,
    onToggleRightPanel
}) => {
    // Communication Protocol: Uses centralized commManager for all WebSocket communication
    // - Session threads are managed automatically based on Low Level Requirement ID
    // - All payloads use standardized 'body' structure (contract, messages, statusDetails)
    // - Response validation and parsing handled by commManager
    const [nodes, setNodes, onNodesChange] = useNodesState<TableNodeData & { actions: any }>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [userFlows, setUserFlows] = useState<UserFlow[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [generateLoading, setGenerateLoading] = useState<boolean>(false);
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
    
    // Track which tables are minimized (initially all tables are minimized)
    const [minimizedTables, setMinimizedTables] = useState<Record<string, boolean>>({});
    
    // Track the current right-clicked node type
    const [clickedNodeType, setClickedNodeType] = useState<string | null>(null);
    
    // Panel states - use props if provided, otherwise use internal state
    const bottomPanelOpen = isBottomPanelOpen;
    const rightPanelOpen = isRightPanelOpen;
    const [devMode, setDevMode] = useState<boolean>(false);
    
    // Terminal logs state
    const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
    const [dockerLogs, setDockerLogs] = useState<string>('Connecting to log stream...');
    const [logSocket, setLogSocket] = useState<WebSocket | null>(null);
    const [logConnected, setLogConnected] = useState<boolean>(false);
    
    // Log filtering and beautification state

    const [processedLogs, setProcessedLogs] = useState<string>('');
    
    // Chat state
    const [chatMessages, setChatMessages] = useState<Array<{
        id: string, 
        type: 'user' | 'assistant' | 'status', 
        content: string, 
        timestamp: Date, 
        isContract?: boolean, 
        contractData?: any, 
        agent?: string, 
        llm?: string, 
        progress?: number | null
    }>>([]);
    const [chatInput, setChatInput] = useState<string>('');
    const [chatLoading, setChatLoading] = useState<boolean>(false);
    const [contractBuilding, setContractBuilding] = useState<boolean>(false);
    const [expandedContracts, setExpandedContracts] = useState<Set<string>>(new Set());
    const [contractPopups, setContractPopups] = useState<Set<string>>(new Set());
    const [showAllLogs, setShowAllLogs] = useState<boolean>(false);
    
    // Build Summary modal state
    const [isBuildSummaryModalOpen, setIsBuildSummaryModalOpen] = useState<boolean>(false);
    const [buildSummaryData, setBuildSummaryData] = useState<{
        lowLevelRequirementId: string;
        status: string;
        branchLink: string;
        prLink: string;
        documentLinks: string[];
        keyMetrics: string;
        dashboardLinks: string[];
        alerts: string;
        logs: string;
        productManager: string;
        devManager: string;
    } | null>(null);
    
    // Inline editing state
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    
    // Chat history cache management
    const CHAT_CACHE_KEY = 'vishmaker_chat_history';
    const CHAT_CACHE_EXPIRY_DAYS = 5;
    
    // Load chat history from cache
    const loadChatHistory = useCallback(() => {
        try {
            const cached = localStorage.getItem(CHAT_CACHE_KEY);
            if (cached) {
                const { messages, timestamp } = JSON.parse(cached);
                const now = new Date().getTime();
                const expiryTime = timestamp + (CHAT_CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
                
                if (now < expiryTime) {
                    // Cache is still valid, load messages
                    const parsedMessages = messages.map((msg: any) => ({
                        ...msg,
                        timestamp: new Date(msg.timestamp)
                    }));
                    setChatMessages(parsedMessages);
                    console.log(`Loaded ${parsedMessages.length} chat messages from cache`);
                } else {
                    // Cache expired, remove it
                    localStorage.removeItem(CHAT_CACHE_KEY);
                    console.log('Chat cache expired, starting fresh');
                }
            }
        } catch (error) {
            console.error('Failed to load chat history from cache:', error);
            localStorage.removeItem(CHAT_CACHE_KEY);
        }
    }, []);
    
    // Save chat history to cache
    const saveChatHistory = useCallback((messages: any[]) => {
        try {
            const cacheData = {
                messages: messages.map(msg => ({
                    ...msg,
                    timestamp: msg.timestamp.toISOString()
                })),
                timestamp: new Date().getTime()
            };
            localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(cacheData));
            console.log(`Saved ${messages.length} chat messages to cache`);
        } catch (error) {
            console.error('Failed to save chat history to cache:', error);
        }
    }, []);
    
    // Clear chat history cache
    const clearChatHistory = useCallback(() => {
        localStorage.removeItem(CHAT_CACHE_KEY);
        setChatMessages([]);
        setExpandedContracts(new Set());
        console.log('Chat history cache cleared');
    }, []);
    
    // Process and beautify Docker logs
    const processDockerLogs = useCallback((rawLogs: string) => {
        const lines = rawLogs.split('\n');
        const processedLines: string[] = [];
        const now = Date.now();
        const hide_logs = [
            'health',
            'Health Check:',
            ' GET /'
        ]
        
        for (const line of lines) {
            // Skip empty lines
            if (!line.trim()) continue;
            
            // Check if line contains any text we want to hide
            const shouldHide = hide_logs.some(hideText => line.includes(hideText));
            if (shouldHide) {
                continue; // Skip this line completely
            }
            
            // Beautify ERROR logs with HTML
            if (line.includes(' - ERROR - ')) {
                const errorLine = line.replace(
                    /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+ - ERROR - (.+)/,
                    '<div class="docker-log-line docker-log-error">❌ $2 <span class="docker-log-separator">|</span> <span class="docker-log-timestamp">$1</span></div>'
                );
                processedLines.push(errorLine);
                continue;
            }
            
            // Beautify WARNING logs with HTML
            if (line.includes(' - WARNING - ')) {
                const warningLine = line.replace(
                    /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+ - WARNING - (.+)/,
                    '<div class="docker-log-line docker-log-warning">⚠️ $2 <span class="docker-log-separator">|</span> <span class="docker-log-timestamp">$1</span></div>'
                );
                processedLines.push(warningLine);
                continue;
            }
            
            // For any other lines, just add them as-is with basic styling
            processedLines.push(`<div class="docker-log-line">${line}</div>`);
        }
        

        
        return processedLines.join('');
    }, []);
    
    // Limit logs to last 200 lines
    const limitLogsToLastNLines = useCallback((logs: string, maxLines: number = 200) => {
        const lines = logs.split('\n');
        if (lines.length <= maxLines) {
            return logs;
        }
        
        // Keep only the last maxLines lines
        const limitedLines = lines.slice(-maxLines);
        return limitedLines.join('\n');
    }, []);
    
    // Get cache info for display
    const getCacheInfo = useCallback(() => {
        try {
            const cached = localStorage.getItem(CHAT_CACHE_KEY);
            if (cached) {
                const { timestamp } = JSON.parse(cached);
                const now = new Date().getTime();
                const expiryTime = timestamp + (CHAT_CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
                const daysLeft = Math.ceil((expiryTime - now) / (24 * 60 * 60 * 1000));
                return { daysLeft, timestamp: new Date(timestamp) };
            }
        } catch (error) {
            console.error('Failed to get cache info:', error);
        }
        return null;
    }, []);
    
    // AI Agent state
    const [agentSocket, setAgentSocket] = useState<WebSocket | null>(null);
    const [agentConnected, setAgentConnected] = useState<boolean>(false);
    
    // Chat scroll reference
    const chatMessagesEndRef = useRef<HTMLDivElement>(null);
    const [agentStatus, setAgentStatus] = useState<string>('Connecting...');
    const [agentLogs, setAgentLogs] = useState<string>('');
    const [agentInput, setAgentInput] = useState<string>('');
    const [agentProcessing, setAgentProcessing] = useState<boolean>(false);
    
    // Context menu setup
    const { show } = useContextMenu({
        id: "tableNodeMenu"
    });
    


    // Handle context menu show
    const handleContextMenu = useCallback((event: React.MouseEvent, props: any) => {
        // Save the node type to determine what menu items to show
        if (props?.nodeId) {
            const isTestCase = props.nodeId.startsWith('testcase_') || props.isTestCase === true;
            const isLlr = props.nodeId.startsWith('lowlevelrequirement_') || props.isLlr === true;
            setClickedNodeType(isTestCase ? 'testcase' : isLlr ? 'llr' : 'other');
        } else {
            setClickedNodeType(null);
        }
        
        // Ensure the event has the correct coordinates
        const x = event.clientX;
        const y = event.clientY;
        
        console.log('Context menu coordinates:', { x, y });
        console.log('Event target:', event.target);
        console.log('Event currentTarget:', event.currentTarget);
        
        // Show the context menu with explicit positioning
        show({
            event,
            props,
            position: { x, y }
        });
        
        // Additional debugging for positioning
        setTimeout(() => {
            const menuElement = document.querySelector('.contexify');
            if (menuElement) {
                const menuRect = menuElement.getBoundingClientRect();
                console.log('Context menu element position:', {
                    left: menuRect.left,
                    top: menuRect.top,
                    width: menuRect.width,
                    height: menuRect.height
                });
            } else {
                console.log('Context menu element not found');
            }
        }, 100);
    }, [show]);
    
    // Track context menu reference to pass to TableNode
    const contextMenuHandlerRef = useRef(handleContextMenu);
    
    // Update ref when handler changes
    useEffect(() => {
        contextMenuHandlerRef.current = handleContextMenu;
    }, [handleContextMenu]);
    
    // Load chat history from cache on component mount
    useEffect(() => {
        loadChatHistory();
    }, [loadChatHistory]);
    
    // Save chat history to cache whenever messages change
    useEffect(() => {
        if (chatMessages.length > 0) {
            saveChatHistory(chatMessages);
        }
    }, [chatMessages, saveChatHistory]);
    
    // Clean up expired cache entries periodically
    useEffect(() => {
        const cleanupInterval = setInterval(() => {
            try {
                const cached = localStorage.getItem(CHAT_CACHE_KEY);
                if (cached) {
                    const { timestamp } = JSON.parse(cached);
                    const now = new Date().getTime();
                    const expiryTime = timestamp + (CHAT_CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
                    
                    if (now >= expiryTime) {
                        localStorage.removeItem(CHAT_CACHE_KEY);
                        setChatMessages([]);
                        setExpandedContracts(new Set());
                        console.log('Expired chat cache cleaned up automatically');
                    }
                }
            } catch (error) {
                console.error('Failed to clean up expired cache:', error);
            }
        }, 60000); // Check every minute
        
        return () => clearInterval(cleanupInterval);
    }, []);
    
    // Handle Escape key to close contract popups
    useEffect(() => {
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && contractPopups.size > 0) {
                setContractPopups(new Set());
            }
        };
        
        document.addEventListener('keydown', handleEscapeKey);
        return () => document.removeEventListener('keydown', handleEscapeKey);
    }, [contractPopups.size]);
    
    // Toggle table minimize/maximize state
    const toggleTableSize = useCallback((nodeId: string) => {
        console.log(`Toggling table size for node ${nodeId}`);
        
        // Update in a single operation to avoid race conditions
        setNodes(nodes => {
            // Get the current node
            const node = nodes.find(n => n.id === nodeId);
            if (!node) return nodes;
            
            // Instead of relying on minimizedTables, check the node's current state
            const currentlyMinimized = node.data.isMinimized;
            console.log(`Current minimized state from node: ${currentlyMinimized}`);
            
            // We want to toggle this state
            const willBeMinimized = !currentlyMinimized;
            
            // Update the minimized tables state to stay in sync
            setMinimizedTables(prev => ({
                ...prev,
                [nodeId]: willBeMinimized
            }));
            
            const nodeData = node.data;
            const allRows = nodeData.allRows || [];
            
            console.log(`Toggling ${nodeId}: 
                Current state from node: ${currentlyMinimized ? 'minimized' : 'maximized'}
                Will be: ${willBeMinimized ? 'minimized' : 'maximized'}
                All rows: ${allRows.length}
                Current visible rows: ${nodeData.rows.length}`);
            
            // If switching to minimized, show fewer rows
            // If switching to maximized, show all rows
            const visibleRows = willBeMinimized 
                ? allRows.slice(0, DEFAULT_VISIBLE_ROWS) 
                : [...allRows];
            
            console.log(`After toggle will show ${visibleRows.length} rows`);
            
            // Calculate new height
            const newHeight = estimateNodeHeight(visibleRows.length);
            
            // Return the updated nodes
            return nodes.map(n => {
                if (n.id === nodeId) {
                    return {
                        ...n,
                        data: {
                            ...nodeData,
                            rows: visibleRows,
                            isMinimized: willBeMinimized,
                            allRows: allRows,
                            actions: nodeData.actions
                        },
                        style: {
                            ...n.style,
                            minHeight: `${newHeight}px`
                        }
                    };
                }
                return n;
            });
        });
    }, [setNodes, setMinimizedTables]);

    const handleCellChange = useCallback((nodeId: string, rowIndex: number, columnId: string, value: string) => {
        console.log(`Cell Change: Node=${nodeId}, Row=${rowIndex}, Col=${columnId}, Value=${value}`);
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    const nodeData = node.data as TableNodeData;
                    if (nodeData.rows && nodeData.rows[rowIndex]) {
                        const newRows = [...nodeData.rows];
                        const updatedRow = { ...newRows[rowIndex], [columnId]: value };
                        newRows[rowIndex] = updatedRow;
                        
                        // Also update allRows if the table is in minimized state
                        const allRows = nodeData.allRows ? [...nodeData.allRows] : newRows;
                        const isMinimized = nodeData.isMinimized || false;
                        
                        if (isMinimized && nodeData.allRows) {
                            // Find the real index in allRows
                            const realIndex = allRows.findIndex(r => r.id === newRows[rowIndex].id);
                            if (realIndex >= 0) {
                                allRows[realIndex] = updatedRow;
                            }
                        }
                        
                        return { 
                            ...node, 
                            data: { 
                                ...nodeData, 
                                rows: newRows,
                                allRows: isMinimized ? allRows : newRows,
                                actions: node.data.actions
                            } 
                        };
                    }
                }
                return node;
            })
        );
    }, [setNodes]);

    const handleAddRow = useCallback((nodeId: string, afterRowIndex: number) => {
        console.log(`Add Row: Node=${nodeId}, AfterIndex=${afterRowIndex}`);
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    const nodeData = node.data as TableNodeData;
                    const currentRows = nodeData.rows || [];
                    const allRows = nodeData.allRows || currentRows;
                    const isMinimized = nodeData.isMinimized || false;
                    const currentColumns = nodeData.columns || [];
                    const newRowIndex = afterRowIndex === -1 ? currentRows.length : afterRowIndex + 1;
 
                    const nextSno = allRows.length > 0 ? Math.max(...allRows.map(r => r.sno)) + 1 : 1;
                    const prefix = node.id.split('-')[0] || 'new';
                    const newRow = createNewRow(prefix, nextSno, currentColumns);

                    // Update all rows
                    const newAllRows = [...allRows];
                    const insertIndexInAll = isMinimized && afterRowIndex !== -1 ? 
                        // If minimized, we need to find the real index in allRows
                        allRows.findIndex(r => r.id === currentRows[afterRowIndex].id) + 1 :
                        afterRowIndex === -1 ? allRows.length : afterRowIndex + 1;
                    
                    newAllRows.splice(insertIndexInAll, 0, newRow);
                    newAllRows.forEach((r, idx) => r.sno = idx + 1);
                    
                    // Update visible rows
                    let newRows;
                    if (isMinimized) {
                        // Keep showing only the first DEFAULT_VISIBLE_ROWS
                        newRows = newAllRows.slice(0, DEFAULT_VISIBLE_ROWS);
                    } else {
                        // Show all rows
                        newRows = newAllRows;
                    }

                    const newNodeHeight = estimateNodeHeight(newRows.length);
                    const newStyle = { ...(node.style || {}), minHeight: `${newNodeHeight}px` };

                    return { 
                        ...node, 
                        data: { 
                            ...nodeData, 
                            rows: newRows,
                            allRows: newAllRows,
                            isMinimized,
                            actions: node.data.actions
                        }, 
                        style: newStyle 
                    };
                }
                return node;
            })
        );
    }, [setNodes]);

    const handleDeleteRow = useCallback((nodeId: string, rowIndex: number) => {
        console.log(`Delete Row: Node=${nodeId}, RowIndex=${rowIndex}`);
        let deletedRowId: string | undefined;

        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    const nodeData = node.data as TableNodeData;
                    if (!nodeData.rows || !nodeData.rows[rowIndex]) return node;

                    deletedRowId = nodeData.rows[rowIndex].id;
                    const isMinimized = nodeData.isMinimized || false;
                    const allRows = nodeData.allRows || nodeData.rows;
                    
                    // Find the real index in allRows
                    const indexInAllRows = isMinimized ? 
                        allRows.findIndex(r => r.id === deletedRowId) : 
                        rowIndex;
                    
                    if (indexInAllRows === -1) return node;
                    
                    // Remove from all rows
                    const newAllRows = allRows.filter((_, index) => index !== indexInAllRows)
                        .map((r, index) => ({ ...r, sno: index + 1 }));
                    
                    // Update visible rows
                    let newRows;
                    if (isMinimized) {
                        // Keep showing only the first DEFAULT_VISIBLE_ROWS
                        newRows = newAllRows.slice(0, DEFAULT_VISIBLE_ROWS);
                    } else {
                        // Show all rows
                        newRows = newAllRows;
                    }

                    const newNodeHeight = estimateNodeHeight(newRows.length);
                    const newStyle = { ...(node.style || {}), minHeight: `${newNodeHeight}px` };

                    return { 
                        ...node, 
                        data: { 
                            ...nodeData, 
                            rows: newRows,
                            allRows: newAllRows,
                            isMinimized,
                            actions: node.data.actions
                        }, 
                        style: newStyle 
                    };
                }
                return node;
            })
        );
    }, [setNodes]);

    // Add handlers for column operations
    const handleAddColumn = useCallback((nodeId: string, columnDef: any) => {
        console.log(`Add Column: Node=${nodeId}, Column=${columnDef.key}`);
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    const nodeData = node.data;
                    const currentColumns = [...(nodeData.columns || [])];
                    return {
                        ...node,
                        data: {
                            ...nodeData,
                            columns: [...currentColumns, columnDef]
                        }
                    };
                }
                return node;
            })
        );
    }, [setNodes]);

    const handleDeleteColumn = useCallback((nodeId: string, columnKey: string) => {
        console.log(`Delete Column: Node=${nodeId}, Column=${columnKey}`);
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    const nodeData = node.data;
                    const currentColumns = nodeData.columns || [];
                    return {
                        ...node,
                        data: {
                            ...nodeData,
                            columns: currentColumns.filter((col: any) => col.key !== columnKey)
                        }
                    };
                }
                return node;
            })
        );
    }, [setNodes]);

    const handleColumnHeaderChange = useCallback((nodeId: string, columnKey: string, newValue: string) => {
        console.log(`Column Header Change: Node=${nodeId}, Column=${columnKey}, Value=${newValue}`);
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    const nodeData = node.data;
                    const currentColumns = nodeData.columns || [];
                    return {
                        ...node,
                        data: {
                            ...nodeData,
                            columns: currentColumns.map((col: any) => 
                                col.key === columnKey ? { ...col, label: newValue } : col
                            )
                        }
                    };
                }
                return node;
            })
        );
    }, [setNodes]);

    /**
     * Generic function to create a table node without specific table-type logic
     */
    const createGenericTable = (
        items: any[],                 // Array of data items for the rows
        nodeId: string,               // Unique ID for the node
        title: string,                // Table title
        fieldConfig: {                // Configuration for fields to use
            displayField: string,
            descriptionField: string | null
        },
        extraColumns: ColumnDef[] = [] // Any additional columns
    ): CustomNode => {
        // Common columns that appear in all tables
        const baseColumns: ColumnDef[] = [
            { key: 'sno', label: '#', order: 0, editable: false, width: 'w-[50px]' },
            { key: 'name', label: 'Name', order: 1, editable: true, width: 'w-[250px]' },
            { key: 'desc', label: 'Description', order: 2, editable: true, width: 'w-[450px]' },
            ...extraColumns
        ];

        // Create table rows from the items
        const tableRows: TableRowData[] = items.map((item, index) => {
            // Use the existing UIID from the database
            const sno = index + 1; // Ensure sno is always a number starting from 1
            // Extract UIID from the database record or create a placeholder
            const rowUiid = item.uiid || `placeholder-${nodeId}-${sno}`;
            
            // Ensure we capture the sno from the database if it exists 
            const dbSno = typeof item.sno === 'number' ? item.sno : sno;
            
            return {
                id: rowUiid, // Use the UIID as the row ID
                sno: dbSno, // Use database sno or our calculated one
                name: item[fieldConfig.displayField] || 'Unnamed Item',
                desc: fieldConfig.descriptionField && item[fieldConfig.descriptionField] 
                    ? item[fieldConfig.descriptionField] 
                    : '',
                originalId: item.id,
                uiid: rowUiid, // Store UIID separately in case we need it
                originalData: item // Store the original data for reference
            };
        });
        
        // Sort the rows by serial number
        tableRows.sort((a, b) => a.sno - b.sno);
        
        // By default, tables start minimized showing only DEFAULT_VISIBLE_ROWS
        const isMinimized = true;
        const visibleRows = tableRows.length > DEFAULT_VISIBLE_ROWS ? 
            tableRows.slice(0, DEFAULT_VISIBLE_ROWS) : 
            tableRows;

        console.log(`Creating table ${nodeId} with ${visibleRows.length} visible rows out of ${tableRows.length} total`);
        
        // Set initial minimized state for this node
        setMinimizedTables(prev => ({
            ...prev,
            [nodeId]: true
        }));
        
        // Determine if this is a test case table or LLR table for context menu customization
        const isTestCase = nodeId.startsWith('testcase_');
        const isLlr = nodeId.startsWith('lowlevelrequirement_');
        
        // Create the node with the organized data
        return {
            id: nodeId,
            type: 'tableNode',
            data: {
                title: title,
                componentId: nodeId.split('_').slice(0, 2).join('_'), // Use the nodeId as componentId for LLM processing
                columns: baseColumns,
                rows: visibleRows,
                allRows: tableRows,
                isMinimized: isMinimized,
                isTestCase: isTestCase, // Pass flag to determine table type
                isLlr: isLlr, // Pass flag to determine table type
                connectedRowUiids: [], // Will be populated with UIIDs of rows that have connections
                actions: {
                    onCellChange: handleCellChange,
                    onAddRow: handleAddRow,
                    onDeleteRow: handleDeleteRow,
                    onAddColumn: handleAddColumn,
                    onDeleteColumn: handleDeleteColumn,
                    onColumnHeaderChange: handleColumnHeaderChange,
                    onToggleSize: toggleTableSize,
                    onContextMenu: handleContextMenu // Pass the context menu handler
                }
            },
            position: { x: 0, y: 0 }, // Position will be calculated later
            style: {
                minHeight: `${estimateNodeHeight(visibleRows.length)}px`
            }
        };
    };

    /**
     * Function to recursively build tables and connections from hierarchical data
     */
    const buildHierarchicalTables = (
        data: any,                       // The data object
        currentKey: string,              // Current key in the data (e.g., 'flows')
        level: number = 0,               // Current level in the hierarchy (for positioning)
        parentNodeId: string | null = null, // Parent node ID for edge connections
        parentRowIndex: number = -1,     // Index of the parent row that owns this table
        projectId: number | null = null  // Project ID for root node naming
    ): { nodes: CustomNode[], edges: Edge[] } => {
        // Check if we have data for this level
        if (!data[currentKey] || !data[currentKey].length) {
            return { nodes: [], edges: [] };
        }

        const items = data[currentKey];
        console.log(`Building hierarchical tables for ${currentKey} with ${items.length} items, and data: ${JSON.stringify(data)}`);
        
        // Get a sample item to determine fields
        const sampleItem = items[0] || {};
        const { displayField, descriptionField, childrenField } = determineFields(sampleItem);
        
        // Format a nice title for display
        const title = formatDisplayName(currentKey);
        
        // All nodes and edges we'll return
        let allNodes: CustomNode[] = [];
        let allEdges: Edge[] = [];
        
        // Track which row UIIDs have outgoing connections
        const connectedRowUiids = new Map<string, Set<string>>(); // nodeId -> Set of connected row UIIDs
        
        // Helper function to track a connection
        const trackConnection = (sourceNodeId: string, rowUiid: string) => {
            if (!connectedRowUiids.has(sourceNodeId)) {
                connectedRowUiids.set(sourceNodeId, new Set());
            }
            connectedRowUiids.get(sourceNodeId)!.add(rowUiid);
        };

        // Handle User Flows table (root level)
        if (level === 0) {
            // Create a single table for user flows
            const nodeId = `flow_genChildReq_${projectId || 'root'}`;           
            console.log(`Creating root node: ${nodeId}`);
            
        const tableNode = createGenericTable(
            items,
            nodeId,
            title,
            { displayField, descriptionField },
            []
        );
            
            // Position the node
            tableNode.position = { x: 0, y: 0 };
            
            // Add the user flows table to our nodes
            allNodes.push(tableNode);
            
            // Process each user flow's high-level requirements separately
            if (childrenField) {
                items.forEach((flow: any, flowIndex: number) => {
                    // Check if this flow has child requirements
                    if (flow[childrenField] && Array.isArray(flow[childrenField]) && flow[childrenField].length > 0) {
                        // Create a separate table for this flow's HLRs
                        const hlrTitle = `${flow[displayField]} HLRs`;
                        const flowUiid = flow.uiid || flow.id || `flow-${flowIndex}`;
                        const hlrNodeId = `highlevelrequirement_genChildReq_${flowUiid}`;
                        
                        console.log(`Creating HLR table for flow ${flowIndex}: ${hlrNodeId}`);
                        
                        // Filter children to only include those with matching parent_uiid
                        const matchingChildren = flow[childrenField].filter((child: any) => 
                            child.parent_uiid === flowUiid
                        );
                        
                        console.log(`Flow ${flowIndex} has ${matchingChildren.length} matching HLRs`);
                        
                        // Only create a table if there are matching children
                        if (matchingChildren.length > 0) {
                            // Create table for this flow's HLRs using the flow's UIID in the nodeId
                            const hlrTable = createGenericTable(
                                matchingChildren,
                                hlrNodeId,
                                hlrTitle,
                                { displayField, descriptionField },
                                []
                            );
                            
                            // Position the HLR table - offset horizontally from flows table
                            // and vertically based on the flow's position
                            hlrTable.position = {
                                x: NODE_HORIZONTAL_SPACING,
                                y: flowIndex * NODE_VERTICAL_SPACING
                            };
                            
                            // Add the HLR table to our collection
                            allNodes.push(hlrTable);
                            
                            // Get the actual row index in the table
                            // Use flowIndex as fallback if sno is not available
                            const rawSno = Number(flow.sno || 0);
                            const actualRowIndex = !isNaN(rawSno) && rawSno > 0 ? rawSno - 1 : flowIndex;
                            console.log(`Flow ${flowIndex} has sno=${flow.sno}, using row handle ID row-handle-${flow.uiid || flow.id}`);
                            
                            // Create an edge from the specific flow row to its HLR table
                            const rowHandleId = `row-handle-${flow.uiid || flow.id}`;
                            
                            // Determine if this row might be hidden when table is minimized
                            // If the row's index is >= DEFAULT_VISIBLE_ROWS, it will be hidden when minimized
                            const mightBeHiddenWhenMinimized = actualRowIndex >= DEFAULT_VISIBLE_ROWS;
                            
                            // Use the special minimized handle if the row might be hidden
                            const sourceHandleToUse = mightBeHiddenWhenMinimized ? 
                                "minimized-rows-handle" : rowHandleId;
                            
                            console.log(`Creating edge with handle ID: ${sourceHandleToUse} (might be hidden: ${mightBeHiddenWhenMinimized})`);
                            
                            // Track this connection
                            trackConnection(nodeId, flow.uiid || flow.id);
                            
                            const flowToHlrEdge: Edge = {
                                id: `edge-${nodeId}-row${actualRowIndex}-to-${hlrNodeId}`,
                                source: nodeId,
                                sourceHandle: sourceHandleToUse,
                                target: hlrNodeId,
                                type: 'smoothstep',
                                animated: true
                            };
                            
                            allEdges.push(flowToHlrEdge);
                            
                            // Process each HLR's children (LLRs)
                            matchingChildren.forEach((hlr: any, hlrIndex: number) => {
                                // Check if this HLR has child LLRs
                                if (hlr.low_level_requirement_list && 
                                    Array.isArray(hlr.low_level_requirement_list) && 
                                    hlr.low_level_requirement_list.length > 0) {
                                    
                                    // Create a separate table for this HLR's LLRs
                                    const llrTitle = `${hlr[displayField]} LLRs`;
                                    // Include HLR's UIID in the LLR nodeId
                                    const hlrUiid = hlr.uiid || hlr.id || `hlr-${hlrIndex}`;
                                    const llrNodeId = `lowlevelrequirement_genChildReq_${hlrUiid}`;
                                    
                                    console.log(`Creating LLR table for HLR ${hlrIndex}: ${llrNodeId}`);
                                    
                                    // Filter LLRs to only include those with matching parent_uiid
                                    const matchingLLRs = hlr.low_level_requirement_list.filter((llr: any) => 
                                        llr.parent_uiid === hlrUiid
                                    );
                                    
                                    console.log(`HLR ${hlrIndex} has ${matchingLLRs.length} matching LLRs`);
                                    
                                    // Only create a table if there are matching LLRs
                                    if (matchingLLRs.length > 0) {
                                        // Create a table for this HLR's LLRs
                                        const llrTable = createGenericTable(
                                            matchingLLRs,
                                            llrNodeId,
                                            llrTitle,
                                            { displayField, descriptionField },
                                            []
                                        );
                                        
                                        // Position the LLR table - offset horizontally from HLR table
                                        // and vertically based on the HLR's relative position
                                        llrTable.position = {
                                            x: NODE_HORIZONTAL_SPACING * 2,
                                            y: (flowIndex * NODE_VERTICAL_SPACING) + (hlrIndex * (NODE_VERTICAL_SPACING / 2))
                                        };
                                        
                                        // Add the LLR table to our collection
                                        allNodes.push(llrTable);
                                        
                                        // Get the actual row index for this HLR in the table (0-based)
                                        // Use hlrIndex as fallback if sno is not available
                                        const rawHlrSno = Number(hlr.sno || 0);
                                        const actualHlrRowIndex = !isNaN(rawHlrSno) && rawHlrSno > 0 ? rawHlrSno - 1 : hlrIndex;
                                        console.log(`HLR ${hlrIndex} has sno=${hlr.sno}, using row handle ID row-handle-${hlr.uiid || hlr.id}`);
                                        
                                        // Create an edge from the specific HLR row to its LLR table
                                        const hlrRowHandleId = `row-handle-${hlr.uiid || hlr.id}`;
                                        
                                        // Determine if this row might be hidden when table is minimized
                                        const hlrMightBeHiddenWhenMinimized = actualHlrRowIndex >= DEFAULT_VISIBLE_ROWS;
                                        
                                        // Use the special minimized handle if the row might be hidden
                                        const hlrSourceHandleToUse = hlrMightBeHiddenWhenMinimized ? 
                                            "minimized-rows-handle" : hlrRowHandleId;
                                        
                                        console.log(`Creating LLR edge with handle ID: ${hlrSourceHandleToUse} (might be hidden: ${hlrMightBeHiddenWhenMinimized})`);
                                        
                                        // Track this connection
                                        trackConnection(hlrNodeId, hlr.uiid || hlr.id);
                                        
                                        const hlrToLlrEdge: Edge = {
                                            id: `edge-${hlrNodeId}-row${actualHlrRowIndex}-to-${llrNodeId}`,
                                            source: hlrNodeId,
                                            sourceHandle: hlrSourceHandleToUse,
                                            target: llrNodeId,
                                            type: 'smoothstep',
                                            animated: true
                                        };
                                        
                                        allEdges.push(hlrToLlrEdge);
                                        
                                        // Process each LLR's children (Test Cases)
                                        matchingLLRs.forEach((llr: any, llrIndex: number) => {
                                            // Check if this LLR has test cases
                                            if (llr.test_case_list && 
                                                Array.isArray(llr.test_case_list) && 
                                                llr.test_case_list.length > 0) {
                                                
                                                // Create a separate table for this LLR's test cases
                                                const tcTitle = `${llr[displayField]} Tests`;
                                                // Include LLR's UIID in the TC nodeId
                                                const llrUiid = llr.uiid || llr.id || `llr-${llrIndex}`;
                                                const tcNodeId = `testcase_genChildReq_${llrUiid}`;
                                                
                                                console.log(`Creating TC table for LLR ${llrIndex}: ${tcNodeId}`);
                                                
                                                // Filter test cases to only include those with matching parent_uiid
                                                const matchingTCs = llr.test_case_list.filter((tc: any) => 
                                                    tc.parent_uiid === llrUiid
                                                );
                                                
                                                console.log(`LLR ${llrIndex} has ${matchingTCs.length} matching TCs`);
                                                
                                                // Only create a table if there are matching test cases
                                                if (matchingTCs.length > 0) {
                                                    // Create a table for this LLR's test cases
                                                    const tcTable = createGenericTable(
                                                        matchingTCs,
                                                        tcNodeId,
                                                        tcTitle,
                                                        { displayField, descriptionField },
                                                        []
                                                    );
                                                    
                                                    // Position the TC table - offset horizontally from LLR table
                                                    // and vertically based on the LLR's relative position
                                                    tcTable.position = {
                                                        x: NODE_HORIZONTAL_SPACING * 3,
                                                        y: (flowIndex * NODE_VERTICAL_SPACING) + 
                                                           (hlrIndex * (NODE_VERTICAL_SPACING / 2)) + 
                                                           (llrIndex * (NODE_VERTICAL_SPACING / 4))
                                                    };
                                                    
                                                    // Add the TC table to our collection
                                                    allNodes.push(tcTable);
                                                    
                                                    // Get the actual row index for this LLR (0-based)
                                                    // Use llrIndex as fallback if sno is not available
                                                    const rawLlrSno = Number(llr.sno || 0);
                                                    const actualLlrRowIndex = !isNaN(rawLlrSno) && rawLlrSno > 0 ? rawLlrSno - 1 : llrIndex;
                                                    console.log(`LLR ${llrIndex} has sno=${llr.sno}, using row handle ID row-handle-${llr.uiid || llr.id}`);
                                                    
                                                    // Create an edge from the specific LLR row to its TC table
                                                    const llrRowHandleId = `row-handle-${llr.uiid || llr.id}`;
                                                    
                                                    // Determine if this row might be hidden when table is minimized
                                                    const llrMightBeHiddenWhenMinimized = actualLlrRowIndex >= DEFAULT_VISIBLE_ROWS;
                                                    
                                                    // Use the special minimized handle if the row might be hidden
                                                    const llrSourceHandleToUse = llrMightBeHiddenWhenMinimized ? 
                                                        "minimized-rows-handle" : llrRowHandleId;
                                                    
                                                    console.log(`Creating TC edge with handle ID: ${llrSourceHandleToUse} (might be hidden: ${llrMightBeHiddenWhenMinimized})`);
                                                    
                                                    // Track this connection
                                                    trackConnection(llrNodeId, llr.uiid || llr.id);
                                                    
                                                    const llrToTcEdge: Edge = {
                                                        id: `edge-${llrNodeId}-row${actualLlrRowIndex}-to-${tcNodeId}`,
                                                        source: llrNodeId,
                                                        sourceHandle: llrSourceHandleToUse,
                                                        target: tcNodeId,
                                                        type: 'smoothstep',
                                                        animated: true
                                                    };
                                                    
                                                    allEdges.push(llrToTcEdge);
                                                }
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    }
                });
            }
        }
        
        // Update all nodes with their connected row UIIDs
        const updatedNodes = allNodes.map(node => {
            const nodeConnectedRows = connectedRowUiids.get(node.id) || new Set();
            return {
                ...node,
                data: {
                    ...node.data,
                    connectedRowUiids: Array.from(nodeConnectedRows)
                }
            };
        });
        
        return {
            nodes: updatedNodes,
            edges: allEdges
        };
    };

    // Fetch data and build tables
    const fetchData = async () => {
        if (!projectId) {
            setNodes([]);
            setEdges([]);
            setUserFlows([]);
            addTerminalLog('No project selected');
            return;
        }

        setLoading(true);
        setError(null);
        addTerminalLog(`Loading project data for project ID: ${projectId}`);

        try {
            // Fade out existing nodes during loading
            setNodes(currentNodes => 
                currentNodes.map(node => ({
                    ...node,
                    style: {
                        ...node.style,
                        opacity: 0.5,
                        transition: 'opacity 0.3s'
                    }
                }))
            );
            
            // Fetch the project requirements data
            const response = await apiClient<ProjectRequirementsResponse>(`/requirements/${projectId}`);
            
            // Log the response for debugging
            console.log("API Response:", response);
            addTerminalLog(`Received ${response.flows?.length || 0} user flows from API`);
            
            // Store the user flows for reference
            setUserFlows(response.flows || []);
            
            // Build tables from the hierarchical data
            if (response.flows && response.flows.length > 0) {
                const { nodes: builtNodes, edges: builtEdges } = buildHierarchicalTables(
                    { flows: response.flows },
                    'flows',
                    0,       // level
                    null,    // parentNodeId
                    -1,      // parentRowIndex
                    projectId // Pass the projectId
                );
                
                // Add animations for new nodes
                const animatedNodes = builtNodes.map(node => ({
                    ...node,
                    style: {
                        ...node.style,
                        opacity: 1,
                        animation: 'fadeIn 0.5s ease-in-out'
                    }
                }));
                
                // Filter out edges that might have invalid handles to prevent React Flow errors
                const validEdges = builtEdges.filter(edge => {
                    // Ensure source and target exists in nodes
                    const sourceExists = builtNodes.some(node => node.id === edge.source);
                    const targetExists = builtNodes.some(node => node.id === edge.target);
                    
                    // If a handle ID is specified, we can't easily validate it right now
                    // Simply log it for debugging purposes
                    if (!sourceExists || !targetExists) {
                        console.warn(`Filtering out edge ${edge.id} - source or target node doesn't exist`);
                        return false;
                    }
                    
                    return true;
                });
                
                console.log(`Created ${animatedNodes.length} nodes and ${validEdges.length} valid edges (filtered out ${builtEdges.length - validEdges.length})`);
                addTerminalLog(`Built ${animatedNodes.length} nodes and ${validEdges.length} edges`);
                
                setNodes(animatedNodes);
                setEdges(validEdges);
            } else {
                setNodes([]);
                setEdges([]);
                addTerminalLog('No flows found in project data');
            }
        } catch (error: any) {
            console.error('Error loading project data:', error);
            setError(`Failed to load project data: ${error.message || 'Unknown error'}`);
            addTerminalLog(`Error loading project data: ${error.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    // Generate requirements for specific row
    const handleGenerateRequirements = async (nodeId: string, rowIndex: number): Promise<void> => {
        if (!projectId) {
            console.error("Cannot generate requirements: No project ID");
            setError("Cannot generate requirements: No project ID");
            return;
        }
        
        console.log(`Generating requirements for nodeId=${nodeId}, rowIndex=${rowIndex}, projectId=${projectId}`);
        setGenerateLoading(true);
        setError(null);
        addTerminalLog(`Generating requirements for nodeId=${nodeId}, rowIndex=${rowIndex}, projectId=${projectId}`);
        
        // Show loading state in the node
        setNodes(nodes.map(node => 
            node.id === nodeId 
                ? { 
                    ...node, 
                    data: { 
                        ...node.data, 
                        title: `${node.data.title} (Generating...)` 
                    } 
                } 
                : node
        ));
        
        try {
            // Find the node and get its data
            const node = nodes.find(n => n.id === nodeId);
            if (!node) {
                console.error(`Node with ID ${nodeId} not found`);
                throw new Error(`Node with ID ${nodeId} not found`);
            }
            
            const nodeData = node.data;
            const componentId = nodeData.componentId;
            
            console.log(`Node found: ${nodeId}, componentId=${componentId}`);
            
            if (!componentId) {
                console.error('Component ID not found for this table');
                throw new Error('Component ID not found for this table');
            }
            
            // Get the visible rows and allRows from node data
            const visibleRows: TableRowData[] = nodeData.rows || [];
            const allRows: TableRowData[] = nodeData.allRows || visibleRows;
            const isMinimized = nodeData.isMinimized || false;
            
            console.log(`Table state: isMinimized=${isMinimized}, visibleRows=${visibleRows.length}, allRows=${allRows.length}`);
            
            // Validate row index
            if (rowIndex < 0 || rowIndex >= visibleRows.length) {
                console.error(`Row index ${rowIndex} is out of bounds (0-${visibleRows.length-1})`);
                throw new Error(`Row index ${rowIndex} is out of bounds`);
            }
            
            // Get the row data for the clicked row
            const rowData = visibleRows[rowIndex];
            console.log(`Found row at index ${rowIndex} in visible rows:`, rowData);
            
            // If minimized, find the actual index in allRows for reference
            let effectiveRowIndex = rowIndex;
            if (isMinimized) {
                const foundIndex = allRows.findIndex(r => r.id === rowData.id);
                if (foundIndex >= 0) {
                    effectiveRowIndex = foundIndex;
                    console.log(`Row's actual index in allRows: ${effectiveRowIndex}`);
                }
            }
            
            // Get the UIID from the row data
            const rowUiid = rowData.uiid || rowData.id;
            
            // Verify which row we're processing
            console.log(`GENERATING FOR ROW ${rowIndex} (effective ${effectiveRowIndex}):`);
            console.log(`Row name: ${rowData.name}`);
            console.log(`Row UIID: ${rowUiid}`);
            console.log(`Original data:`, rowData.originalData);
            
            // Prepare text to send to LLM
            const text = `
                Item Name: ${rowData.name}
                Description: ${rowData.desc || ''}
                Additional Context: This is from the ${nodeData.title} table.
                Row Index: ${effectiveRowIndex}
                Row UIID: ${rowUiid}
            `;
            
            console.log(`Calling LLM service with componentId=${componentId}, projectId=${projectId}, parent_uiid=${rowUiid}`);
            const response = await LlmService.processWithLlm(
                componentId.split('_').slice(0, 2).join('_'),
                text,
                projectId,
                true, // Save to database
                (update: string) => {
                    console.log("LLM progress update:", update);
                },
                rowUiid // Pass the UIID as parent_uiid
            );
            
            console.log("LLM response received:", response);
            if (response.result) {
                console.log("LLM result:", response.result.substring(0, 200) + "...");
            }
            console.log("Backend-generated UIIDs:", response.generated_uiids || []);
            addTerminalLog(`Requirements generated successfully. Generated ${response.generated_uiids?.length || 0} new items`);
            
            // Show success feedback
            const originalTitle = nodeData.title;
            setNodes(nodes.map(node => 
                node.id === nodeId 
                    ? { 
                        ...node, 
                        data: { 
                            ...node.data, 
                            title: `${originalTitle} (Requirements Generated!)` 
                        } 
                    } 
                    : node
            ));
            
            // Re-fetch data to show updated requirements
            console.log("Refreshing data to show new requirements");
            addTerminalLog('Refreshing canvas to show new requirements');
            await fetchData();
            
            // Reset title after delay
            setTimeout(() => {
                setNodes(nodes => nodes.map(node => 
                    node.id === nodeId 
                        ? { 
                            ...node, 
                            data: { 
                                ...node.data, 
                                title: originalTitle
                            } 
                        } 
                        : node
                ));
            }, 3000);
            
        } catch (error: any) {
            console.error('Error generating requirements:', error);
            setError(`Failed to generate requirements: ${error.message || 'Unknown error'}`);
            addTerminalLog(`Error generating requirements: ${error.message || 'Unknown error'}`);
            
            // Reset nodes to original state
            await fetchData();
        } finally {
            setGenerateLoading(false);
        }
    };

    // Build requirements object by traversing the hierarchy
    const buildRequirementsObject = async (llrUiid: string, llrData: TableRowData, nodeData: any, nodeId: string) => {
        const requirements: any = {
            user_flow: {},
            high_level_requirements: {},
            low_level_requirements: {},
            test_cases: {}
        };
        
        try {
            console.log('LLR Data:', llrData);
            console.log('Node Data:', nodeData);
            console.log('Building requirements for LLR:', llrUiid, llrData.name);
            
            // Step 1: Add the selected LLR
            const llr = llrData.originalData || llrData;
            requirements.low_level_requirements = {
                uiid: llrUiid,
                name: llrData.name,
                description: llrData.desc || '',
                parent_uiid: llr.parent_uiid
            };
            
            console.log('Step 1 - Added LLR:', llrUiid, llrData.name);
            console.log('LLR parent_uiid:', llr.parent_uiid);
            
            // Step 2: Get Test Cases from LLR's test_case_list
            const testCasesForLlr: any[] = [];
            
            console.log(`Getting test cases from LLR's test_case_list for ${llrUiid}`);
            console.log(`LLR original data:`, llr);
            
            if (llr.test_case_list && Array.isArray(llr.test_case_list)) {
                console.log(`Found ${llr.test_case_list.length} test cases in LLR's test_case_list`);
                
                llr.test_case_list.forEach((testCase: any) => {
                    console.log(`Processing test case from LLR: ${testCase.uiid} - ${testCase.name}`);
                    
                    testCasesForLlr.push({
                        uiid: testCase.uiid,
                        name: testCase.name,
                        description: testCase.description || '',
                        parent_uiid: testCase.parent_uiid
                    });
                    console.log(`✅ Added test case: ${testCase.uiid} - ${testCase.name}`);
                });
            } else {
                console.log('No test_case_list found in LLR original data');
            }
            
            requirements.test_cases = testCasesForLlr;
            console.log(`Step 2 - Found ${testCasesForLlr.length} Test Cases for LLR ${llrUiid}`);
            
            // Step 3: Find HLR where LLR.parent_uiid == HLR.uiid
            const hlrNodes = nodes.filter(n => n.id.startsWith('highlevelrequirement_'));
            let parentHlr: any = null;
            
            hlrNodes.forEach(hlrNode => {
                const hlrData = hlrNode.data;
                const hlrRows = hlrData.allRows || hlrData.rows || [];
                
                            hlrRows.forEach((hlr: any) => {
                const hlrUiid = hlr.uiid || hlr.id;
                console.log(`Checking HLR ${hlrUiid}: uiid=${hlrUiid}, LLR.parent_uiid=${llr.parent_uiid}`);
                console.log(`HLR data:`, hlr);
                
                if (llr.parent_uiid === hlrUiid) {
                    parentHlr = hlr;
                    console.log(`✅ Found parent HLR: ${hlrUiid} - ${hlr.name}`);
                }
            });
            });
            
            if (parentHlr) {
                const hlrUiid = parentHlr.uiid || parentHlr.id;
                console.log('HLR full data:', parentHlr);
                console.log('HLR parent_uiid from data:', parentHlr.originalData.parent_uiid);
                
                requirements.high_level_requirements = {
                    uiid: hlrUiid,
                    name: parentHlr.name,
                    description: parentHlr.desc || '',
                    parent_uiid: parentHlr.originalData.parent_uiid || null
                };
                console.log(`Step 3 - Added HLR: ${hlrUiid} - ${parentHlr.name}`);
                console.log('HLR parent_uiid:', parentHlr.originalData.parent_uiid);
            } else {
                console.log('❌ No parent HLR found for LLR:', llrUiid);
            }
            
            // Step 4: Find User Flow where HLR.parent_uiid == User_Flow.uiid
            let parentFlow: any = null;
            if (parentHlr && parentHlr.originalData.parent_uiid) {
                // First try to find in the userFlows state (from API)
                parentFlow = userFlows.find(flow => flow.uiid === parentHlr.originalData.parent_uiid);
                
                if (parentFlow) {
                    console.log(`✅ Found parent User Flow in userFlows: ${parentFlow.uiid} - ${parentFlow.name}`);
                } else {
                    // Fallback: try to find in flow nodes
                    const flowNodes = nodes.filter(n => n.id.startsWith('flow_genChildReq_'));
                    
                    flowNodes.forEach(flowNode => {
                        const flowData = flowNode.data;
                        const flowRows = flowData.allRows || flowData.rows || [];
                        
                        flowRows.forEach((flow: any) => {
                            const flowUiid = flow.uiid || flow.id;
                            console.log(`Checking User Flow ${flowUiid}: uiid=${flowUiid}, HLR.parent_uiid=${parentHlr.parent_uiid}`);
                            
                            if (parentHlr.parent_uiid === flowUiid) {
                                parentFlow = flow;
                                console.log(`✅ Found parent User Flow in nodes: ${flowUiid} - ${flow.name}`);
                            }
                        });
                    });
                }
                
                if (parentFlow) {
                    const flowUiid = parentFlow.uiid || parentFlow.id;
                    requirements.user_flow = {
                        uiid: flowUiid,
                        name: parentFlow.name,
                        description: parentFlow.desc || parentFlow.description || '',
                        parent_uiid: parentFlow.parent_uiid
                    };
                    console.log(`Step 4 - Added User Flow: ${flowUiid} - ${parentFlow.name}`);
                } else {
                    console.log('❌ No parent User Flow found for HLR:', parentHlr.uiid);
                    console.log('HLR parent_uiid:', parentHlr.parent_uiid);
                    console.log('Available userFlows:', userFlows.map(f => ({ uiid: f.uiid, name: f.name })));
                }
            } else {
                console.log('❌ Cannot find User Flow: HLR has no parent_uiid');
                console.log('HLR data:', parentHlr);
            }
            
            console.log('Final requirements object:', requirements);
            console.log(`Summary: LLR=${llrUiid}, HLR=${parentHlr ? parentHlr.uiid : 'Not found'}, User Flow=${parentFlow ? parentFlow.uiid : 'Not found'}, Test Cases=${testCasesForLlr.length}`);
            console.log('Available userFlows:', userFlows.map(f => ({ uiid: f.uiid, name: f.name })));
            console.log('All nodes:', nodes.map(n => ({ id: n.id, type: n.type })));
            
            return requirements;
            
        } catch (error) {
            console.error('Error building requirements object:', error);
            return requirements;
        }
    };

    // Build feature for test cases
    const handleBuildFeature = async (nodeId: string, rowIndex: number): Promise<void> => {
        if (!projectId) {
            console.error("Cannot build feature: No project ID");
            setError("Cannot build feature: No project ID");
            return;
        }
        
        console.log(`Building feature for nodeId=${nodeId}, rowIndex=${rowIndex}, projectId=${projectId}`);
        setGenerateLoading(true);
        setError(null);
        addTerminalLog(`Building feature for nodeId=${nodeId}, rowIndex=${rowIndex}, projectId=${projectId}`);
        
        // Show loading state in the node
        setNodes(nodes.map(node => 
            node.id === nodeId 
                ? { 
                    ...node, 
                    data: { 
                        ...node.data, 
                        title: `${node.data.title} (Building Feature...)` 
                    } 
                } 
                : node
        ));
        
        try {
            // Find the node and get its data
            const node = nodes.find(n => n.id === nodeId);
            if (!node) {
                console.error(`Node with ID ${nodeId} not found`);
                throw new Error(`Node with ID ${nodeId} not found`);
            }
            
            const nodeData = node.data;
            const componentId = nodeData.componentId;
            
            console.log(`Node found: ${nodeId}, componentId=${componentId}`);
            
            if (!componentId) {
                console.error('Component ID not found for this table');
                throw new Error('Component ID not found for this table');
            }
            
            // Get the visible rows and allRows from node data
            const visibleRows: TableRowData[] = nodeData.rows || [];
            const allRows: TableRowData[] = nodeData.allRows || visibleRows;
            const isMinimized = nodeData.isMinimized || false;
            
            console.log(`Table state: isMinimized=${isMinimized}, visibleRows=${visibleRows.length}, allRows=${allRows.length}`);
            
            // Validate row index
            if (rowIndex < 0 || rowIndex >= visibleRows.length) {
                console.error(`Row index ${rowIndex} is out of bounds (0-${visibleRows.length-1})`);
                throw new Error(`Row index ${rowIndex} is out of bounds`);
            }
            
            // Get the row data for the clicked row
            const rowData = visibleRows[rowIndex];
            console.log(`Found row at index ${rowIndex} in visible rows:`, rowData);
            
            // If minimized, find the actual index in allRows for reference
            let effectiveRowIndex = rowIndex;
            if (isMinimized) {
                const foundIndex = allRows.findIndex(r => r.id === rowData.id);
                if (foundIndex >= 0) {
                    effectiveRowIndex = foundIndex;
                    console.log(`Row's actual index in allRows: ${effectiveRowIndex}`);
                }
            }
            
            // Get the UIID from the row data
            const rowUiid = rowData.uiid || rowData.id;
            
            // Verify which row we're processing
            console.log(`BUILDING FEATURE FOR ROW ${rowIndex} (effective ${effectiveRowIndex}):`);
            console.log(`Row name: ${rowData.name}`);
            console.log(`Row UIID: ${rowUiid}`);
            console.log(`Original data:`, rowData.originalData);
            
            // Start contract building process
            setContractBuilding(true);
            
            // Set up communication session thread for this build feature request
            commManager.setSessionThread(rowUiid);
            
            // Add user message to chat showing the build request FIRST
            const userMessage = {
                id: `user-${Date.now()}`,
                type: 'user' as const,
                content: `🚀 Build Feature Request Initiated`,
                timestamp: new Date()
            };
            setChatMessages(prev => [...prev, userMessage]);

            setTimeout(() => {}, 1000);
            
            // Add building message to chat
            const buildingMessage = {
                id: `contract-building-${Date.now()}`,
                type: 'assistant' as const,
                content: 'Building Contract... ⏳',
                timestamp: new Date(),
                isContract: false
            };
            setChatMessages(prev => [...prev, buildingMessage]);
            
            // Generate the build contract for Docker
            const buildContract = await generateBuildContract(rowUiid, rowData, nodeData, nodeId);
            
            if (!buildContract) {
                throw new Error('Failed to generate build contract');
            }
            
            // Add the contract message to chat
            const contractMessage = {
                id: `contract-${Date.now()}`,
                type: 'assistant' as const,
                content: `📄 Contract: Generated Successfully`,
                timestamp: new Date(),
                isContract: true,
                contractData: buildContract
            };
            setChatMessages(prev => [...prev, contractMessage]);
            
            // Log the current chat state to help debug panel closing issues
            console.log('Contract message added to chat. Current chat messages count:', chatMessages.length + 1);
            console.log('Contract message details:', contractMessage);
            console.log('AI Chat panel should remain open. Current right panel state:', isRightPanelOpen);
            
            // Ensure the AI Chat panel remains open by logging a clear message
            console.log('🚀 BUILD FEATURE COMPLETED: AI Chat panel should remain open for user interaction');
            console.log('📋 Contract is available in chat messages. User can view and send to VishCoder.');
            
            addTerminalLog(`✅ Generated build contract for Docker with ${Object.keys(buildContract.requirements).length} requirement types`);
            addTerminalLog(`📋 Contract includes: LLR=${(buildContract.requirements.low_level_requirements as any)?.name || 'N/A'}, HLR=${(buildContract.requirements.high_level_requirements as any)?.name || 'N/A'}, User Flow=${(buildContract.requirements.user_flow as any)?.name || 'N/A'}, Test Cases=${Array.isArray(buildContract.requirements.test_cases) ? buildContract.requirements.test_cases.length : 0}`);
            addTerminalLog(`📄 Full contract logged to console for Docker processing`);
            
            // Get requirements object for tech_stack
            const requirementsObject = await buildRequirementsObject(rowUiid, rowData, nodeData, nodeId);
            
            // Contract building completed
            setContractBuilding(false);
            
            // Ensure we don't interfere with the AI Chat panel state
            console.log('Contract building state set to false. AI Chat panel should remain open.');
            console.log('Current right panel open state:', isRightPanelOpen);
            console.log('Current chat messages count:', chatMessages.length);
            
            // Create the request JSON object
            const requestId = crypto.randomUUID();
            const timestamp = new Date().toISOString();
            
            const buildFeatureRequest = {
                request_id: requestId,
                timestamp: timestamp,
                payload: {
                    user_flow: buildContract.requirements.user_flow,
                    high_level_requirement: buildContract.requirements.high_level_requirements,
                    low_level_requirement: buildContract.requirements.low_level_requirements,
                    test_cases: buildContract.requirements.test_cases,
                    tech_stack: requirementsObject.tech_stack
                },
                user_input: "",
                metadata: {
                    request_type: "code_generation",
                    github: (() => {
                        try {
                            const savedSettings = localStorage.getItem('appSettings');
                            if (savedSettings) {
                                const settings = JSON.parse(savedSettings);
                                return {
                                    repo: settings.github?.repo || "",
                                    branch: settings.github?.branch || "",
                                    pr: null
                                };
                            }
                        } catch (error) {
                            console.error('Failed to load GitHub settings:', error);
                        }
                        return {
                            repo: "",
                            branch: "",
                            pr: null
                        };
                    })()
                }
            };
            
            console.log('Build Feature Request:', buildFeatureRequest);
            addTerminalLog(`Created build feature request with ID: ${requestId}`);
            
            // Note: Contract is now available in the chat panel
            // User can manually open the right panel to view it
            // IMPORTANT: AI Chat panel should remain open and not be automatically closed
            
            addTerminalLog(`✅ Contract building completed successfully`);
            addTerminalLog(`📋 Contract is now available in the chat panel`);
            addTerminalLog(`💡 TIP: The AI Chat panel should remain open. You can view the contract and send it to VishCoder.`);
            
            // Show success feedback
            const originalTitle = nodeData.title;
            setNodes(nodes.map(node => 
                node.id === nodeId 
                    ? { 
                        ...node, 
                        data: { 
                            ...node.data, 
                            title: `${originalTitle} (Feature Request Sent!)` 
                        } 
                    } 
                    : node
            ));
            
            // Reset title after delay
            setTimeout(() => {
                setNodes(nodes => nodes.map(node => 
                    node.id === nodeId 
                        ? { 
                            ...node, 
                            data: { 
                                ...node.data, 
                                title: originalTitle
                            } 
                        } 
                        : node
                ));
            }, 3000);
            
        } catch (error: any) {
            console.error('Error building feature:', error);
            setError(`Failed to build feature: ${error.message || 'Unknown error'}`);
            addTerminalLog(`Error building feature: ${error.message || 'Unknown error'}`);
        } finally {
            setGenerateLoading(false);
        }
    };

    // Panel toggle functions
    const toggleLeftPanel = useCallback(() => {
        console.log('CanvasViewer: toggleLeftPanel called');
        if (onToggleSidebar) {
            console.log('CanvasViewer: calling onToggleSidebar');
            onToggleSidebar();
        } else {
            console.log('CanvasViewer: onToggleSidebar is not provided');
        }
    }, [onToggleSidebar]);

    const toggleBottomPanel = useCallback(() => {
        if (onToggleBottomPanel) {
            onToggleBottomPanel();
        }
    }, [onToggleBottomPanel]);

    const toggleRightPanel = useCallback(() => {
        if (onToggleRightPanel) {
            onToggleRightPanel();
        }
    }, [onToggleRightPanel]);

    // Add log to terminal
    const addTerminalLog = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setTerminalLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    }, []);

    // Helper function to handle PR information from VishCoder
    const handlePRInformation = useCallback((prUrl: string, prNumber: number, agent: string, llm: string, details: string, progress: number | null) => {
        console.log(`🚀 PR created by VishCoder: ${prUrl} (PR #${prNumber})`);
        
        // Initialize build summary data if it doesn't exist
        if (!buildSummaryData) {
            const newBuildSummaryData = {
                lowLevelRequirementId: `req_${Date.now()}_${Math.floor(Math.random() * 1000000)}`,
                status: 'PR',
                branchLink: '', // Will be populated when branch info is available
                prLink: prUrl,
                documentLinks: [],
                keyMetrics: 'Response time < 200ms, 99.9% uptime, Error rate < 0.1%',
                dashboardLinks: [],
                alerts: '',
                logs: '',
                productManager: '',
                devManager: ''
            };
            setBuildSummaryData(newBuildSummaryData);
            console.log('📋 New build summary created for PR:', newBuildSummaryData);
        } else {
            // Update existing build summary data
            setBuildSummaryData(prev => prev ? {
                ...prev,
                prLink: prUrl,
                status: 'PR'
            } : null);
        }
        
        // Add a special notification about the PR
        const prNotificationMessage = {
            id: `pr-notification-${Date.now()}`,
            type: 'status' as const,
            content: `🚀 Pull Request #${prNumber} created successfully! Click the PR link to review and approve.`,
            agent: agent,
            llm: llm,
            progress: progress,
            timestamp: new Date(),
            isContract: false
        };
        setChatMessages(prev => [...prev, prNotificationMessage]);
        
        // Log to terminal
        addTerminalLog(`🚀 PR #${prNumber} created: ${prUrl}`);
    }, [buildSummaryData, setChatMessages, addTerminalLog]);

    // Communication Protocol Handler - uses the centralized comm.ts module
    // This replaces the old generateVishCoderPayload function with the standardized approach
    // All payloads now use the new 'body' structure and proper session management

    // Handle AI chat
    const handleAiChat = useCallback(async () => {
        if (!agentInput.trim() || agentProcessing || !agentSocket || agentSocket.readyState !== WebSocket.OPEN) return;
        
        const userMessage = agentInput.trim();
        setAgentInput('');
        setAgentProcessing(true);
        
        // Add user message to chat
        const userMsg = {
            id: `user-${Date.now()}`,
            type: 'user' as const,
            content: userMessage,
            timestamp: new Date()
        };
        setChatMessages(prev => [...prev, userMsg]);
        
        // Create standardized payload for AI chat using commManager
        const messagePayload = createMessagePayload(userMessage);
        const aiChatPayload = commManager.createVishmakerPayload('question_to_ai', 'User', messagePayload);
        
        // Send via WebSocket
        agentSocket.send(JSON.stringify(aiChatPayload));
        
        addTerminalLog(`💬 AI Chat: Sent question to VishCoder: "${userMessage}"`);
    }, [agentInput, agentProcessing, agentSocket, addTerminalLog]);

    // Send chat message
    const sendChatMessage = useCallback(async (message: string) => {
        if (!message.trim()) return;

        const userMessage = {
            id: `user-${Date.now()}`,
            type: 'user' as const,
            content: message,
            timestamp: new Date()
        };

        setChatMessages(prev => [...prev, userMessage]);
        setChatInput('');
        setChatLoading(true);

        try {
            // TODO: Replace with actual chat API call
            // const response = await apiClient('/chat', {
            //     method: 'POST',
            //     body: { message, projectId }
            // });

            // Simulate chat response for now
            setTimeout(() => {
                const assistantMessage = {
                    id: `assistant-${Date.now()}`,
                    type: 'assistant' as const,
                    content: `I received your message: "${message}". This is a placeholder response.`,
                    timestamp: new Date()
                };
                setChatMessages(prev => [...prev, assistantMessage]);
                setChatLoading(false);
            }, 1000);

        } catch (error) {
            console.error('Chat error:', error);
            setChatLoading(false);
        }
    }, []);

    // Handle chat input key press
    const handleChatKeyPress = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage(chatInput);
        }
    }, [chatInput, sendChatMessage]);

    // WebSocket connection for Docker logs
    const connectToLogStream = useCallback(() => {
        if (logSocket) {
            logSocket.close();
        }

        const socket = new WebSocket("wss://vishmaker.com/ws/logs");
        
        socket.onopen = () => {
            setLogConnected(true);
            setDockerLogs("Log stream connected. Waiting for logs...\n");
            addTerminalLog('Docker log stream connected');
        };

        socket.onmessage = (event) => {
            const newLogs = event.data;
            const processedNewLogs = processDockerLogs(newLogs);
            
            setDockerLogs(prev => {
                const combinedLogs = prev + processedNewLogs;
                // Limit logs to last 200 lines before processing
                const limitedLogs = limitLogsToLastNLines(combinedLogs, 200);
                const processedCombinedLogs = processDockerLogs(limitedLogs);
                setProcessedLogs(processedCombinedLogs);
                return limitedLogs;
            });
            
            // Auto-scroll to bottom
            setTimeout(() => {
                const terminal = document.getElementById('docker-terminal');
                if (terminal) {
                    terminal.scrollTop = terminal.scrollHeight;
                }
            }, 100);
        };

        socket.onerror = (error) => {
            setLogConnected(false);
            setDockerLogs(prev => {
                const updatedLogs = prev + "\n--- CONNECTION ERROR ---\nCould not connect to the log stream. Is the backend running?\n";
                return limitLogsToLastNLines(updatedLogs, 200);
            });
            addTerminalLog('Docker log stream connection error');
        };

        socket.onclose = () => {
            setLogConnected(false);
            setDockerLogs(prev => {
                const updatedLogs = prev + "\n--- DISCONNECTED ---\nLog stream has been closed.\n";
                return limitLogsToLastNLines(updatedLogs, 200);
            });
            addTerminalLog('Docker log stream disconnected');
        };

        setLogSocket(socket);
    }, [logSocket, addTerminalLog, logConnected]);

    // Disconnect from log stream
    const disconnectFromLogStream = useCallback(() => {
        if (logSocket) {
            logSocket.close();
            setLogSocket(null);
            setLogConnected(false);
            addTerminalLog('Docker log stream disconnected manually');
        }
    }, [logSocket, addTerminalLog]);

    // Auto-scroll to bottom of Docker logs
    useEffect(() => {
        const terminalElement = document.getElementById('docker-terminal');
        if (terminalElement) {
            terminalElement.scrollTop = terminalElement.scrollHeight;
        }
    }, [dockerLogs]);

    // Periodically clean up logs to ensure they don't exceed 200 lines
    useEffect(() => {
        if (dockerLogs && dockerLogs.split('\n').filter(line => line.trim()).length > 200) {
            const limitedLogs = limitLogsToLastNLines(dockerLogs, 200);
            setDockerLogs(limitedLogs);
            const processedLimitedLogs = processDockerLogs(limitedLogs);
            setProcessedLogs(processedLimitedLogs);
            
            // Add a notification that logs were truncated
            addTerminalLog('Docker logs truncated to last 200 lines');
        }
    }, [dockerLogs, limitLogsToLastNLines, processDockerLogs, addTerminalLog]);

    // Connect to log stream when bottom panel opens
    useEffect(() => {
        if (bottomPanelOpen && !logSocket) {
            connectToLogStream();
        } else if (!bottomPanelOpen && logSocket) {
            disconnectFromLogStream();
        }
    }, [bottomPanelOpen, logSocket, connectToLogStream, disconnectFromLogStream]);

    // Cleanup WebSocket on component unmount
    useEffect(() => {
        return () => {
            if (logSocket) {
                logSocket.close();
            }
        };
    }, [logSocket]);

    // AI Agent WebSocket connection
    const connectToAgent = useCallback(() => {
        console.log('connectToAgent called, current agentSocket:', agentSocket);
        if (agentSocket) {
            console.log('Closing existing agentSocket');
            agentSocket.close();
        }

        console.log('Creating new WebSocket connection to wss://vishmaker.com/ws');
        const socket = new WebSocket("wss://vishmaker.com/ws");
        
        socket.onopen = () => {
            console.log('AI Agent WebSocket onopen event fired');
            setAgentConnected(true);
            setAgentStatus('Connected and Idle');
            setAgentLogs('<div><span class="badge log-system">SYSTEM</span><strong>Connection Opened. Ready to receive requests.</strong></div>');
            addTerminalLog('AI agent connected');
            console.log('AI Agent WebSocket connected successfully, agentConnected set to true');
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                let logClass = 'log-system';
                let content = '';

                // Parse and validate the response using commManager
                // Note: Heartbeat messages are automatically filtered out to prevent "Unknown Agent" errors
                const parsedResponse = commManager.parseResponse(data);
                if (!parsedResponse) {
                    console.error('Invalid response format from VishCoder:', data);
                    addTerminalLog('❌ Received invalid response format from VishCoder');
                    return;
                }

                // Ignore heartbeat messages - they don't contain meaningful information for the user
                if (parsedResponse.type === 'heartbeat' as any) {
                    console.log('Received heartbeat from VishCoder - ignoring');
                    addTerminalLog('💓 Heartbeat received from VishCoder (ignored)');
                    return;
                }

                // Log all non-heartbeat messages for debugging
                console.log('Processing message from VishCoder:', {
                    type: parsedResponse.type,
                    actor: parsedResponse.actor,
                    hasStatusDetails: !!parsedResponse.body.statusDetails,
                    statusDetailsKeys: parsedResponse.body.statusDetails ? Object.keys(parsedResponse.body.statusDetails) : []
                });

                // Handle standardized messages from VishCoder using parsed response
                if (parsedResponse.type === 'build_feature') {
                    if (parsedResponse.actor === 'Coder') {
                        // Response from VishCoder for build feature request
                        if (parsedResponse.status === 'InProgress') {
                            addTerminalLog('📥 Build feature request received by VishCoder');
                            setAgentStatus('Build feature request received by VishCoder');
                            
                            // Add message to chat
                            const contractReceivedMessage = {
                                id: `contract-received-${Date.now()}`,
                                type: 'assistant' as const,
                                content: '📥 Build feature request received by VishCoder. Processing started...',
                                timestamp: new Date(),
                                isContract: false
                            };
                            setChatMessages(prev => [...prev, contractReceivedMessage]);
                            
                        } else if (parsedResponse.status === 'Completed') {
                            // Contract processing completed
                            addTerminalLog('✅ Build feature processing completed by VishCoder');
                            setAgentStatus('Build feature processing completed');
                            
                            // Add completion message to chat
                            const contractCompletedMessage = {
                                id: `contract-completed-${Date.now()}`,
                                type: 'assistant' as const,
                                content: '✅ Build feature processing completed by VishCoder!',
                                timestamp: new Date(),
                                isContract: false
                            };
                            setChatMessages(prev => [...prev, contractCompletedMessage]);
                            
                            setAgentProcessing(false);
                        } else if (parsedResponse.status === 'Failed' || parsedResponse.status === 'Error') {
                            // Contract processing error
                            const errorMsg = parsedResponse.body.messages.error || parsedResponse.body.messages.message || 'Unknown error';
                            addTerminalLog(`❌ Build feature processing error: ${errorMsg}`);
                            setAgentStatus('Build feature processing failed');
                            
                            // Add error message to chat
                            const contractErrorMessage = {
                                id: `contract-error-${Date.now()}`,
                                type: 'assistant' as const,
                                content: `❌ Build feature processing failed: ${errorMsg}`,
                                timestamp: new Date(),
                                isContract: false
                            };
                            setChatMessages(prev => [...prev, contractErrorMessage]);
                            
                            setAgentProcessing(false);
                        }
                        
                        // Handle status_details from VishCoder for all build_feature responses
                        if (parsedResponse.body.contract.statusDetails) {
                            const statusDetails = parsedResponse.body.contract.statusDetails;
                            const agent = statusDetails.agent || 'Unknown Agent';
                            const llm = statusDetails.LLM || 'Unknown LLM';
                            const details = statusDetails.details || 'No details provided';
                            const progress = statusDetails.progress || null;
                            
                            // Convert details to string if it's an object
                            let detailsString: string;
                            if (typeof details === 'object' && details !== null) {
                                if (details.file_name && details.file_type) {
                                    detailsString = `${details.file_type} file: ${details.file_name}`;
                                    if (details.file_size) {
                                        detailsString += ` (${details.file_size} bytes)`;
                                    }
                                } else {
                                    detailsString = JSON.stringify(details);
                                }
                            } else {
                                detailsString = String(details);
                            }
                            
                            // Check for PR information in the status details
                            const prUrl = statusDetails.pr_url;
                            const prNumber = statusDetails.pr_number;
                            
                            // If PR information is available, update the build summary data
                            if (prUrl && prNumber) {
                                handlePRInformation(prUrl, prNumber, agent, llm, detailsString, progress);
                            }
                            
                            // Check if this is the first "Manager" message - show it as a regular message
                            const isManagerInitial = agent === 'Manager' && detailsString.includes('Thanks for sending the request');
                            
                            // Check if Manager is indicating build is complete
                            const isBuildComplete = agent === 'Manager' && (
                                detailsString.toLowerCase().includes('build complete') ||
                                detailsString.toLowerCase().includes('build is complete') ||
                                detailsString.toLowerCase().includes('build completed') ||
                                detailsString.toLowerCase().includes('build finished') ||
                                detailsString.toLowerCase().includes('build done')
                            );
                            
                            // Backup logic: Check if progress reaches 100% (regardless of agent or message)
                            const isProgressComplete = progress !== null && progress >= 100;
                            
                            // Show BUILD SUMMARY if either condition is met
                            const shouldShowBuildSummary = isBuildComplete || isProgressComplete;
                            
                            // Add status message to chat (but skip heartbeat-related content)
                            if (detailsString.toLowerCase().includes('heartbeat') || detailsString.toLowerCase().includes('main websocket connection')) {
                                console.log('Skipping heartbeat-related status message:', detailsString);
                                return;
                            }
                            
                            let messageContent = detailsString;
                            
                            // If build is complete, add BUILD SUMMARY link
                            if (shouldShowBuildSummary) {
                                const reason = isBuildComplete ? 'Manager indicated build complete' : 'Progress reached 100%';
                                messageContent = `${detailsString}\n\n🔗 **BUILD SUMMARY** - [Click here to view build details](#build-summary)\n\n*Triggered by: ${reason}*`;
                                console.log(`🚀 Build complete detected - adding BUILD SUMMARY link (${reason})`);
                                
                                // Automatically open build summary modal after a short delay
                                setTimeout(() => {
                                    setIsBuildSummaryModalOpen(true);
                                    addTerminalLog('📋 Automatically opening BUILD SUMMARY modal');
                                }, 2000); // 2 second delay to let user see the message first
                            }
                            
                            const statusUpdateMessage = {
                                id: `status-update-${Date.now()}`,
                                type: isManagerInitial ? 'assistant' as const : 'status' as const,
                                content: isManagerInitial ? `${agent}(${llm}) : ${messageContent}` : messageContent,
                                agent: isManagerInitial ? undefined : agent,
                                llm: isManagerInitial ? undefined : llm,
                                progress: progress,
                                timestamp: new Date(),
                                isContract: false
                            };
                            setChatMessages(prev => [...prev, statusUpdateMessage]);
                            
                            // Also log to terminal
                            addTerminalLog(`📊 Status Update: ${agent}(${llm}) : ${detailsString}`);
                        }
                    }
                }
                
                // Handle AI chat responses from VishCoder
                if (parsedResponse.type === 'question_to_ai') {
                    if (parsedResponse.actor === 'Coder') {
                        // AI response from VishCoder
                        const responseText = parsedResponse.body.messages.response_text || parsedResponse.body.messages.response || 'Received response from VishCoder';
                        const aiResponse = {
                            id: `ai-${Date.now()}`,
                            type: 'assistant' as const,
                            content: responseText,
                            timestamp: new Date()
                        };
                        setChatMessages(prev => [...prev, aiResponse]);
                        setAgentProcessing(false);
                        
                        addTerminalLog('💬 AI Chat: Received response from VishCoder');
                    }
                }
                
                // Handle status updates
                if (parsedResponse.type === 'status_update') {
                    if (parsedResponse.actor === 'Coder') {
                        // Check if statusDetails is available in the body
                        if (parsedResponse.body.statusDetails) {
                            const statusDetails = parsedResponse.body.statusDetails;
                            const agent = statusDetails.agent || 'Unknown Agent';
                            const llm = statusDetails.LLM || 'Unknown LLM';
                            const details = statusDetails.details || 'No details provided';
                            const progress = statusDetails.progress || null;
                            
                            // Convert details to string if it's an object
                            let detailsString: string;
                            if (typeof details === 'object' && details !== null) {
                                const detailsObj = details as Record<string, any>;
                                if (detailsObj.file_name && detailsObj.file_type) {
                                    detailsString = `${detailsObj.file_type} file: ${detailsObj.file_name}`;
                                    if (detailsObj.file_size) {
                                        detailsString += ` (${detailsObj.file_size} bytes)`;
                                    }
                                } else {
                                    detailsString = JSON.stringify(details);
                                }
                            } else {
                                detailsString = String(details);
                            }
                            
                            // Check for PR information in the status details - use optional chaining
                            const prUrl = statusDetails.pr_url;
                            const prNumber = statusDetails.pr_number;
                            
                            // If PR information is available, update the build summary data
                            if (prUrl && prNumber) {
                                handlePRInformation(prUrl, prNumber, agent, llm, detailsString, progress);
                            }
                            
                            // Check if Manager is indicating build is complete
                            const isBuildComplete = agent === 'Manager' && (
                                detailsString.toLowerCase().includes('build complete') ||
                                detailsString.toLowerCase().includes('build is complete') ||
                                detailsString.toLowerCase().includes('build completed') ||
                                detailsString.toLowerCase().includes('build finished') ||
                                detailsString.toLowerCase().includes('build done')
                            );
                            
                            // Backup logic: Check if progress reaches 100% (regardless of agent or message)
                            const isProgressComplete = progress !== null && progress >= 100;
                            
                            // Show BUILD SUMMARY if either condition is met
                            const shouldShowBuildSummary = isBuildComplete || isProgressComplete;
                            
                            // Add status message to chat as a log entry (but skip heartbeat-related content)
                            if (detailsString.toLowerCase().includes('heartbeat') || detailsString.toLowerCase().includes('main websocket connection')) {
                                console.log('Skipping heartbeat-related status message:', detailsString);
                                return;
                            }
                            
                            let messageContent = detailsString;
                            
                            // If build is complete, add BUILD SUMMARY link
                            if (shouldShowBuildSummary) {
                                const reason = isBuildComplete ? 'Manager indicated build complete' : 'Progress reached 100%';
                                messageContent = `${detailsString}\n\n🔗 **BUILD SUMMARY** - [Click here to view build details](#build-summary)\n\n*Triggered by: ${reason}*`;
                                console.log(`🚀 Build complete detected in status_update - adding BUILD SUMMARY link (${reason})`);
                                
                                // Automatically open build summary modal after a short delay
                                setTimeout(() => {
                                    setIsBuildSummaryModalOpen(true);
                                    addTerminalLog('📋 Automatically opening BUILD SUMMARY modal from status update');
                                }, 2000); // 2 second delay to let user see the message first
                            }
                            
                            const statusUpdateMessage = {
                                id: `status-update-${Date.now()}`,
                                type: 'status' as const,
                                content: messageContent,
                                agent: agent,
                                llm: llm,
                                progress: progress,
                                timestamp: new Date(),
                                isContract: false
                            };
                            setChatMessages(prev => [...prev, statusUpdateMessage]);
                            
                            // Update agent status and log to terminal
                            setAgentStatus(`${agent}(${llm}) : ${detailsString}`);
                            addTerminalLog(`📊 Status Update: ${agent}(${llm}) : ${detailsString}`);
                        } else {
                            // Fallback to regular message handling
                            const message = parsedResponse.body.messages?.message || 'Status updated';
                            addTerminalLog(`📊 Status Update: ${message}`);
                            setAgentStatus(message);
                        }
                    }
                }
                
                // Handle clarification requests
                if (parsedResponse.type === 'clarification_needed_from_user') {
                    if (parsedResponse.actor === 'Coder') {
                        const clarificationText = parsedResponse.body.messages.question_text || 'Clarification needed from user';
                        const clarificationMessage = {
                            id: `clarification-${Date.now()}`,
                            type: 'assistant' as const,
                            content: `❓ Clarification needed: ${clarificationText}`,
                            timestamp: new Date(),
                            isContract: false
                        };
                        setChatMessages(prev => [...prev, clarificationMessage]);
                        
                        addTerminalLog('❓ VishCoder needs clarification from user');
                    }
                }
                
                // General handler for status_details in any message from VishCoder
                // Skip heartbeat messages as they don't have meaningful status details
                if (parsedResponse.actor === 'Coder' && parsedResponse.body.statusDetails && parsedResponse.type !== ('heartbeat' as any)) {
                    const statusDetails = parsedResponse.body.statusDetails;
                    const agent = statusDetails.agent || 'Unknown Agent';
                    const llm = statusDetails.LLM || 'Unknown LLM';
                    let details = statusDetails.details || 'No details provided';
                    const progress = statusDetails.progress || null;
                    
                    // Convert details to string if it's an object
                    let detailsString: string;
                    if (typeof details === 'object' && details !== null) {
                        // Check if it looks like a file update object
                        const detailsObj = details as Record<string, any>;
                        if (detailsObj.file_name && detailsObj.file_type) {
                            detailsString = `${detailsObj.file_type} file: ${detailsObj.file_name}`;
                            if (detailsObj.file_size) {
                                detailsString += ` (${detailsObj.file_size} bytes)`;
                            }
                        } else {
                            detailsString = JSON.stringify(details);
                        }
                    } else {
                        detailsString = String(details);
                    }
                    
                    // Check for PR information in the status details
                    const prUrl = statusDetails.pr_url;
                    const prNumber = statusDetails.pr_number;
                    
                    // If PR information is available, update the build summary data
                    if (prUrl && prNumber) {
                        handlePRInformation(prUrl, prNumber, agent, llm, detailsString, progress);
                    }
                    
                    // Only add to chat if it's not already handled by specific message types
                    if (parsedResponse.type !== 'build_feature' && parsedResponse.type !== 'status_update') {
                        // Skip heartbeat-related content
                        if (detailsString.toLowerCase().includes('heartbeat') || detailsString.toLowerCase().includes('main websocket connection')) {
                            console.log('Skipping heartbeat-related general status message:', detailsString);
                            return;
                        }
                        
                        const generalStatusMessage = {
                            id: `general-status-${Date.now()}`,
                            type: 'status' as const,
                            content: detailsString,
                            agent: agent,
                            llm: llm,
                            progress: progress,
                            timestamp: new Date(),
                            isContract: false
                        };
                        setChatMessages(prev => [...prev, generalStatusMessage]);
                    }
                    
                    // Always log to terminal for debugging
                    addTerminalLog(`📊 General Status Update: ${agent}(${llm}) : ${detailsString}`);
                }

                // General progress monitoring - catch any progress that reaches 100% from any message type
                if (parsedResponse.body?.statusDetails?.progress !== null && parsedResponse.body.statusDetails.progress !== undefined && parsedResponse.body.statusDetails.progress >= 100) {
                    const progress = parsedResponse.body.statusDetails.progress;
                    const agent = parsedResponse.body.statusDetails.agent || 'Unknown Agent';
                    const llm = parsedResponse.body.statusDetails.LLM || 'Unknown LLM';
                    
                    // Only trigger if we haven't already shown the build summary for this progress update
                    if (!buildSummaryData?.prLink || buildSummaryData.status !== 'Merged') {
                        console.log(`🚀 Progress reached 100% from ${agent}(${llm}) - triggering BUILD SUMMARY`);
                        addTerminalLog(`🚀 Progress reached 100% - automatically opening BUILD SUMMARY modal`);
                        
                        // Automatically open build summary modal after a short delay
                        setTimeout(() => {
                            setIsBuildSummaryModalOpen(true);
                            addTerminalLog('📋 Automatically opening BUILD SUMMARY modal from progress monitoring');
                        }, 1000); // 1 second delay for progress-based triggers
                    }
                }

                // Handle regular AI agent messages (legacy support)
                // Only process legacy format if the parsed response doesn't have the new structure
                if (!parsedResponse.body || Object.keys(parsedResponse.body).length === 0) {
                    if(data.source === 'manager') logClass = 'log-manager';
                    if(data.source === 'coder') logClass = 'log-coder';
                    if(data.error) logClass = 'log-error';

                    // Update status based on incoming messages
                    if (data.log && data.log.includes("Manager is thinking")) {
                        setAgentStatus("Manager is planning the next step...");
                    } else if (data.log && data.log.includes("Sending task to Coder")) {
                        setAgentStatus("Coder is generating code...");
                    }

                    const messageContent = data.log || data.error || data.status || "Received an empty message.";
                    content = `<div><span class="badge ${logClass}">${data.source.toUpperCase()}</span> ${messageContent.replace(/\n/g, '<br>')}</div>`;
                    setAgentLogs(prev => prev + content);

                    // If the process is finished, re-enable the UI
                    if (data.status === "SUCCESS" || data.status === "FAILED" || data.error) {
                        setAgentStatus(`Finished (${data.status || 'Error'})`);
                        setAgentProcessing(false);
                    }
                }
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
                setAgentLogs(prev => prev + '<div><span class="badge log-error">ERROR</span> Failed to parse message from server.</div>');
            }
        };

        socket.onerror = (error) => {
            console.error('AI Agent WebSocket connection error:', error);
            setAgentConnected(false);
            setAgentStatus('Connection Failed');
            setAgentLogs(prev => prev + '<div><span class="badge log-error">ERROR</span><strong>Connection Failed. Check backend server and WebSocket URL.</strong></div>');
            addTerminalLog('AI agent connection error');
        };

        socket.onclose = () => {
            console.log('AI Agent WebSocket connection closed');
            setAgentConnected(false);
            setAgentStatus('Disconnected');
            setAgentLogs(prev => prev + '<div><span class="badge log-system">SYSTEM</span><strong>Connection Closed.</strong></div>');
            addTerminalLog('AI agent disconnected');
        };

        setAgentSocket(socket);
    }, [agentSocket, addTerminalLog, agentConnected, buildSummaryData, handlePRInformation]);

    // Disconnect from agent
    const disconnectFromAgent = useCallback(() => {
        if (agentSocket) {
            agentSocket.close();
            setAgentSocket(null);
            setAgentConnected(false);
            setAgentStatus('Disconnected');
            addTerminalLog('AI agent disconnected manually');
        }
    }, [agentSocket, addTerminalLog]);

    // Send requirement to agent
    const sendAgentRequirement = useCallback(() => {
        if (!agentInput.trim() || !agentSocket || agentProcessing) return;
        
        setAgentProcessing(true);
        setAgentStatus('Sending request to agent...');
        agentSocket.send(agentInput);
        addTerminalLog(`Sent requirement to AI Agent: ${agentInput.substring(0, 50)}...`);
    }, [agentInput, agentSocket, agentProcessing, addTerminalLog]);

    // Connect to agent when right panel opens OR when contract modal is open
    useEffect(() => {
        console.log('useEffect for agent connection - rightPanelOpen:', rightPanelOpen, 'contractPopups.size:', contractPopups.size, 'agentSocket:', !!agentSocket);
        if ((rightPanelOpen || contractPopups.size > 0) && !agentSocket) {
            console.log('Triggering connectToAgent()');
            connectToAgent();
        } else if (!rightPanelOpen && contractPopups.size === 0 && agentSocket) {
            console.log('Triggering disconnectFromAgent()');
            disconnectFromAgent();
        }
    }, [rightPanelOpen, contractPopups.size, agentSocket, connectToAgent, disconnectFromAgent]);

    // Ensure AI Agent WebSocket is connected when contract modal opens
    useEffect(() => {
        console.log('Contract modal useEffect - contractPopups.size:', contractPopups.size, 'agentSocket:', !!agentSocket);
        if (contractPopups.size > 0 && !agentSocket) {
            console.log('Contract modal opened, connecting to AI Agent WebSocket...');
            connectToAgent();
        }
    }, [contractPopups.size, agentSocket, connectToAgent]);

    // Auto-scroll to bottom of chat messages
    useEffect(() => {
        if (chatMessagesEndRef.current && chatMessages.length > 0) {
            // Force scroll to bottom with a small delay to ensure DOM is updated
            setTimeout(() => {
                if (chatMessagesEndRef.current) {
                    chatMessagesEndRef.current.scrollTop = chatMessagesEndRef.current.scrollHeight;
                    console.log('Auto-scrolled to bottom, scrollHeight:', chatMessagesEndRef.current.scrollHeight);
                }
            }, 100);
        }
    }, [chatMessages]);





    // Cleanup agent WebSocket on component unmount
    useEffect(() => {
        return () => {
            if (agentSocket) {
                agentSocket.close();
            }
        };
    }, [agentSocket]);

    // Fetch data when component mounts or projectId changes
    useEffect(() => {
        fetchData();
    }, [projectId, refreshTrigger]);

    // Gets the canvas content based on state
    const getCanvasContent = () => {
        if (loading) {
            return <div className="absolute inset-0 flex items-center justify-center bg-[#0A071B]/80 backdrop-blur-sm z-10">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent"></div>
                    <p className="mt-2 text-white">Loading project data...</p>
                </div>
            </div>;
        }

        if (error) {
            return <div className="absolute inset-0 flex items-center justify-center bg-[#0A071B]/90 backdrop-blur-sm z-10">
                <div className="text-center max-w-md p-4">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="text-red-300 font-semibold">Error</p>
                    <p className="mt-2 text-gray-300">{error}</p>
                </div>
            </div>;
        }

        if (!projectId) {
            return <div className="absolute inset-0 flex items-center justify-center bg-[#0A071B]/90 backdrop-blur-sm z-10">
                <div className="text-center">
                    <p className="text-gray-300">Select a project to view requirements.</p>
                </div>
            </div>;
        }

        if (nodes.length === 0) {
            return <div className="absolute inset-0 flex items-center justify-center bg-[#0A071B]/90 backdrop-blur-sm z-10">
                <div className="text-center">
                    <p className="text-gray-300">No requirements found for this project.</p>
                </div>
            </div>;
        }

        // Return the React Flow component with just the user flow node
        if (!showCanvas) {
            return <div className="absolute inset-0 flex items-center justify-center bg-[#0A071B]/90 backdrop-blur-sm z-10">
                <div className="text-center">
                    <p className="text-gray-300">Canvas view is not available in this tab.</p>
                </div>
            </div>;
        }

        return (
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                connectionLineType={ConnectionLineType.SmoothStep}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                attributionPosition="bottom-right"
                snapToGrid={true}
                snapGrid={[15, 15]}
                nodesConnectable={true}
                edgesFocusable={true}
                defaultEdgeOptions={{
                    type: 'smoothstep',
                    style: {
                        stroke: '#8B5CF6',
                        strokeWidth: 2,
                        strokeDasharray: '5,5',
                    },
                }}
                connectionLineStyle={{
                    stroke: '#8B5CF6',
                    strokeWidth: 2,
                    strokeDasharray: '5,5',
                }}
            >
                <Controls />
                <MiniMap pannable={true} />
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#8B5CF6" />
            </ReactFlow>
        );
    };

    // Generate contract for Docker build
    const generateBuildContract = async (llrUiid: string, rowData: TableRowData, nodeData: any, nodeId: string): Promise<DockerBuildContract | null> => {
        try {
            // Get the requirements object
            const requirementsObject = await buildRequirementsObject(llrUiid, rowData, nodeData, nodeId);
            
            // Get the parsed settings from localStorage
            let parsedSettings = {};
            try {
                const savedSettings = localStorage.getItem('appSettings');
                if (savedSettings) {
                    parsedSettings = JSON.parse(savedSettings);
                }
            } catch (error) {
                console.error('Failed to parse app settings:', error);
            }
            
            // Create the final contract for Docker processing
            const contract: DockerBuildContract = {
                metadata: {
                    initiatedBy: "user",
                    dateTime: new Date().toISOString(),
                    feature_Number: requirementsObject.low_level_requirements.uiid || "0.0.1"
                },
                settings: parsedSettings,
                requirements: {
                    low_level_requirements: requirementsObject.low_level_requirements,
                    test_cases: requirementsObject.test_cases,
                    high_level_requirements: requirementsObject.high_level_requirements,
                    user_flow: requirementsObject.user_flow
                }
            };
            
            // Log the complete contract for Docker processing
            console.log('=== BUILD CONTRACT FOR DOCKER ===');
            console.log(JSON.stringify(contract, null, 2));
            console.log('=== END BUILD CONTRACT ===');
            
            return contract;
        } catch (error) {
            console.error('Error generating build contract:', error);
            return null;
        }
    };

    

    // Handle inline editing
    const startEditing = (fieldName: string, currentValue: string) => {
        setEditingField(fieldName);
        setEditValue(currentValue);
    };
    
    const saveEdit = () => {
        if (editingField && buildSummaryData) {
            if (editingField.startsWith('doc_')) {
                // Handle document links
                const index = parseInt(editingField.split('_')[1]);
                const newLinks = [...buildSummaryData.documentLinks];
                newLinks[index] = editValue;
                setBuildSummaryData(prev => prev ? { ...prev, documentLinks: newLinks } : null);
            } else if (editingField.startsWith('dashboard_')) {
                // Handle dashboard links
                const index = parseInt(editingField.split('_')[1]);
                const newLinks = [...buildSummaryData.dashboardLinks];
                newLinks[index] = editValue;
                setBuildSummaryData(prev => prev ? { ...prev, dashboardLinks: newLinks } : null);
            } else {
                // Handle regular fields
                setBuildSummaryData(prev => prev ? { ...prev, [editingField]: editValue } : null);
            }
        }
        setEditingField(null);
        setEditValue('');
    };
    
    const cancelEdit = () => {
        setEditingField(null);
        setEditValue('');
    };
    
    // Handle Build Summary modal
    const handleBuildSummary = (nodeId: string, rowIndex: number): void => {
        try {
            // Find the node and get its data
            const node = nodes.find(n => n.id === nodeId);
            if (!node) {
                console.error(`Node with ID ${nodeId} not found`);
                return;
            }
            
            const nodeData = node.data;
            const visibleRows: TableRowData[] = nodeData.rows || [];
            
            // Validate row index
            if (rowIndex < 0 || rowIndex >= visibleRows.length) {
                console.error(`Row index ${rowIndex} is out of bounds (0-${visibleRows.length-1})`);
                return;
            }
            
            // Get the row data for the clicked row
            const rowData = visibleRows[rowIndex];
            const rowUiid = rowData.uiid || rowData.id;
            
            // Set default build summary data
            const summaryData = {
                lowLevelRequirementId: rowUiid,
                status: 'Build In Progress',
                branchLink: 'https://github.com/example/repo/tree/feature-branch',
                prLink: 'https://github.com/example/repo/pull/123',
                documentLinks: [
                    'https://docs.example.com/feature-spec',
                    'https://docs.example.com/api-docs',
                    'https://docs.example.com/user-guide'
                ],
                keyMetrics: 'Response time < 200ms, 99.9% uptime, Error rate < 0.1%',
                dashboardLinks: [
                    'https://grafana.example.com/d/feature-dashboard',
                    'https://datadog.example.com/dashboard/feature-monitoring'
                ],
                alerts: 'CloudWatch Alerts configured for error rate > 1%, response time > 500ms',
                logs: 'CloudWatch Logs: /aws/lambda/feature-function, /aws/ecs/feature-service',
                productManager: 'John Doe',
                devManager: 'Jane Smith'
            };
            
            setBuildSummaryData(summaryData);
            setIsBuildSummaryModalOpen(true);
            
            console.log('Build Summary modal opened for:', {
                nodeId,
                rowIndex,
                rowUiid,
                rowData: rowData.name
            });
            
        } catch (error: any) {
            console.error('Error opening Build Summary modal:', error);
            setError(`Failed to open Build Summary: ${error.message || 'Unknown error'}`);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Add CSS for animations */}
            <style>
                {`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                /* Panel slide animations */
                .panel-slide-left {
                    transform: translateX(-100%);
                }
                
                .panel-slide-right {
                    transform: translateX(100%);
                }
                
                .panel-slide-bottom {
                    transform: translateY(100%);
                }
                `}
            </style>
            
            {/* Header - Removed control buttons, they're now in the main dashboard header */}
            <div className="p-4 border-b border-white/10 bg-white/5 backdrop-blur-sm">
                {/* Empty header space for consistency */}
            </div>
            
            {error && (
                <div className="p-4 text-red-300 border-b border-white/10 bg-red-500/10 backdrop-blur-sm">
                    {error}
                </div>
            )}
            
            {loading && (
                <div className="p-4 text-blue-300 border-b border-white/10 bg-blue-500/10 backdrop-blur-sm">
                    Loading project data...
                </div>
            )}
            
            {generateLoading && (
                <div className="p-4 text-green-300 border-b border-white/10 bg-green-500/10 backdrop-blur-sm">
                    Generating requirements... This may take a moment.
                </div>
            )}
            
            <div className="flex-1 relative flex">
                {/* Main Canvas Area */}
                <div className="flex-1 relative">
                    {/* ReactFlow component */}
                    {getCanvasContent()}
                </div>
                
                {/* Right Panel - Slides from right, percentage-based width */}
                {rightPanelOpen && (
                    <div className="w-[25%] min-w-[320px] max-w-[400px] bg-gray-900 border-l border-white/10 flex flex-col transform transition-transform duration-300 ease-in-out">
                        <div className="p-4 border-b border-white/10">
                            <div className="flex items-center justify-between">
                                <h3 className="text-white font-semibold text-sm">VishCoder</h3>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={clearChatHistory}
                                        className="text-gray-400 hover:text-red-400 px-2 py-1 rounded text-xs transition-colors border border-gray-600 hover:border-red-400"
                                        title="Delete History & Clear Cache"
                                    >
                                        Delete History
                                    </button>
                                    <button
                                        onClick={toggleRightPanel}
                                        className="text-gray-400 hover:text-white p-1"
                                        title="Close Panel"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L6 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="text-xs text-gray-400 mt-1" style={{ fontStyle: 'italic' }}>
                                {contractBuilding && (
                                    <span className="text-blue-400">
                                        🔄 Building contract...
                                    </span>
                                )}
                                {!contractBuilding && chatMessages.length > 0 && (
                                    <span className="text-green-400" title={`Cache expires in ${getCacheInfo()?.daysLeft || 0} days`}>
                                        💾 Chat cached ({chatMessages.length} messages)
                                    </span>
                                )}
                                {!contractBuilding && chatMessages.length === 0 && (
                                    <span className="text-gray-400">
                                        Ready to build contracts
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        {/* Chat Messages */}
                        <div 
                            ref={chatMessagesEndRef}
                            className="flex-1 overflow-y-auto p-3 bg-[#f8f9fa] border-b border-white/10 chat-messages-container relative"
                            style={{ 
                                scrollbarWidth: 'thin',
                                scrollbarColor: '#9CA3AF #E5E7EB',
                                scrollBehavior: 'smooth',
                                minHeight: '300px',
                                maxHeight: 'calc(100vh - 400px)',
                                overflowY: 'scroll'
                            }}

                        >

                            {chatMessages.length === 0 ? (
                                <div className="text-center text-gray-500 text-xs py-8">
                                    <div className="mb-2">📋 No contracts generated yet</div>
                                    <div className="text-gray-400">
                                        Right-click on any Low Level Requirement row<br/>
                                        and select "Build the Feature" to get started
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3 pb-2">
                                    {/* Show status message count and toggle */}
                                    {chatMessages.filter(m => m.type === 'status').length > 0 && (
                                        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg border border-gray-200">
                                            <div className="text-xs text-gray-600">
                                                📊 {chatMessages.filter(m => m.type === 'status').length} status update{chatMessages.filter(m => m.type === 'status').length !== 1 ? 's' : ''}
                                            </div>
                                            <button
                                                onClick={() => setShowAllLogs(!showAllLogs)}
                                                className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded transition-colors"
                                            >
                                                {showAllLogs ? 'Hide Details' : 'Show All'}
                                            </button>
                                        </div>
                                    )}
                                    {chatMessages
                                        .filter(message => {
                                            if (message.type !== 'status') return true;
                                            if (showAllLogs) return true;
                                            // In collapsed mode, only show the latest status message
                                            const statusMessages = chatMessages.filter(m => m.type === 'status');
                                            return statusMessages.length > 0 && message.id === statusMessages[statusMessages.length - 1].id;
                                        })
                                        .map((message) => (
                                        <div key={message.id} className="flex justify-start">
                                            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs shadow-sm ${
                                                message.isContract 
                                                    ? 'bg-green-50 border border-green-200' 
                                                    : message.type === 'status'
                                                    ? 'bg-blue-50 border border-blue-200 text-blue-800'
                                                    : 'bg-gray-200 text-gray-800'
                                            }`}>
                                                {message.isContract ? (
                                                    <div>
                                                        <div className="font-medium mb-2 text-green-800">{message.content}</div>
                                                        <button
                                                            onClick={() => {
                                                                const contractData = message.contractData;
                                                                if (contractData) {
                                                                    // Toggle popup for this contract
                                                                    setContractPopups(prev => {
                                                                        const newSet = new Set(prev);
                                                                        if (newSet.has(message.id)) {
                                                                            newSet.delete(message.id);
                                                                        } else {
                                                                            newSet.add(message.id);
                                                                        }
                                                                        return newSet;
                                                                    });
                                                                }
                                                            }}
                                                            className="bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded text-xs font-medium transition-colors border border-green-300"
                                                        >
                                                            {contractPopups.has(message.id) ? '📋 Hide Contract' : '📋 Review and Send Contract'}
                                                        </button>
                                                    </div>
                                                ) : message.type === 'status' ? (
                                                    <div className="font-mono">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <div className="text-xs font-medium text-blue-700 flex items-center gap-1">
                                                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                                                <span className="font-bold">{message.agent}</span>
                                                                <span className="text-blue-500">({message.llm})</span>
                                                                {!showAllLogs && chatMessages.filter(m => m.type === 'status').length > 1 && (
                                                                    <span className="text-xs bg-blue-200 text-blue-700 px-1 py-0.5 rounded">
                                                                        Latest
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {message.progress && (
                                                                <div className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                                                                    {message.progress}%
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="text-blue-800 text-xs mb-2 pl-3 border-l-2 border-blue-300">
                                                            {message.content}
                                                        </div>
                                                        {message.progress && (
                                                            <div className="w-full bg-blue-100 rounded-full h-2 mb-1">
                                                                <div 
                                                                    className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-700 shadow-sm" 
                                                                    style={{ width: `${message.progress}%` }}
                                                                ></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="break-words">{message.content}</div>
                                                )}
                                                <div className="text-xs opacity-70 mt-1">
                                                    {message.timestamp.toLocaleDateString('en-US', { 
                                                        month: '2-digit', 
                                                        day: '2-digit', 
                                                        year: '2-digit' 
                                                    })} • {message.timestamp.toLocaleTimeString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                </div>
                            )}
                        </div>
                        
                        {/* AI Chat Input */}
                        <div className="p-3 border-t border-white/10">
                            <div className="relative">
                                <textarea
                                    value={agentInput}
                                    onChange={(e) => setAgentInput(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleAiChat();
                                        }
                                    }}
                                    placeholder="Chat with VishCoder..."
                                    disabled={agentProcessing}
                                    className="w-full bg-white/10 text-white placeholder-gray-400 rounded-lg px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed resize-none ai-chat-textarea"
                                    style={{ 
                                        height: '120px',
                                        minHeight: '120px'
                                    }}
                                />
                                <button
                                    onClick={handleAiChat}
                                    disabled={!agentInput.trim() || agentProcessing}
                                    className="absolute right-3 bottom-3 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Send message"
                                >
                                    {agentProcessing ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                    ) : (
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            <div className="text-center text-gray-400 text-xs mt-2">
                                💡 Right-click on Low Level Requirements and select "Build the Feature" to generate contracts
                            </div>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Bottom Panel - Slides from bottom, 35% height */}
            {bottomPanelOpen && (
                <div className="h-1/3 max-h-96 bg-gray-900 border-t border-white/10 flex flex-col transform transition-transform duration-300 ease-in-out">
                    <div className="p-3 border-b border-white/10 flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <h3 className="text-white font-semibold text-sm">Live Docker Container Logs</h3>
                            <div className={`w-2 h-2 rounded-full ${logConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className={`text-xs ${logConnected ? 'text-green-400' : 'text-red-400'}`}>
                                {logConnected ? 'Connected' : 'Disconnected'}
                            </span>
                            <span className={`text-xs ml-2 ${
                                dockerLogs && dockerLogs.split('\n').filter(line => line.trim()).length >= 200 
                                    ? 'text-yellow-400' 
                                    : 'text-gray-400'
                            }`}>
                                {dockerLogs ? `${dockerLogs.split('\n').filter(line => line.trim()).length}/200 lines` : '0/200 lines'}
                                {dockerLogs && dockerLogs.split('\n').filter(line => line.trim()).length >= 200 && ' ⚠️'}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => {
                                    setDockerLogs('Connecting to log stream...');
                                    setProcessedLogs('');
                                }}
                                className="text-gray-400 hover:text-white text-xs"
                                title="Clear all logs and reset to initial state"
                            >
                                Clear
                            </button>
                            <button
                                onClick={logConnected ? disconnectFromLogStream : connectToLogStream}
                                className={`text-xs px-2 py-1 rounded ${
                                    logConnected 
                                        ? 'bg-red-600 hover:bg-red-700 text-white' 
                                        : 'bg-green-600 hover:bg-green-700 text-white'
                                }`}
                            >
                                {logConnected ? 'Disconnect' : 'Connect'}
                            </button>
                            <button
                                onClick={toggleBottomPanel}
                                className="text-gray-400 hover:text-white p-1"
                                title="Close Panel"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div 
                        id="docker-terminal" 
                        className="flex-1 overflow-y-auto p-3 font-mono text-xs bg-[#1e1e1e] text-[#d4d4d4]"
                        dangerouslySetInnerHTML={{ __html: processedLogs || dockerLogs }}
                    />
                </div>
            )}
            
            {/* Context Menu */}
            <Menu 
                id="tableNodeMenu"
                animation={{
                    enter: 'contexify_fadeIn',
                    exit: 'contexify_fadeOut'
                }}
                style={{
                    zIndex: 9999,
                    position: 'fixed'
                }}
                theme="dark"
            >
                                {/* Build the Feature - Only show for low level requirement tables with highlighted styling */}
                                {clickedNodeType === 'llr' && (
                            <Item 
                                id="build-feature"
                                onClick={({ props }) => {
                                    if (props?.type === 'row' && props.rowIndex !== undefined && 
                                        props.nodeId && props.nodeId.startsWith('lowlevelrequirement_')) {
                                        console.log('Context menu: Build the Feature clicked', {
                                            nodeId: props.nodeId,
                                            rowIndex: props.rowIndex,
                                            rowType: props.type
                                        });
                                        handleBuildFeature(props.nodeId, props.rowIndex);
                                        // Close the context menu after selection
                                        document.body.click();
                                    } else {
                                        console.warn('Cannot build feature: Missing nodeId or rowIndex or not a low level requirement', props);
                                    }
                                }}
                            >
                                <span className="font-bold text-green-600 build-feature-text">Build the Feature</span>
                            </Item>
                        )}
                        
                        {/* Build Summary - Only show for low level requirement tables */}
                        {clickedNodeType === 'llr' && (
                            <Item 
                                id="build-summary"
                                onClick={({ props }) => {
                                    if (props?.type === 'row' && props.rowIndex !== undefined && 
                                        props.nodeId && props.nodeId.startsWith('lowlevelrequirement_')) {
                                        console.log('Context menu: Build Summary clicked', {
                                            nodeId: props.nodeId,
                                            rowIndex: props.rowIndex,
                                            rowType: props.type
                                        });
                                        handleBuildSummary(props.nodeId, props.rowIndex);
                                        // Close the context menu after selection
                                        document.body.click();
                                    } else {
                                        console.warn('Cannot open build summary: Missing nodeId or rowIndex or not a low level requirement', props);
                                    }
                                }}
                            >
                                <span className="font-bold text-blue-600 build-summary-text">Build Summary</span>
                            </Item>
                        )}
                {/* Table manipulation items */}
                <Item onClick={({ props }) => {
                    if (props?.type === 'row' && props.rowIndex !== undefined) {
                        handleAddRow(props.nodeId, props.rowIndex);
                    }
                }}>
                    Add Row
                </Item>
                <Item onClick={({ props }) => {
                    if (props?.type === 'row' && props.rowIndex !== undefined) {
                        handleDeleteRow(props.nodeId, props.rowIndex);
                    }
                }}>
                    Delete Row
                </Item>
                <Item onClick={({ props }) => {
                    if (props?.nodeId) {
                        handleAddColumn(props.nodeId, {
                            key: `col-${Date.now()}`,
                            label: 'New Column',
                            width: 'w-[120px]',
                            editable: true,
                            order: 999
                        });
                    }
                }}>
                    Add Column
                </Item>
                <Item onClick={({ props }) => {
                    if (props?.type === 'header' && props.colKey) {
                        handleDeleteColumn(props.nodeId, props.colKey);
                    }
                }}>
                    Delete Column
                </Item>
                
                {/* Generate Child Requirements - Only show for non-test case tables */}
                {clickedNodeType !== 'testcase' && (
                    <Item 
                        id="generate-child-req"
                        onClick={({ props }) => {
                            if (props?.type === 'row' && props.rowIndex !== undefined && 
                                props.nodeId && !props.nodeId.startsWith('testcase_')) {
                                console.log('Context menu: Generate Child Requirements clicked', {
                                    nodeId: props.nodeId,
                                    rowIndex: props.rowIndex,
                                    rowType: props.type
                                });
                                handleGenerateRequirements(props.nodeId, props.rowIndex);
                            } else {
                                console.warn('Cannot generate requirements: Missing nodeId or rowIndex', props);
                            }
                        }}
                    >
                        Generate Child Requirements
                    </Item>
                )}
                
                        
            </Menu>
            
            {/* Contract Popup Modal - Simple JSON Editor */}
            {contractPopups.size > 0 && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-[10000] flex items-center justify-center p-4"
                    onClick={() => setContractPopups(new Set())}
                >
                    <div 
                        className="bg-white rounded-lg shadow-2xl max-w-5xl max-h-[90vh] w-full overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold">📄 Review and Edit Contract</h3>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => {
                                        // Send the contract to VishCoder via WebSocket
                                        console.log('Sending contract to VishCoder...');
                                        addTerminalLog('🚀 Sending contract to VishCoder for processing...');
                                        
                                        // Get the contract data from the current message
                                        const contractData = chatMessages
                                            .filter(msg => msg.isContract && contractPopups.has(msg.id))
                                            .map(msg => msg.contractData)[0];
                                        
                                        if (contractData && agentSocket && agentSocket.readyState === WebSocket.OPEN) {
                                            // Set the session thread ID for the commManager
                                            const threadId = contractData.metadata?.feature_Number || 
                                                           contractData.metadata?.dateTime || 
                                                           `contract_${Date.now()}`;
                                            commManager.setSessionThread(threadId);
                                            
                                            // Create the standardized payload for VishCoder using commManager
                                            const contractPayload = createContractPayload(
                                                contractData.metadata || {},
                                                contractData.settings || {},
                                                contractData.requirements || {},
                                                contractData.statusDetails || {}
                                            );
                                            const vishCoderPayload = commManager.createVishmakerPayload('build_feature', 'User', contractPayload);
                                            
                                            // Origin message ID is automatically managed by commManager
                                            
                                            // Send via WebSocket
                                            agentSocket.send(JSON.stringify(vishCoderPayload));
                                            
                                            // Add confirmation message to chat
                                            const confirmationMessage = {
                                                id: `confirmation-${Date.now()}`,
                                                type: 'assistant' as const,
                                                content: '✅ Contract sent to VishCoder.',
                                                timestamp: new Date(),
                                                isContract: false
                                            };
                                            setChatMessages(prev => [...prev, confirmationMessage]);
                                            
                                            addTerminalLog('📡 Contract payload sent via WebSocket to VishCoder');
                                            setContractPopups(new Set());
                                        } else if (!agentSocket || agentSocket.readyState !== WebSocket.OPEN) {
                                            // WebSocket not connected - show error
                                            const errorMessage = {
                                                id: `error-${Date.now()}`,
                                                type: 'assistant' as const,
                                                content: '❌ Failed to send contract: WebSocket not connected to VishCoder.',
                                                timestamp: new Date(),
                                                isContract: false
                                            };
                                            setChatMessages(prev => [...prev, errorMessage]);
                                            
                                            addTerminalLog('❌ WebSocket connection to VishCoder not available');
                                            setError('WebSocket connection to VishCoder not available. Please ensure the connection is established.');
                                        } else {
                                            // No contract data found
                                            const errorMessage = {
                                                id: `error-${Date.now()}`,
                                                type: 'assistant' as const,
                                                content: '❌ Failed to send contract: No contract data found.',
                                                timestamp: new Date(),
                                                isContract: false
                                            };
                                            setChatMessages(prev => [...prev, errorMessage]);
                                            
                                            addTerminalLog('❌ No contract data found to send');
                                        }
                                    }}
                                    disabled={!agentSocket || !agentConnected || agentSocket.readyState !== WebSocket.OPEN}
                                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {!agentSocket || !agentConnected ? (
                                        <span className="flex items-center space-x-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            <span>Connecting...</span>
                                        </span>
                                    ) : agentSocket.readyState !== WebSocket.OPEN ? (
                                        <span className="flex items-center space-x-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                            <span>Connecting...</span>
                                        </span>
                                    ) : (
                                        '🚀 Send to VishCoder'
                                    )}
                                </button>
                                <button
                                    onClick={() => setContractPopups(new Set())}
                                    className="text-gray-300 hover:text-white p-2 rounded-lg hover:bg-gray-700 transition-colors"
                                    title="Close contract editor"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            {chatMessages
                                .filter(msg => msg.isContract && contractPopups.has(msg.id))
                                .map((message) => (
                                    <div key={message.id} className="mb-6 last:mb-0">
                                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                            <div className="mb-4">
                                                <h4 className="text-lg font-semibold text-gray-800 mb-2">
                                                    Edit Contract JSON
                                                </h4>
                                                <p className="text-sm text-gray-600">
                                                    Review and modify the contract before sending to Docker. Changes will be saved automatically.
                                                </p>
                                            </div>
                                            {message.contractData && (
                                                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                                                    <textarea
                                                        className="w-full h-96 bg-gray-900 text-green-400 font-mono text-sm border-none outline-none resize-none"
                                                        defaultValue={JSON.stringify(message.contractData, null, 2)}
                                                        onChange={(e) => {
                                                            try {
                                                                const newData = JSON.parse(e.target.value);
                                                                // Update the contract data in the message
                                                                setChatMessages(prev => prev.map(msg => 
                                                                    msg.id === message.id 
                                                                        ? { ...msg, contractData: newData }
                                                                        : msg
                                                                ));
                                                            } catch (error) {
                                                                // Invalid JSON - don't update
                                                                console.log('Invalid JSON input:', error);
                                                            }
                                                        }}
                                                        spellCheck={false}
                                                        placeholder="Edit your contract JSON here..."
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Add custom styles for the Build Feature menu item */}
            <style>
                {`
                /* Ensure context menu appears at correct position */
                .contexify {
                    position: fixed !important;
                    z-index: 9999 !important;
                }
                
                .contexify_wrapper {
                    position: fixed !important;
                }
                
                /* Ensure context menu is positioned relative to viewport, not parent containers */
                .contexify_submenu {
                    position: fixed !important;
                }
                
                /* Override any transform positioning that might interfere */
                .contexify_item {
                    position: relative !important;
                }
                
                /* Handle React Flow container transforms */
                .react-flow__container .contexify {
                    transform: none !important;
                }
                
                /* Ensure context menu is above React Flow elements */
                .react-flow__viewport .contexify {
                    z-index: 10000 !important;
                }
                
                /* Make the text white when the menu item is highlighted */
                .contexify_item:hover .build-feature-text { 
                    color: white !important; 
                }
                
                /* AI Agent log badges */
                .badge {
                    display: inline-block;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-size: 10px;
                    font-weight: bold;
                    margin-right: 8px;
                }
                
                .log-system {
                    background-color: #6c757d;
                    color: white;
                }
                
                .log-manager {
                    background-color: #007bff;
                    color: white;
                }
                
                .log-coder {
                    background-color: #28a745;
                    color: white;
                }
                
                .log-error {
                    background-color: #dc3545;
                    color: white;
                }
                
                /* Ensure text in agent logs is readable */
                .agent-logs-container {
                    color: #1f2937 !important;
                }
                
                .agent-logs-container .badge {
                    color: white !important;
                }
                `}
            </style>
            
            {/* Build Summary Modal */}
            <BuildSummaryModal
                isOpen={isBuildSummaryModalOpen}
                onClose={() => setIsBuildSummaryModalOpen(false)}
                buildSummaryData={buildSummaryData}
                setBuildSummaryData={setBuildSummaryData}
                editingField={editingField}
                editValue={editValue}
                startEditing={startEditing}
                saveEdit={saveEdit}
                cancelEdit={cancelEdit}
                agentSocket={agentSocket}
            />
        </div>
    );
};

function estimateNodeHeight(rows: number): number {
    return NODE_HEADER_HEIGHT + (rows * BASE_ROW_HEIGHT);
}

export default CanvasViewer;
