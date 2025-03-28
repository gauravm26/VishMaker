// app-ui/src/components/canvas/CanvasViewer.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, {
    Controls,
    Background,
    applyNodeChanges,
    applyEdgeChanges,
    NodeChange,
    EdgeChange,
    Connection,
    addEdge,
    MiniMap, // Optional: Add a minimap
    NodeTypes, // Type for defining custom nodes
    BackgroundVariant, // Import BackgroundVariant enum
    useNodesState, // Use hook for simpler state management
    useEdgesState, // Use hook for simpler state management
    Node, Edge // Import base types
} from 'reactflow';
import 'reactflow/dist/style.css'; // Import react-flow styles
import { Menu, Item, Separator, useContextMenu } from "react-contexify";

import apiClient from '@/lib/apiClient'; // Using path alias if configured, else use relative path
import { ProjectRequirementsResponse } from '@/types/project'; // API response type
import { CustomNode, CustomEdge, TableNodeData, TableRowData } from '@/types/canvas'; // react-flow types
import { transformRequirementsToFlow } from '@/lib/transformRequirementsToFlow'; // Transformation function
import TableNode from './TableNode'; // Import the custom node component

// Add missing constants
const BASE_ROW_HEIGHT = 40; // Height in pixels for each row
const NODE_HEADER_HEIGHT = 50; // Height in pixels for the node header

const NODE_CONTEXT_MENU_ID = "tableNodeMenu";


interface CanvasViewerProps {
    projectId: number | null; // ID of the project whose requirements to display
    refreshTrigger: number;
}

// Define the custom node types for React Flow
// The key ('tableNode') MUST match the 'type' used in transformRequirementsToFlow
const nodeTypes: NodeTypes = {
    tableNode: TableNode,
};

