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
} from 'reactflow';
import 'reactflow/dist/style.css'; // Import react-flow styles

import apiClient from '@/lib/apiClient'; // Using path alias if configured, else use relative path
import { ProjectRequirementsResponse } from '@/types/project'; // API response type
import { CustomNode, CustomEdge } from '@/types/canvas'; // react-flow types
import { transformRequirementsToFlow } from '@/lib/transformRequirementsToFlow'; // Transformation function
import TableNode from './TableNode'; // Import the custom node component

interface CanvasViewerProps {
    projectId: number | null; // ID of the project whose requirements to display
    refreshTrigger: number; 
}

// Define the custom node types for React Flow
// The key ('tableNode') MUST match the 'type' used in transformRequirementsToFlow
const nodeTypes: NodeTypes = {
    tableNode: TableNode,
};

const CanvasViewer: React.FC<CanvasViewerProps> = ({ projectId, refreshTrigger }) => {
    const [nodes, setNodes] = useState<CustomNode[]>([]);
    const [edges, setEdges] = useState<CustomEdge[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // --- React Flow state handlers ---
    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
        [setNodes]
    );
    const onEdgesChange = useCallback(
        (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
        [setEdges]
    );
    // Handler for connecting nodes manually (optional, maybe disable for read-only view)
    const onConnect = useCallback(
        (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
        [setEdges]
    );
    // --- End React Flow handlers ---


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

                console.log("Transformed Nodes:", transformedNodes);
                console.log("Transformed Edges:", transformedEdges);

                setNodes(transformedNodes);
                setEdges(transformedEdges);

            } catch (err: any) {
                setError(err.message || `Failed to fetch requirements for project ${projectId}`);
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchAndTransformRequirements();
    }, [projectId, refreshTrigger]); // Re-run effect when projectId changes

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
             <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                // onConnect={onConnect} // Disable manual connection for now?
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.1 }}
                className="bg-gradient-to-br from-blue-50 via-white to-indigo-50"
            >
                <Controls />
                <MiniMap nodeStrokeWidth={3} zoomable pannable />
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            </ReactFlow>
        );
    };


    // The outer div now comes from ProjectDashboard, this component just returns the content or ReactFlow
    return getCanvasContent();

};

export default CanvasViewer;
