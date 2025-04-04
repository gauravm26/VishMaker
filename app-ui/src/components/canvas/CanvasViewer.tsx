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
    applyNodeChanges
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Menu, Item, useContextMenu } from "react-contexify";
import "react-contexify/dist/ReactContexify.css";

import apiClient from '@/lib/apiClient';
import { ProjectRequirementsResponse, UserFlow } from '@/types/project';
import { CustomNode, TableNodeData, TableRowData, ColumnDef } from '@/types/canvas';
import TableNode from './TableNode';

// Constants for layout calculations
const BASE_ROW_HEIGHT = 40;
const NODE_HEADER_HEIGHT = 50;

interface CanvasViewerProps {
    projectId: number | null;
    refreshTrigger: number;
}

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
                        return { 
                            ...node, 
                            data: { 
                                ...nodeData, 
                                rows: newRows,
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
                    const currentColumns = nodeData.columns || [];
                    const newRowIndex = afterRowIndex === -1 ? currentRows.length : afterRowIndex + 1;
 
                    const nextSno = currentRows.length > 0 ? Math.max(...currentRows.map(r => r.sno)) + 1 : 1;
                    const prefix = node.id.split('-')[0] || 'new';
                    const newRow = createNewRow(prefix, nextSno, currentColumns);

                    const newRows = [
                        ...currentRows.slice(0, newRowIndex),
                        newRow,
                        ...currentRows.slice(newRowIndex),
                    ].map((r, index) => ({ ...r, sno: index + 1 }));

                    const newNodeHeight = estimateNodeHeight(newRows.length);
                    const newStyle = { ...(node.style || {}), minHeight: `${newNodeHeight}px` };

                    return { 
                        ...node, 
                        data: { 
                            ...nodeData, 
                            rows: newRows,
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
                    const newRows = nodeData.rows.filter((_, index) => index !== rowIndex)
                        .map((r, index) => ({ ...r, sno: index + 1 }));

                    const newNodeHeight = estimateNodeHeight(newRows.length);
                    const newStyle = { ...(node.style || {}), minHeight: `${newNodeHeight}px` };

                    return { 
                        ...node, 
                        data: { 
                            ...nodeData, 
                            rows: newRows,
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

    // Fetch user flows data
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
            // Fetch only the user flow data
            const response = await apiClient<ProjectRequirementsResponse>(`/requirements/${projectId}`);
            
            // Log the response for debugging
            console.log("API Response:", response);
            console.log("User Flows:", response.flows);
            
            setUserFlows(response.flows || []);
            
            // Create just one user flow table node
            if (response.flows && response.flows.length > 0) {
                const userFlowNode = createSingleUserFlowTable(response.flows);
                setNodes([userFlowNode]);
                setEdges([]);
            } else {
                setNodes([]);
                setEdges([]);
            }
        } catch (error: any) {
            console.error('Error loading user flows:', error);
            setError(`Failed to load user flow data: ${error.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    // Function to generate high-level requirements from flows
    const handleGenerateHLR = async () => {
        if (!projectId || !userFlows.length) return;
        
        setGenerateLoading(true);
        setError(null);
        
        try {
            const response = await apiClient(
                `/requirements/${projectId}/generate-hlr-from-flows`, 
                { method: 'POST' }
            );
            
            // Re-fetch the data to update the canvas
            await fetchData();
            
            // Show success message
            console.log('Successfully generated high-level requirements');
            
        } catch (error: any) {
            console.error('Error generating high-level requirements:', error);
            setError(`Failed to generate requirements: ${error.message || 'Unknown error'}`);
        } finally {
            setGenerateLoading(false);
        }
    };

    // Fetch data when component mounts or projectId changes
    useEffect(() => {
        fetchData();
    }, [projectId, refreshTrigger]);

    // Create a single user flow table with all steps
    const createSingleUserFlowTable = (flows: UserFlow[]): CustomNode => {
        // Prepare rows for the table
        const tableRows: TableRowData[] = [];
        
        // Add all high level requirements from all flows as rows
        let hasHighLevelRequirements = false;
        
        flows.forEach((flow) => {
            if (flow.high_level_requirement_list && flow.high_level_requirement_list.length > 0) {
                hasHighLevelRequirements = true;
                flow.high_level_requirement_list.forEach((req, index) => {
                    tableRows.push({
                        id: `flow-${flow.id}-req-${req.id}`,
                        sno: index + 1,
                        name: req.requirement_text,
                        desc: "", // High level requirements don't have descriptions
                        originalId: req.id,
                        flowId: flow.id
                    });
                });
            }
        });
        
        // If no high level requirements, show the flows themselves
        if (!hasHighLevelRequirements) {
            flows.forEach((flow, index) => {
                tableRows.push({
                    id: `flow-${flow.id}`,
                    sno: index + 1,
                    name: flow.name,
                    desc: flow.description || "",
                    originalId: flow.id,
                    flowId: flow.id
                });
            });
        }
        
        // Sort the rows by serial number
        tableRows.sort((a, b) => a.sno - b.sno);
        
        // Create the node with the organized steps
        return {
            id: 'user-flow-table',
            type: 'tableNode',
            data: {
                title: 'User Flow',
                subtitle: 'User journey steps',
                columns: [
                    { key: 'sno', label: '#', order: 0, editable: false, width: 'w-[50px]' },
                    { key: 'name', label: 'Step', order: 1, editable: true, width: 'w-[250px]' },
                    { key: 'desc', label: 'Description', order: 2, editable: true, width: 'w-[450px]' },
                ],
                rows: tableRows,
                actions: {
                    onCellChange: handleCellChange,
                    onAddRow: handleAddRow,
                    onDeleteRow: handleDeleteRow,
                    onAddColumn: handleAddColumn,
                    onDeleteColumn: handleDeleteColumn,
                    onColumnHeaderChange: handleColumnHeaderChange
                }
            },
            position: { x: 50, y: 50 },
            style: {
                minWidth: '800px',
                minHeight: `${estimateNodeHeight(tableRows.length)}px`
            }
        };
    };

    // Gets the canvas content based on state
    const getCanvasContent = () => {
        if (loading) {
            return <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80 dark:bg-gray-800 dark:bg-opacity-80 z-10">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
                    <p className="mt-2 text-gray-700 dark:text-gray-300">Loading user flow data...</p>
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
                    <p className="text-gray-500 dark:text-gray-400">Select a project to view user flow.</p>
                </div>
            </div>;
        }

        if (nodes.length === 0) {
            return <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 dark:bg-gray-800 dark:bg-opacity-90 z-10">
                <div className="text-center">
                    <p className="text-gray-500 dark:text-gray-400">No user flow found for this project.</p>
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
                fitView
                attributionPosition="bottom-right"
                snapToGrid={true}
                snapGrid={[15, 15]}
            >
                <Controls />
                <MiniMap />
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            </ReactFlow>
        );
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-3 flex justify-between items-center border-b">
                <h2 className="text-lg font-semibold">User Flow Canvas</h2>
            </div>
            
            {error && (
                <div className="p-3 text-red-600 border-b">
                    {error}
                </div>
            )}
            
            {loading && (
                <div className="p-3 bg-blue-50 text-blue-700 border-b">
                    Loading user flow data...
                </div>
            )}
            
            <div className="flex-1 relative">
                {/* ReactFlow component */}
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    fitView
                >
                    <Background />
                    <Controls />
                </ReactFlow>
                
                {/* Context Menu */}
                <Menu id="tableNodeMenu">
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
                    <Item onClick={() => {
                        if (projectId && userFlows.length > 0) {
                            handleGenerateHLR();
                        }
                    }}>
                        Generate Requirements
                    </Item>
                    <Item onClick={fetchData}>
                        Refresh Data
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