const createNewRow = (idPrefix: string, nextSno: number): TableRowData => ({
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`, // Reasonably unique ID
    sno: nextSno,
    name: 'New Item',
    desc: '',
});

const CanvasViewer: React.FC<CanvasViewerProps> = ({ projectId, refreshTrigger }) => {
    // Use React Flow hooks for state management
    const [nodes, setNodes, onNodesChange] = useNodesState<TableNodeData & { actions: any }>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleCellChange = useCallback((nodeId: string, rowIndex: number, columnKey: keyof TableRowData | string, value: string) => {
        console.log(`Cell Change: Node=${nodeId}, Row=${rowIndex}, Col=${columnKey}, Value=${value}`);
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    const nodeData = node.data as TableNodeData; // Type assertion
                    // Ensure rows exist and index is valid
                    if (nodeData.rows && nodeData.rows[rowIndex]) {
                        const newRows = [...nodeData.rows]; // Create shallow copy of rows array
                        const updatedRow = { ...newRows[rowIndex], [columnKey]: value }; // Create copy of row and update specific column
                        newRows[rowIndex] = updatedRow; // Replace old row with updated one
                        // Return shallow copy of node with updated data, including actions
                        return { 
                            ...node, 
                            data: { 
                                ...nodeData, 
                                rows: newRows,
                                actions: node.data.actions // Preserve the actions
                            } 
                        };
                    }
                }
                return node;
            })
        );
        // !!! TODO: Add apiClient.patch(...) call here to save change to backend !!!
        // Example: apiClient(`/api/v1/requirement/{row.originalId}`, { method: 'PATCH', body: { [columnKey]: value } });
        // Needs more robust logic to determine API endpoint and payload based on node/row type.
    }, [setNodes]); // setNodes is stable


    const handleAddRow = useCallback((nodeId: string, afterRowIndex: number) => {
        console.log(`Add Row: Node=${nodeId}, AfterIndex=${afterRowIndex}`);
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    const nodeData = node.data as TableNodeData;
                    const currentRows = nodeData.rows || [];
                    const newRowIndex = afterRowIndex === -1 ? currentRows.length : afterRowIndex + 1;
 
                    const nextSno = currentRows.length > 0 ? Math.max(...currentRows.map(r => r.sno)) + 1 : 1;
                    // Determine prefix based on node type (heuristic - improve if possible)
                    const prefix = node.id.split('-')[0] || 'new'; // e.g., 'flow', 'hlr', 'llr', 'test'
                    const newRow = createNewRow(prefix, nextSno);

                    const newRows = [
                        ...currentRows.slice(0, newRowIndex),
                        newRow,
                        ...currentRows.slice(newRowIndex),
                    ].map((r, index) => ({ ...r, sno: index + 1 })); // Re-calculate SNOs

                    // --- IMPORTANT: Recalculate Node Height ---
                    const newNodeHeight = estimateNodeHeight(newRows.length); // Use the same helper
                    const newStyle = { ...(node.style || {}), minHeight: `${newNodeHeight}px` };

                    return { 
                        ...node, 
                        data: { 
                            ...nodeData, 
                            rows: newRows,
                            actions: node.data.actions // Preserve the actions
                        }, 
                        style: newStyle 
                    };
                }
                return node;
            })
        );
        // !!! TODO: Add apiClient.post(...) call here to save new row to backend !!!
        // Needs logic to determine parent ID and correct endpoint.
    }, [setNodes]);

    const handleDeleteRow = useCallback((nodeId: string, rowIndex: number) => {
        console.log(`Delete Row: Node=${nodeId}, RowIndex=${rowIndex}`);
        let deletedRowId: string | undefined; // To potentially inform backend

        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === nodeId) {
                    const nodeData = node.data as TableNodeData;
                    if (!nodeData.rows || !nodeData.rows[rowIndex]) return node; // Safety check

                    deletedRowId = nodeData.rows[rowIndex].id; // Get ID before deleting
                    const newRows = nodeData.rows.filter((_, index) => index !== rowIndex)
                        .map((r, index) => ({ ...r, sno: index + 1 })); // Filter and re-calculate SNOs

                    // --- IMPORTANT: Recalculate Node Height ---
                    const newNodeHeight = estimateNodeHeight(newRows.length);
                    const newStyle = { ...(node.style || {}), minHeight: `${newNodeHeight}px` };

                    return { 
                        ...node, 
                        data: { 
                            ...nodeData, 
                            rows: newRows,
                            actions: node.data.actions // Preserve the actions
                        }, 
                        style: newStyle 
                    };
                }
                return node;
            })
        );
        // !!! TODO: Add apiClient.delete(...) call here using deletedRowId !!!
        // Example: apiClient(`/api/v1/requirement/{originalId_from_deletedRow}`, { method: 'DELETE' });
    }, [setNodes]);

    const nodeActions = useMemo(() => ({
        onCellChange: handleCellChange,
        onAddRow: handleAddRow,
        onDeleteRow: handleDeleteRow,
    }), [handleCellChange, handleAddRow, handleDeleteRow]);


    // Handler for connecting nodes manually (optional, maybe disable for read-only view)
    const onConnect = useCallback(
        (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
        [setEdges]
    );
    // --- End React Flow handlers ---
    const handleAddRowClick = (menuEventArgs: any) => { // Use 'any' temporarily for logging
        // --- LOG THE ENTIRE ARGUMENT ---
        console.log("handleAddRowClick received full arguments:", menuEventArgs);
        // --- END LOG ---
    
        // Try accessing props again, checking if menuEventArgs itself has nodeId
        const passedProps = menuEventArgs?.props; // Optional chaining
        console.log("handleAddRowClick attempted to access props:", passedProps);
    
        if (passedProps?.nodeId) {
            const targetRowIndex = passedProps.rowIndex ?? -1;
            console.log(`Calling handleAddRow with NodeId=${passedProps.nodeId}, AfterIndex=${targetRowIndex}`);
            handleAddRow(passedProps.nodeId, targetRowIndex);
        } else {
            // Also check if nodeId is directly on menuEventArgs (less likely but possible)
             if (menuEventArgs?.nodeId) {
                 const targetRowIndex = menuEventArgs.rowIndex ?? -1;
                 console.log(`Calling handleAddRow (direct args) with NodeId=${menuEventArgs.nodeId}, AfterIndex=${targetRowIndex}`);
                 handleAddRow(menuEventArgs.nodeId, targetRowIndex);
             } else {
                console.error("handleAddRowClick: nodeId not found in props or direct args", menuEventArgs);
             }
        }
    };
    
    const handleDeleteRowClick = (menuEventArgs: any) => { // Use 'any' temporarily
        // --- LOG THE ENTIRE ARGUMENT ---
        console.log("handleDeleteRowClick received full arguments:", menuEventArgs);
        // --- END LOG ---
    
        const passedProps = menuEventArgs?.props;
        console.log("handleDeleteRowClick attempted to access props:", passedProps);
    
        if (passedProps?.nodeId && passedProps.rowIndex !== undefined) {
             console.log(`Calling handleDeleteRow with NodeId=${passedProps.nodeId}, RowIndex=${passedProps.rowIndex}`);
            handleDeleteRow(passedProps.nodeId, passedProps.rowIndex);
        } else {
             // Also check direct args
             if (menuEventArgs?.nodeId && menuEventArgs.rowIndex !== undefined) {
                 console.log(`Calling handleDeleteRow (direct args) with NodeId=${menuEventArgs.nodeId}, RowIndex=${menuEventArgs.rowIndex}`);
                 handleDeleteRow(menuEventArgs.nodeId, menuEventArgs.rowIndex);
             } else {
                console.warn("handleDeleteRowClick: RowIndex or NodeId missing.", menuEventArgs);
             }
        }
    };

    useEffect(() => {
        if (!projectId) {
            setNodes([]); // Clear canvas if no project selected
            setEdges([]);
            setError(null);
            setLoading(false);
            return;
        }

        const fetchAndTransformRequirements = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch the requirements data
                const data = await apiClient<ProjectRequirementsResponse>(`/requirements/${projectId}`, {
                    method: 'GET',
                });

                console.log(`CanvasViewer: Received data for project ${projectId}`, data);

                // Add deep inspection of the data structure to debug the issue
                console.log("DEBUG - Full data structure:");
                console.log("project_id:", data.project_id);
                console.log("flows:", data.flows);

                if (data.flows && data.flows.length > 0) {
                    const sampleFlow = data.flows[0];
                    console.log("Sample flow:", sampleFlow);
                    console.log("Sample flow steps:", sampleFlow.steps);

                    if (sampleFlow.steps && sampleFlow.steps.length > 0) {
                        const sampleStep = sampleFlow.steps[0];
                        console.log("Sample step:", sampleStep);
                        console.log("Sample step HLRs:", sampleStep.high_level_requirements);

                        if (sampleStep.high_level_requirements && sampleStep.high_level_requirements.length > 0) {
                            const sampleHLR = sampleStep.high_level_requirements[0];
                            console.log("Sample HLR:", sampleHLR);
                            console.log("Sample HLR LLRs:", sampleHLR.low_level_requirements);

                            if (sampleHLR.low_level_requirements && sampleHLR.low_level_requirements.length > 0) {
                                const sampleLLR = sampleHLR.low_level_requirements[0];
                                console.log("Sample LLR:", sampleLLR);
                                console.log("Sample LLR test_cases:", sampleLLR.test_cases);
                            }
                        }
                    }
                }

                if (!data || !data.flows || data.flows.length === 0) {
                    console.log("CanvasViewer: No flows data received, clearing nodes/edges.");
                    setNodes([]);
                    setEdges([]);
                    // Optionally set a specific message: setError("No requirements found for this project.");
                    return; // Stop processing if no data
                }

                console.log("CanvasViewer: Transforming data...");

                // Transform the data into nodes and edges
                const { nodes: transformedNodes, edges: transformedEdges } = transformRequirementsToFlow(data);


                // --- Inject actions into node data ---
                const nodesWithActions = transformedNodes.map(node => ({
                    ...node,
                    // IMPORTANT: Merge actions into the existing data object
                    data: {
                        ...node.data, // Keep existing title, rows etc.
                        actions: nodeActions // Add the memoized actions object
                    }
                }));
                // --- End Inject actions ---


                console.log("Transformed Nodes:", transformedNodes);
                console.log("Transformed Edges:", transformedEdges);

                setNodes(nodesWithActions);
                setEdges(transformedEdges);

            } catch (err: any) {
                setError(err.message || `Failed to fetch requirements for project ${projectId}`);
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchAndTransformRequirements();
    }, [projectId, refreshTrigger, nodeActions, setNodes, setEdges]); // Re-run effect when projectId changes

    const getCanvasContent = () => {
        if (loading) {
            return <div className="absolute inset-0 flex items-center justify-center text-gray-500 z-10">Loading Canvas...</div>;
        }
        if (error) {
            return <div className="absolute inset-0 flex items-center justify-center text-red-600 z-10">Error: {error}</div>;
        }
        // Check if projectId is valid but nodes are empty AFTER loading and no error
        if (projectId !== null && nodes.length === 0 && !loading && !error) {
            return <div className="absolute inset-0 flex items-center justify-center text-gray-500 z-10">No requirements generated or loaded.</div>;
        }
        // If projectId is null, the parent container already shows a message.
        // Render ReactFlow only if there's a project and potentially data.
        if (projectId === null) return null;

        return (
            <> {/* Main Fragment for ReactFlow container and Menu */}
                <div className="flex-grow relative h-full w-full"> {/* Ensure container takes space */}
    
                    {/* Conditional Rendering Directly Here */}
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 z-10">Loading Canvas...</div>
                    )}
                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center text-red-600 dark:text-red-400 z-10">Error: {error}</div>
                    )}
                    {/* Show 'No requirements' only if NOT loading, NO error, and nodes ARE empty */}
                    {!loading && !error && projectId !== null && nodes.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 z-10">No requirements generated or loaded.</div>
                    )}
                    {/* Show 'Select project' if projectId is null (redundant? Parent handles this message) */}
                    {/* {!loading && !error && projectId === null && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 z-10">Select a project.</div>
                    )} */}
    
                    {/* Render ReactFlow only if needed and data is potentially ready */}
                    {projectId !== null && !loading && !error && (nodes.length > 0 || edges.length > 0) && ( // Render if not loading, no error, has projectID, and has nodes/edges
                         <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            nodeTypes={nodeTypes}
                            fitView
                            fitViewOptions={{ padding: 0.2 }}
                            className="bg-gradient-to-br from-blue-50 via-white to-indigo-50"
                        >
                            <Controls />
                            <MiniMap nodeStrokeWidth={3} zoomable pannable />
                            <Background variant="dots" gap={12} size={1} className="dark:opacity-20" /> 
                        </ReactFlow>
                     )}
                    {/* End Conditional Rendering */}
    
                </div>
    
                {/* --- Context Menu (Keep outside ReactFlow container) --- */}
                <Menu id={NODE_CONTEXT_MENU_ID} theme="all" animation="fade">
                     {/* ... Menu Items ... */}
                     <Item onClick={handleAddRowClick}> Add Row Below </Item>
                     <Item onClick={handleDeleteRowClick} disabled={({ props }) => props?.rowIndex === undefined}> Delete Row </Item>
                     <Separator />
                     <Item disabled>Rewrite using LLM</Item>
                     <Item disabled>Update Downstream</Item>
                     <Separator />
                     <Item disabled>Lock Item</Item>
                     <Item disabled>Lock All</Item>
                </Menu>
            </>
        );
    
    };


    // The outer div now comes from ProjectDashboard, this component just returns the content or ReactFlow
    return getCanvasContent();

};

function estimateNodeHeight(rows: number): number {
    const headerRowHeight = rows > 0 ? BASE_ROW_HEIGHT : 0;
    return NODE_HEADER_HEIGHT + headerRowHeight + (rows * BASE_ROW_HEIGHT) + 10;
}

const handleContextMenu = (e) => {
  e.preventDefault();
  e.stopPropagation();
  // Your menu showing logic
};

export default CanvasViewer;
