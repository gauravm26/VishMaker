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

import apiClient from '@/lib/apiClient';
import LlmService from '@/lib/llmService';
import { 
    ProjectRequirementsResponse, 
    UserFlow, 
    BuildFeatureRequest, 
    BuildFeatureResponse 
} from '@/types/project';
import { CustomNode, TableNodeData, TableRowData, ColumnDef } from '@/types/canvas';
import TableNode from './TableNode';

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

const CanvasViewer: React.FC<CanvasViewerProps> = ({ projectId, onToggleSidebar }) => {
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
    
    // Panel states
    const [bottomPanelOpen, setBottomPanelOpen] = useState<boolean>(false);
    const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(false);
    const [devMode, setDevMode] = useState<boolean>(false);
    
    // Terminal logs state
    const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
    const [dockerLogs, setDockerLogs] = useState<string>('Connecting to log stream...');
    const [logSocket, setLogSocket] = useState<WebSocket | null>(null);
    const [logConnected, setLogConnected] = useState<boolean>(false);
    
    // Chat state
    const [chatMessages, setChatMessages] = useState<Array<{id: string, type: 'user' | 'assistant', content: string, timestamp: Date}>>([]);
    const [chatInput, setChatInput] = useState<string>('');
    const [chatLoading, setChatLoading] = useState<boolean>(false);
    
    // AI Agent state
    const [agentSocket, setAgentSocket] = useState<WebSocket | null>(null);
    const [agentConnected, setAgentConnected] = useState<boolean>(false);
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
        
        // Show the context menu
        show({
            event,
            props
        });
    }, [show]);
    
    // Track context menu reference to pass to TableNode
    const contextMenuHandlerRef = useRef(handleContextMenu);
    
    // Update ref when handler changes
    useEffect(() => {
        contextMenuHandlerRef.current = handleContextMenu;
    }, [handleContextMenu]);
    
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
        const requirements = {
            user_flow: {},
            high_level_requirements: {},
            low_level_requirements: {},
            test_cases: {},
            tech_stack: {
                frontend_language: "TypeScript",
                frontend_framework: "React (.tsx)",
                css_framework: "Tailwind CSS",
                backend_architecture: "Serverless Functions",
                backend_language: "Python",
                cloud_provider: "AWS",
                infrastructure_as_code: "AWS CDK (Python)",
                aws_services: [
                    "API Gateway",
                    "Lambda",
                    "DynamoDB",
                    "S3",
                    "Cognito",
                    "CloudWatch",
                    "Step Functions",
                    "IAM",
                    "SSM Parameter Store",
                    "Secrets Manager"
                ]
            }
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
                    
                    if (llr.parent_uiid === hlrUiid) {
                        parentHlr = hlr;
                        console.log(`✅ Found parent HLR: ${hlrUiid} - ${hlr.name}`);
                    }
                });
            });
            
            if (parentHlr) {
                const hlrUiid = parentHlr.uiid || parentHlr.id;
                requirements.high_level_requirements = {
                    uiid: hlrUiid,
                    name: parentHlr.name,
                    description: parentHlr.desc || '',
                    parent_uiid: parentHlr.parent_uiid || null
                };
                console.log(`Step 3 - Added HLR: ${hlrUiid} - ${parentHlr.name}`);
                console.log('HLR parent_uiid:', parentHlr.parent_uiid);
            } else {
                console.log('❌ No parent HLR found for LLR:', llrUiid);
            }
            
            // Step 4: Find User Flow where HLR.parent_uiid == User_Flow.uiid
            let parentFlow: any = null;
            if (parentHlr) {
                const flowNodes = nodes.filter(n => n.id.startsWith('flow_genChildReq_'));
                
                flowNodes.forEach(flowNode => {
                    const flowData = flowNode.data;
                    const flowRows = flowData.allRows || flowData.rows || [];
                    
                    flowRows.forEach((flow: any) => {
                        const flowUiid = flow.uiid || flow.id;
                        console.log(`Checking User Flow ${flowUiid}: uiid=${flowUiid}, HLR.parent_uiid=${parentHlr.parent_uiid}`);
                        
                        if (parentHlr.parent_uiid === flowUiid) {
                            parentFlow = flow;
                            console.log(`✅ Found parent User Flow: ${flowUiid} - ${flow.name}`);
                        }
                    });
                });
                
                if (parentFlow) {
                    const flowUiid = parentFlow.uiid || parentFlow.id;
                    requirements.user_flow = {
                        uiid: flowUiid,
                        name: parentFlow.name,
                        description: parentFlow.desc || '',
                        parent_uiid: parentFlow.parent_uiid
                    };
                    console.log(`Step 4 - Added User Flow: ${flowUiid} - ${parentFlow.name}`);
                } else {
                    console.log('❌ No parent User Flow found for HLR:', parentHlr.uiid);
                }
            }
            
            console.log('Final requirements object:', requirements);
            console.log(`Summary: LLR=${llrUiid}, HLR=${parentHlr ? parentHlr.uiid : 'Not found'}, User Flow=${parentFlow ? parentFlow.uiid : 'Not found'}, Test Cases=${testCasesForLlr.length}`);
            
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
            
            // Build the requirements object by traversing the hierarchy
            const requirementsObject = await buildRequirementsObject(rowUiid, rowData, nodeData, nodeId);
            
            // Create the request JSON object
            const requestId = crypto.randomUUID();
            const timestamp = new Date().toISOString();
            
            const buildFeatureRequest = {
                request_id: requestId,
                timestamp: timestamp,
                payload: {
                    user_flow: requirementsObject.user_flow,
                    high_level_requirement: requirementsObject.high_level_requirements,
                    low_level_requirement: requirementsObject.low_level_requirements,
                    test_cases: requirementsObject.test_cases,
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
            
            // Open the chat panel and send the request
            setRightPanelOpen(true);
            
            // Wait for the panel to open and agent to connect, then send the request
            setTimeout(() => {
                // Check if agent is connected or if we need to wait for connection
                if (agentSocket && agentSocket.readyState === WebSocket.OPEN) {
                    const requestMessage = JSON.stringify(buildFeatureRequest, null, 2);
                    agentSocket.send(requestMessage);
                    addTerminalLog(`✅ Sent build feature request to AI agent`);
                    
                    // Add user message to chat
                    const userMessage = {
                        id: `user-${Date.now()}`,
                        type: 'user' as const,
                        content: `Build Feature Request:\n\`\`\`json\n${requestMessage}\n\`\`\``,
                        timestamp: new Date()
                    };
                    setChatMessages(prev => [...prev, userMessage]);
                    
                    // Clear any existing error since we're connected
                    setError(null);
                } else {
                    // Agent socket exists but not connected yet - wait longer for connection
                    addTerminalLog(`⏳ Waiting for AI agent to connect...`);
                    setTimeout(() => {
                        if (agentSocket && agentSocket.readyState === WebSocket.OPEN) {
                            const requestMessage = JSON.stringify(buildFeatureRequest, null, 2);
                            agentSocket.send(requestMessage);
                            addTerminalLog(`✅ Sent build feature request to AI agent`);
                            
                            // Add user message to chat
                            const userMessage = {
                                id: `user-${Date.now()}`,
                                type: 'user' as const,
                                content: `Build Feature Request:\n\`\`\`json\n${requestMessage}\n\`\`\``,
                                timestamp: new Date()
                            };
                            setChatMessages(prev => [...prev, userMessage]);
                            
                            // Clear any existing error since we're connected
                            setError(null);
                        } else {
                            // Try one more time with longer wait
                            addTerminalLog(`⏳ Still waiting for AI agent to connect...`);
                            setTimeout(() => {
                                if (agentSocket && agentSocket.readyState === WebSocket.OPEN) {
                                    const requestMessage = JSON.stringify(buildFeatureRequest, null, 2);
                                    agentSocket.send(requestMessage);
                                    addTerminalLog(`✅ Sent build feature request to AI agent`);
                                    
                                    // Add user message to chat
                                    const userMessage = {
                                        id: `user-${Date.now()}`,
                                        type: 'user' as const,
                                        content: `Build Feature Request:\n\`\`\`json\n${requestMessage}\n\`\`\``,
                                        timestamp: new Date()
                                    };
                                    setChatMessages(prev => [...prev, userMessage]);
                                    
                                    // Clear any existing error since we're connected
                                    setError(null);
                                } else {
                                    // Final attempt with even longer wait
                                    addTerminalLog(`⏳ Final attempt to connect to AI agent...`);
                                    setTimeout(() => {
                                        if (agentSocket && agentSocket.readyState === WebSocket.OPEN) {
                                            const requestMessage = JSON.stringify(buildFeatureRequest, null, 2);
                                            agentSocket.send(requestMessage);
                                            addTerminalLog(`✅ Sent build feature request to AI agent`);
                                            
                                            // Add user message to chat
                                            const userMessage = {
                                                id: `user-${Date.now()}`,
                                                type: 'user' as const,
                                                content: `Build Feature Request:\n\`\`\`json\n${requestMessage}\n\`\`\``,
                                                timestamp: new Date()
                                            };
                                            setChatMessages(prev => [...prev, userMessage]);
                                            
                                            // Clear any existing error since we're connected
                                            setError(null);
                                        } else {
                                            console.error('AI agent not connected after 10 seconds of waiting');
                                            addTerminalLog(`❌ Failed to connect to AI agent after multiple attempts`);
                                            setError('AI agent not connected after 10 seconds. Please ensure the chat panel is open and connected.');
                                        }
                                    }, 3000); // Wait 3 more seconds
                                }
                            }, 3000); // Wait 3 seconds
                        }
                    }, 2000); // Wait 2 seconds first
                }
            }, 2000); // Wait 2 seconds initially
            
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
        setBottomPanelOpen(prev => !prev);
    }, []);

    const toggleRightPanel = useCallback(() => {
        setRightPanelOpen(prev => !prev);
    }, []);

    // Add log to terminal
    const addTerminalLog = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setTerminalLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    }, []);

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
            setDockerLogs(prev => prev + event.data);
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
            setDockerLogs(prev => prev + "\n--- CONNECTION ERROR ---\nCould not connect to the log stream. Is the backend running?\n");
            addTerminalLog('Docker log stream connection error');
        };

        socket.onclose = () => {
            setLogConnected(false);
            setDockerLogs(prev => prev + "\n--- DISCONNECTED ---\nLog stream has been closed.\n");
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
        if (agentSocket) {
            agentSocket.close();
        }

        const socket = new WebSocket("wss://vishmaker.com/ws");
        
        socket.onopen = () => {
            setAgentConnected(true);
            setAgentStatus('Connected and Idle');
            setAgentLogs('<div><span class="badge log-system">SYSTEM</span><strong>Connection Opened. Ready to receive requests.</strong></div>');
            addTerminalLog('AI agent connected');
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                let logClass = 'log-system';
                let content = '';

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
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
                setAgentLogs(prev => prev + '<div><span class="badge log-error">ERROR</span> Failed to parse message from server.</div>');
            }
        };

        socket.onerror = (error) => {
            setAgentConnected(false);
            setAgentStatus('Connection Failed');
            setAgentLogs(prev => prev + '<div><span class="badge log-error">ERROR</span><strong>Connection Failed. Check backend server and WebSocket URL.</strong></div>');
            addTerminalLog('AI agent connection error');
        };

        socket.onclose = () => {
            setAgentConnected(false);
            setAgentStatus('Disconnected');
            setAgentLogs(prev => prev + '<div><span class="badge log-system">SYSTEM</span><strong>Connection Closed.</strong></div>');
            addTerminalLog('AI agent disconnected');
        };

        setAgentSocket(socket);
    }, [agentSocket, addTerminalLog, agentConnected]);

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

    // Connect to agent when right panel opens
    useEffect(() => {
        if (rightPanelOpen && !agentSocket) {
            connectToAgent();
        } else if (!rightPanelOpen && agentSocket) {
            disconnectFromAgent();
        }
    }, [rightPanelOpen, agentSocket, connectToAgent, disconnectFromAgent]);

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
                nodesConnectable={false}
                edgesFocusable={false}
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
            
            {/* Header - Always visible with control buttons */}
            <div className="p-4 flex justify-between items-center border-b border-white/10 bg-white/5 backdrop-blur-sm">
                <h2 className="text-lg font-semibold text-white">Requirements Canvas</h2>
                
                {/* Panel Controls - Always visible */}
                <div className="flex items-center space-x-2">
                    {/* Main Sidebar Toggle */}
                    <button
                        onClick={toggleLeftPanel}
                        className="p-2 rounded-lg transition-colors bg-white/10 text-gray-300 hover:bg-white/20"
                        title="Toggle Projects Sidebar"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </button>
                    
                    {/* Bottom Panel Toggle */}
                    <button
                        onClick={toggleBottomPanel}
                        className="p-2 rounded-lg transition-colors bg-white/10 text-gray-300 hover:bg-white/20"
                        title="Toggle Terminal"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </button>
                    
                    {/* Right Panel Toggle */}
                    <button
                        onClick={toggleRightPanel}
                        className="p-2 rounded-lg transition-colors bg-white/10 text-gray-300 hover:bg-white/20"
                        title="Toggle Chat Panel"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                    </button>
                </div>
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
                
                {/* Right Panel - Slides from right, max 20% width */}
                {rightPanelOpen && (
                    <div className="w-1/5 max-w-80 bg-gray-900 border-l border-white/10 flex flex-col transform transition-transform duration-300 ease-in-out">
                        <div className="p-4 border-b border-white/10">
                            <div className="flex items-center justify-between">
                                <h3 className="text-white font-semibold text-sm">AI Coding Agent</h3>
                                <div className="flex items-center space-x-2">
                                    <div className={`w-2 h-2 rounded-full ${agentConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                    <span className={`text-xs ${agentConnected ? 'text-green-400' : 'text-red-400'}`}>
                                        {agentConnected ? 'Connected' : 'Disconnected'}
                                    </span>
                                    <button
                                        onClick={toggleRightPanel}
                                        className="text-gray-400 hover:text-white p-1"
                                        title="Close Panel"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="text-xs text-gray-400 mt-1" style={{ fontStyle: 'italic' }}>
                                Status: {agentStatus}
                            </div>
                        </div>
                        
                        {/* Agent Logs */}
                        <div 
                            className="flex-1 overflow-y-auto p-3 bg-[#f8f9fa] border-b border-white/10 agent-logs-container"
                            style={{ height: '300px' }}
                        >
                            <div 
                                className="text-xs whitespace-pre-wrap text-gray-800"
                                dangerouslySetInnerHTML={{ __html: agentLogs }}
                            />
                        </div>
                        
                        {/* Agent Input */}
                        <div className="p-3 border-t border-white/10">
                            <div className="flex space-x-2">
                                <input
                                    type="text"
                                    value={agentInput}
                                    onChange={(e) => setAgentInput(e.target.value)}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            sendAgentRequirement();
                                        }
                                    }}
                                    placeholder="Enter coding requirement..."
                                    disabled={agentProcessing || !agentConnected}
                                    className="flex-1 bg-white/10 text-white placeholder-gray-400 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                />
                                <button
                                    onClick={sendAgentRequirement}
                                    disabled={!agentInput.trim() || agentProcessing || !agentConnected}
                                    className="px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Generate
                                </button>
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
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setDockerLogs('Connecting to log stream...')}
                                className="text-gray-400 hover:text-white text-xs"
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
                        className="flex-1 overflow-y-auto p-3 font-mono text-xs bg-[#1e1e1e] text-[#d4d4d4] whitespace-pre-wrap"
                    >
                        {dockerLogs}
                    </div>
                </div>
            )}
            
            {/* Context Menu */}
            <Menu id="tableNodeMenu">
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
                            } else {
                                console.warn('Cannot build feature: Missing nodeId or rowIndex or not a low level requirement', props);
                            }
                        }}
                    >
                        <span className="font-bold text-green-600 build-feature-text">Build the Feature</span>
                    </Item>
                )}
            </Menu>
            
            {/* Add custom styles for the Build Feature menu item */}
            <style>
                {`
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
        </div>
    );
};

function estimateNodeHeight(rows: number): number {
    return NODE_HEADER_HEIGHT + (rows * BASE_ROW_HEIGHT);
}

export default CanvasViewer;