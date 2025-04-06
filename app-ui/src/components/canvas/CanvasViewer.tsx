// app-ui/src/components/canvas/CanvasViewer.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
import { ProjectRequirementsResponse, UserFlow } from '@/types/project';
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
    const possibleDescFields = ['description', 'desc', 'tech_stack_details', 'expected_result', 'details'];
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
            style={style}
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

const CanvasViewer: React.FC<CanvasViewerProps> = ({ projectId }) => {
    const [nodes, setNodes, onNodesChange] = useNodesState<TableNodeData & { actions: any }>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [userFlows, setUserFlows] = useState<UserFlow[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [generateLoading, setGenerateLoading] = useState<boolean>(false);
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
    
    // Track which tables are minimized (initially all tables are minimized)
    const [minimizedTables, setMinimizedTables] = useState<Record<string, boolean>>({});
    
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
        
        // Create the node with the organized data
        return {
            id: nodeId,
            type: 'tableNode',
            data: {
                title: title,
                componentId: nodeId, // Use the nodeId as componentId for LLM processing
                columns: baseColumns,
                rows: visibleRows,
                allRows: tableRows,
                isMinimized: isMinimized,
                actions: {
                    onCellChange: handleCellChange,
                    onAddRow: handleAddRow,
                    onDeleteRow: handleDeleteRow,
                    onAddColumn: handleAddColumn,
                    onDeleteColumn: handleDeleteColumn,
                    onColumnHeaderChange: handleColumnHeaderChange,
                    onToggleSize: toggleTableSize
                }
            },
            position: { x: 0, y: 0 }, // Position will be calculated later
            style: {
                minWidth: '800px',
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
        parentRowIndex: number = -1      // Index of the parent row that owns this table
    ): { nodes: CustomNode[], edges: Edge[] } => {
        // Check if we have data for this level
        if (!data[currentKey] || !data[currentKey].length) {
            return { nodes: [], edges: [] };
        }

        const items = data[currentKey];
        
        // Get a sample item to determine fields
        const sampleItem = items[0] || {};
        const { displayField, descriptionField, childrenField } = determineFields(sampleItem);
        
        // Create standardized table type name from the key
        const tableType = currentKey
            .replace(/_list$/, '')  // Remove _list suffix if present
            .replace(/s$/, '')      // Make singular if plural
            .replace(/_/g, '');     // Remove underscores
        
        // Format a nice title for display
        const title = formatDisplayName(currentKey);
        
        // All nodes and edges we'll return
        let allNodes: CustomNode[] = [];
        let allEdges: Edge[] = [];

        // Handle User Flows table (root level)
        if (level === 0) {
            // Create a single table for user flows
            const nodeId = `${tableType}_genChildReq`;            
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
                        const hlrNodeId = `${tableType}_${flowIndex}_hlr`;
                        
                        console.log(`Creating HLR table for flow ${flowIndex}: ${hlrNodeId}`);
                        
                        // Filter children to only include those with matching parent_uiid
                        const flowUiid = flow.uiid;
                        console.log(`Flow ${flowIndex} UIID: ${flowUiid}`);
                        
                        const matchingChildren = flow[childrenField].filter((child: any) => 
                            child.parent_uiid === flowUiid
                        );
                        
                        console.log(`Flow ${flowIndex} has ${matchingChildren.length} matching HLRs`);
                        
                        // Only create a table if there are matching children
                        if (matchingChildren.length > 0) {
                            // Create a table for this flow's HLRs
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
                            console.log(`Flow ${flowIndex} has sno=${flow.sno}, using row handle ID row-handle-${actualRowIndex}`);
                            
                            // Create an edge from the specific flow row to its HLR table
                            const rowHandleId = `row-handle-${actualRowIndex}`;
                            console.log(`Creating edge with handle ID: ${rowHandleId}`);
                            
                            const flowToHlrEdge: Edge = {
                                id: `edge-${nodeId}-row${actualRowIndex}-to-${hlrNodeId}`,
                                source: nodeId,
                                sourceHandle: rowHandleId,
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
                                    const llrNodeId = `${tableType}_${flowIndex}_hlr_${hlrIndex}_llr`;
                                    
                                    console.log(`Creating LLR table for HLR ${hlrIndex}: ${llrNodeId}`);
                                    
                                    // Filter LLRs to only include those with matching parent_uiid
                                    const hlrUiid = hlr.uiid;
                                    console.log(`HLR ${hlrIndex} UIID: ${hlrUiid}`);
                                    
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
                                        console.log(`HLR ${hlrIndex} has sno=${hlr.sno}, using row handle ID row-handle-${actualHlrRowIndex}`);
                                        
                                        // Create an edge from the specific HLR row to its LLR table
                                        const hlrRowHandleId = `row-handle-${actualHlrRowIndex}`;
                                        console.log(`Creating LLR edge with handle ID: ${hlrRowHandleId}`);
                                        
                                        const hlrToLlrEdge: Edge = {
                                            id: `edge-${hlrNodeId}-row${actualHlrRowIndex}-to-${llrNodeId}`,
                                            source: hlrNodeId,
                                            sourceHandle: hlrRowHandleId,
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
                                                const tcNodeId = `${tableType}_${flowIndex}_hlr_${hlrIndex}_llr_${llrIndex}_tc`;
                                                
                                                console.log(`Creating TC table for LLR ${llrIndex}: ${tcNodeId}`);
                                                
                                                // Filter test cases to only include those with matching parent_uiid
                                                const llrUiid = llr.uiid;
                                                console.log(`LLR ${llrIndex} UIID: ${llrUiid}`);
                                                
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
                                                    console.log(`LLR ${llrIndex} has sno=${llr.sno}, using row handle ID row-handle-${actualLlrRowIndex}`);
                                                    
                                                    // Create an edge from the specific LLR row to its TC table
                                                    const llrRowHandleId = `row-handle-${actualLlrRowIndex}`;
                                                    console.log(`Creating TC edge with handle ID: ${llrRowHandleId}`);
                                                    
                                                    const llrToTcEdge: Edge = {
                                                        id: `edge-${llrNodeId}-row${actualLlrRowIndex}-to-${tcNodeId}`,
                                                        source: llrNodeId,
                                                        sourceHandle: llrRowHandleId,
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
        
        return {
            nodes: allNodes,
            edges: allEdges
        };
    };

    // Fetch data and build tables
    const fetchData = async () => {
        if (!projectId) {
            setNodes([]);
            setEdges([]);
            setUserFlows([]);
            return;
        }

        setLoading(true);
        setError(null);

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
            
            // Store the user flows for reference
            setUserFlows(response.flows || []);
            
            // Build tables from the hierarchical data
            if (response.flows && response.flows.length > 0) {
                const { nodes: builtNodes, edges: builtEdges } = buildHierarchicalTables(
                    { flows: response.flows },
                    'flows'
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
                
                setNodes(animatedNodes);
                setEdges(validEdges);
            } else {
                setNodes([]);
                setEdges([]);
            }
        } catch (error: any) {
            console.error('Error loading project data:', error);
            setError(`Failed to load project data: ${error.message || 'Unknown error'}`);
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
                componentId,
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
            
            // Reset nodes to original state
            await fetchData();
        } finally {
            setGenerateLoading(false);
        }
    };

    // Fetch data when component mounts or projectId changes
    useEffect(() => {
        fetchData();
    }, [projectId, refreshTrigger]);

    // Gets the canvas content based on state
    const getCanvasContent = () => {
        if (loading) {
            return <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 z-10">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
                    <p className="mt-2 text-gray-700 dark:text-gray-300">Loading project data...</p>
                </div>
            </div>;
        }

        if (error) {
            return <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 dark:bg-gray-800 dark:bg-opacity-90 z-10">
                <div className="text-center max-w-md p-4">
                    <div className="text-red-500 text-3xl mb-2">⚠️</div>
                    <p className="text-red-600 font-semibold">Error</p>
                    <p className="mt-2 text-gray-700 dark:text-gray-300">{error}</p>
                </div>
            </div>;
        }

        if (!projectId) {
            return <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 dark:bg-gray-800 dark:bg-opacity-90 z-10">
                <div className="text-center">
                    <p className="text-gray-500 dark:text-gray-400">Select a project to view requirements.</p>
                </div>
            </div>;
        }

        if (nodes.length === 0) {
            return <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 dark:bg-gray-800 dark:bg-opacity-90 z-10">
                <div className="text-center">
                    <p className="text-gray-500 dark:text-gray-400">No requirements found for this project.</p>
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
                onConnect={(params: Connection) => setEdges((eds) => addEdge(params, eds))}
                connectionLineType={ConnectionLineType.SmoothStep}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                attributionPosition="bottom-right"
                snapToGrid={true}
                snapGrid={[15, 15]}
                nodesConnectable={false}
                edgesFocusable={false}
            >
                <Controls />
                <MiniMap pannable={true} />
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
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
                `}
            </style>
            
            <div className="p-3 flex justify-between items-center border-b">
                <h2 className="text-lg font-semibold">Requirements Canvas</h2>
            </div>
            
            {error && (
                <div className="p-3 text-red-600 border-b">
                    {error}
                </div>
            )}
            
            {loading && (
                <div className="p-3 bg-blue-50 text-blue-700 border-b">
                    Loading project data...
                </div>
            )}
            
            {generateLoading && (
                <div className="p-3 bg-green-50 text-green-700 border-b">
                    Generating requirements... This may take a moment.
                </div>
            )}
            
            <div className="flex-1 relative">
                {/* ReactFlow component */}
                {getCanvasContent()}
                
                {/* Context Menu */}
                <Menu id="tableNodeMenu">
                    {/* Show UIID information if available */}
                    <Item onClick={({ props }) => {
                        if (props?.uiid) {
                            // Copy to clipboard
                            navigator.clipboard.writeText(props.uiid);
                            console.log(`Copied UIID to clipboard: ${props.uiid}`);
                            // Optional: Show a toast or notification
                            alert(`Copied UIID: ${props.uiid}`);
                        }
                    }}>
                        Copy UIID
                    </Item>
                    
                    {/* Show parent UIID information if available */}
                    <Item onClick={({ props }) => {
                        if (props?.parentUiid) {
                            // Copy to clipboard
                            navigator.clipboard.writeText(props.parentUiid);
                            console.log(`Copied parent UIID to clipboard: ${props.parentUiid}`);
                            // Optional: Show a toast or notification
                            alert(`Copied Parent UIID: ${props.parentUiid}`);
                        } else {
                            alert('No parent UIID available');
                        }
                    }}>
                        Copy Parent UIID
                    </Item>
                    
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
                    <Item onClick={({ props }) => {
                        if (props?.type === 'row' && props.rowIndex !== undefined) {
                            console.log('Context menu: Generate Child Requirements clicked', {
                                nodeId: props.nodeId,
                                rowIndex: props.rowIndex,
                                rowType: props.type
                            });
                            handleGenerateRequirements(props.nodeId, props.rowIndex);
                        } else {
                            console.warn('Cannot generate requirements: Missing nodeId or rowIndex', props);
                        }
                    }}>
                        Generate Child Requirements
                    </Item>
                </Menu>
            </div>
        </div>
    );
};

function estimateNodeHeight(rows: number): number {
    return NODE_HEADER_HEIGHT + (rows * BASE_ROW_HEIGHT);
}

export default CanvasViewer;
