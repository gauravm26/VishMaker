// app-ui/src/components/canvas/InfrastructureCanvasViewer.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
    applyEdgeChanges,
    EdgeProps,
    EdgeTypes,
    getSmoothStepPath,
    MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';

import ParsedResourceNode from './ParsedResourceNode';
import TerraformParser, { ParsedResource } from '../../utils/terraformParser';

// Simple function to get resource type from TerraformParser data
const getResourceTypeFromTerraform = (resource: any): string => {
    // Use the service property directly from TerraformParser
    return resource.service || resource.resourceType || 'lambda';
};

// AWS icon mapping is now handled dynamically by getServiceIcon in terraformParser

// Custom edge component for infrastructure connections
const InfrastructureEdge: React.FC<EdgeProps> = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data
}) => {
    const [edgePath, labelX, labelY] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
    });

    const connectionType = data?.type || 'default';

    // Connection type styling - reduced weight and contrast
    const connectionStyles = {
        default: { stroke: '#64748b', strokeWidth: 1, strokeDasharray: '4,4', opacity: 0.4 },
        integration: { stroke: '#60a5fa', strokeWidth: 1, opacity: 0.5 },
        security: { stroke: '#f87171', strokeWidth: 1, opacity: 0.5 },
        storage: { stroke: '#a78bfa', strokeWidth: 1, opacity: 0.5 },
        database: { stroke: '#3b82f6', strokeWidth: 1, opacity: 0.5 },
        monitoring: { stroke: '#22d3ee', strokeWidth: 1, opacity: 0.5 },
        dependency: { stroke: '#6b7280', strokeWidth: 1, strokeDasharray: '2,3', opacity: 0.3 }
    };

    const baseStyle = connectionStyles[connectionType as keyof typeof connectionStyles];
    
    // Apply highlighting/dimming based on selection state
    let edgeStyle = { ...baseStyle, ...style };
    if (data?.isHighlighted === false) {
        // Dim the edge when not highlighted
        edgeStyle = { ...edgeStyle, opacity: 0.1, strokeWidth: 0.5 };
    } else if (data?.isHighlighted === true) {
        // Brighten the edge when highlighted
        edgeStyle = { ...edgeStyle, opacity: 0.8, strokeWidth: 2 };
    }

    return (
        <>
            <path
                id={id}
                style={edgeStyle}
                className="react-flow__edge-path"
                d={edgePath}
                markerEnd={markerEnd}
            />
            {data?.label && (
                <text>
                    <textPath
                        href={`#${id}`}
                        style={{ fontSize: 12, fill: '#94a3b8' }}
                        startOffset="50%"
                        textAnchor="middle"
                    >
                        {data.label}
                    </textPath>
                </text>
            )}
        </>
    );
};

// Sample infrastructure data - this would come from your Terraform or AWS API


// Sample connections between infrastructure components


interface InfrastructureCanvasViewerProps {
    projectId?: string | null;
    onNodeClick?: (nodeId: string, data: ParsedResource) => void;
    onNodeEdit?: (nodeId: string, data: ParsedResource) => void;
    terraformFiles?: Array<{ name: string; path: string; selected?: boolean }>;
    onTerraformFileSelect?: (filePath: string) => void;
    parsedTerraformResources?: ParsedResource[];
    groupedTerraformResources?: Record<string, {
        uuid: string;
        group_key: 'service' | 'category';
        child_uuids: string[];
        onScreenElements: {
            icon: string;
            label: string;
            connectionNodes: string[];
        };
    }>; // GroupedResources from cache
}

interface FilterOptions {
    searchTerm: string;
    serviceFilter: string;
    groupBy: 'service' | 'category' | 'none';
    showConnectivity: boolean;
    showDependencies: boolean;
    showAttributes: boolean;
}

const InfrastructureCanvasViewer: React.FC<InfrastructureCanvasViewerProps> = ({
    projectId,
    onNodeClick,
    onNodeEdit,
    terraformFiles,
    onTerraformFileSelect,
    parsedTerraformResources,
    groupedTerraformResources
}) => {
    // Use parsedTerraformResources as the main data source
    const infrastructureData = parsedTerraformResources || [];
    // Use groupedTerraformResources from cache instead of computing locally
    const groupedResources = groupedTerraformResources || {};

    // Convert ParsedResource data to ReactFlow nodes with better layout
    // Each node uses resource.uuid as the primary key for consistency
    const initialNodes: Node<ParsedResource>[] = infrastructureData.map((resource, index) => {
        // Create a more organized grid layout
        const cols = 5; // 5 columns for better spacing
        const spacingX = 380;
        const spacingY = 320;

        // Center the grid
        const startX = 50;
        const startY = 50;

        const col = index % cols;
        const row = Math.floor(index / cols);

        return {
            id: resource.uuid, // Use UUID as primary key
            type: 'parsedResourceNode',
            position: {
                x: startX + col * spacingX,
                y: startY + row * spacingY
            },
            data: resource,
            draggable: true,
            selectable: true
        };
    });

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

    // Filter state
    const [filterOptions, setFilterOptions] = useState<FilterOptions>({
        searchTerm: '',
        serviceFilter: '',
        groupBy: 'none', // Default to 'none' - show all resources
        showConnectivity: true,
        showDependencies: true,
        showAttributes: true
    });

    // Selection state for highlighting
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

    // Start with everything highlighted (no selection)
    const isInitialState = !selectedNodeId && !selectedEdgeId;

    // Modal state for showing node details
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedNodeData, setSelectedNodeData] = useState<ParsedResource | null>(null);
    
    // Resource details popup state
    const [selectedResourceDetails, setSelectedResourceDetails] = useState<any>(null);
    const [showResourcePopup, setShowResourcePopup] = useState(false);

    // Get unique services for filtering
    const services = useMemo(() => {
        const serviceSet = new Set(infrastructureData.map(resource => resource.service));
        return Array.from(serviceSet).sort();
    }, [infrastructureData]);

    // Use ParsedResource data directly for grouping
    const parsedResourcesForGrouping = useMemo(() => {
        return infrastructureData;
    }, [infrastructureData]);

    // Filtered infrastructure data
    const filteredInfrastructureData = useMemo(() => {
        return infrastructureData.filter(resource => {
            const matchesSearch = !filterOptions.searchTerm ||
                resource.name.toLowerCase().includes(filterOptions.searchTerm.toLowerCase()) ||
                resource.type.toLowerCase().includes(filterOptions.searchTerm.toLowerCase());

            const matchesService = !filterOptions.serviceFilter ||
                resource.service === filterOptions.serviceFilter;

            return matchesSearch && matchesService;
        });
    }, [infrastructureData, filterOptions.searchTerm, filterOptions.serviceFilter]);



    // Generate dynamic connections based on ParsedResource data
    const generateConnections = (infraData: ParsedResource[]): Edge[] => {
        const connections: Edge[] = [];

        // Create connections based on ParsedResource dependencies and onScreenElements.connectedNodes
        infraData.forEach((resource) => {
            // Use the connectedNodes from onScreenElements for dependency connections
            if (resource.onScreenElements.connectedNodes.length > 0) {
                resource.onScreenElements.connectedNodes.forEach(connectedNodeUuid => {
                    const targetResource = infraData.find(r => r.uuid === connectedNodeUuid);
                    if (targetResource) {
                        connections.push({
                            id: `e${connections.length + 1}`,
                            source: resource.uuid,
                            target: targetResource.uuid,
                            data: {
                                type: 'dependency',
                                label: 'depends on',
                                isHighlighted: true
                            }
                        });
                    }
                });
            }

            // Create connections based on resource type relationships
            if (resource.service === 'apigateway') {
                // API Gateway connects to Lambda functions
                infraData.forEach(target => {
                    if (target.service === 'lambda') {
                        connections.push({
                            id: `e${connections.length + 1}`,
                            source: resource.uuid,
                            target: target.uuid,
                            data: {
                                type: 'integration',
                                label: 'HTTP',
                                isHighlighted: true
                            }
                        });
                    }
                });
            } else if (resource.service === 'lambda') {
                // Lambda functions connect to databases and storage
                infraData.forEach(target => {
                    if (['dynamodb', 's3', 'rds'].includes(target.service)) {
                        connections.push({
                            id: `e${connections.length + 1}`,
                            source: resource.uuid,
                            target: target.uuid,
                            data: {
                                type: 'database',
                                label: 'CRUD',
                                isHighlighted: true
                            }
                        });
                    }
                });
            }
        });

        return connections;
    };

    const [edges, setEdges, onEdgesChange] = useEdgesState(generateConnections(infrastructureData));

    // Get connected nodes and edges for highlighting
    const getConnectedElements = useCallback((nodeId: string) => {
        const connectedNodeIds = new Set<string>();
        const connectedEdgeIds = new Set<string>();

        // Find all edges connected to this node
        edges.forEach(edge => {
            if (edge.source === nodeId || edge.target === nodeId) {
                connectedEdgeIds.add(edge.id);
                connectedNodeIds.add(edge.source);
                connectedNodeIds.add(edge.target);
            }
        });

        return { connectedNodeIds, connectedEdgeIds };
    }, [edges]);

    // Get connected nodes for edge highlighting
    const getEdgeConnectedNodes = useCallback((edgeId: string) => {
        const edge = edges.find(e => e.id === edgeId);
        if (!edge) return new Set<string>();

        return new Set([edge.source, edge.target]);
    }, [edges]);

    // Update edges when selection changes
    useEffect(() => {
        setEdges(generateConnections(filteredInfrastructureData));
    }, [selectedNodeId, selectedEdgeId, filteredInfrastructureData]);

    // Update nodes when filtered data changes - use groupedResources based on filter
    useEffect(() => {
        let filteredNodes: Node<ParsedResource>[] = [];
        
        if (filterOptions.groupBy === 'none') {
            // Show all resources in grid layout
            filteredNodes = filteredInfrastructureData.map((resource, index) => {
                const cols = 8;
                const spacingX = 120;
                const spacingY = 120;
                const startX = 50;
                const startY = 50;
                const col = index % cols;
                const row = Math.floor(index / cols);

                return {
                    id: resource.uuid,
                    type: 'parsedResourceNode',
                    position: {
                        x: startX + col * spacingX,
                        y: startY + row * spacingY
                    },
                    data: resource,
                    draggable: true,
                    selectable: true
                };
            });
        } else if (filterOptions.groupBy === 'service' || filterOptions.groupBy === 'category') {
            // Use groupedResources to filter and position nodes
            const groupKey = filterOptions.groupBy === 'service' ? 'service' : 'category';
            
            // Get resources that belong to the selected group
            Object.entries(groupedResources).forEach(([groupName, group]) => {
                if (group.group_key === groupKey) {
                    // Get the actual resources for this group
                    const groupResources = group.child_uuids.map(uuid => 
                        filteredInfrastructureData.find(r => r.uuid === uuid)
                    ).filter(Boolean) as ParsedResource[];
                    
                    // Position resources in a cluster for this group
                    groupResources.forEach((resource, index) => {
                        const cols = 4; // Smaller cluster
                        const spacingX = 100;
                        const spacingY = 100;
                        
                        // Extract service/category name from group key (e.g., "service_lambda" -> "lambda")
                        const groupIdentifier = groupName.replace(`${groupKey}_`, '');
                        const groupIndex = Object.keys(groupedResources).filter(k => 
                            k.startsWith(`${groupKey}_`)
                        ).indexOf(groupName);
                        
                        const groupX = 100 + (groupIndex % 3) * 400; // 3 groups per row
                        const groupY = 100 + Math.floor(groupIndex / 3) * 350; // New row every 3 groups
                        
                        const col = index % cols;
                        const row = Math.floor(index / cols);
                        
                        filteredNodes.push({
                            id: resource.uuid,
                            type: 'parsedResourceNode',
                            position: {
                                x: groupX + col * spacingX,
                                y: groupY + row * spacingY
                            },
                            data: resource,
                            draggable: true,
                            selectable: true
                        });
                    });
                }
            });
        }

        setNodes(filteredNodes);
        setEdges(generateConnections(filteredInfrastructureData));
    }, [filteredInfrastructureData, setNodes, setEdges, filterOptions.groupBy, groupedResources, isInitialState, selectedNodeId, selectedEdgeId]);

    // Handle node changes
    const handleNodesChange: OnNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setNodes((nds) => applyNodeChanges(changes, nds));
        },
        [setNodes]
    );

    // Handle edge changes
    const handleEdgesChange = useCallback(
        (changes: EdgeChange[]) => {
            setEdges((eds) => applyEdgeChanges(changes, eds));
        },
        [setEdges]
    );

    // Handle new connections
    const handleConnect = useCallback(
        (params: Connection) => {
            setEdges((eds) => addEdge(params, eds));
        },
        [setEdges]
    );

    // Handle node click (single click for highlighting)
    const handleNodeClick = useCallback((event: React.MouseEvent, node: Node<ParsedResource>) => {
        console.log('Infrastructure node clicked:', node.id, node.data);
        console.log('Node UUID:', node.data.uuid, 'Node Name:', node.data.name);

        // Set selected node and clear edge selection
        setSelectedNodeId(node.id); // This is the UUID
        setSelectedEdgeId(null);

        onNodeClick?.(node.id, node.data);
    }, [onNodeClick]);

    // Handle node double click (opens modal)
    const handleNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node<ParsedResource>) => {
        console.log('Infrastructure node double-clicked:', node.id, node.data);
        console.log('Node UUID:', node.data.uuid, 'Node Name:', node.data.name);

        // Show details modal
        setSelectedNodeData(node.data);
        setShowDetailsModal(true);

        // Get connected resources using the new UUID-based method
        const connectedResources = TerraformParser.getConnectedResources(node.data.uuid, infrastructureData);
        console.log('Connected resources for', node.data.name, ':', connectedResources);

        // Also prepare resource details for Terraform popup
        const resourceDetails = {
            ...node.data,
            terraformType: node.data.type,
            terraformAddress: node.data.address,
            terraformCategory: node.data.onScreenElements.label,
            terraformService: node.data.service,
            terraformProvider: node.data.provider,
            terraformAttributes: node.data.attributes || {},
            terraformConfiguration: node.data.attributes || {},
            terraformDependencies: connectedResources.map(resource => ({
                uuid: resource.uuid,
                name: resource.name,
                type: resource.type,
                service: resource.service,
                connection: 'depends on'
            })),
            terraformModules: node.data.modules,
            connectedResourcesCount: connectedResources.length
        };
        setSelectedResourceDetails(resourceDetails);
        setShowResourcePopup(true);
    }, [infrastructureData]);

    // Handle edge click
    const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
        console.log('Edge clicked:', edge.id);
        console.log('Edge source UUID:', edge.source, 'Edge target UUID:', edge.target);

        // Set selected edge and clear node selection
        setSelectedEdgeId(edge.id);
        setSelectedNodeId(null);
    }, []);

    // Handle canvas click (click away)
    const handleCanvasClick = useCallback((event: React.MouseEvent) => {
        // Clear selection to return everything to highlighted state
        console.log('Canvas clicked - resetting to full highlight');
        console.log('Clearing selected node UUID:', selectedNodeId, 'and edge ID:', selectedEdgeId);
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
    }, [selectedNodeId, selectedEdgeId]);

    // Handle node edit
    const handleNodeEdit = useCallback((nodeId: string, data: ParsedResource) => {
        console.log('Infrastructure node edit:', nodeId, data);
        console.log('Editing node with UUID:', data.uuid, 'Name:', data.name);
        onNodeEdit?.(nodeId, data);
    }, [onNodeEdit]);

    // Custom node types
    const nodeTypes: NodeTypes = {
        parsedResourceNode: (props) => (
            <ParsedResourceNode
                {...props}
                onNodeClick={(nodeId: string, data: ParsedResource) => {
                    // Convert to ReactFlow format
                    const mockEvent = {} as React.MouseEvent;
                    const mockNode = { id: nodeId, data } as Node<ParsedResource>;
                    handleNodeClick(mockEvent, mockNode);
                }}
                onNodeDoubleClick={(nodeId: string, data: ParsedResource) => {
                    // Convert to ReactFlow format
                    const mockEvent = {} as React.MouseEvent;
                    const mockNode = { id: nodeId, data } as Node<ParsedResource>;
                    handleNodeDoubleClick(mockEvent, mockNode);
                }}
                onNodeEdit={handleNodeEdit}
            />
        )
    };

    // Custom edge types
    const edgeTypes: EdgeTypes = {
        infrastructureEdge: InfrastructureEdge
    };

    return (
        <div className="w-full h-full bg-gray-900 flex">
            {/* Left Sidebar - Terraform Files */}
            {terraformFiles && terraformFiles.length > 0 && (
                <div className="w-80 bg-gray-800/95 backdrop-blur-md border-r border-gray-700 p-4 overflow-y-auto">
                    <h3 className="text-lg font-bold text-blue-400 mb-4">Terraform Files</h3>
                    <div className="text-xs text-gray-400 mb-4">
                        {terraformFiles.length} .tf files found
                    </div>
                    <div className="space-y-2">
                        {terraformFiles.map((file, index) => (
                            <div
                                key={index}
                                onClick={() => onTerraformFileSelect?.(file.path)}
                                className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${file.selected
                                        ? 'bg-blue-600/30 border border-blue-400/50'
                                        : 'bg-gray-700/50 border border-gray-600/50 hover:bg-gray-700/70'
                                    }`}
                            >
                                <div className="flex items-center space-x-2">
                                    <span className="text-blue-400">📄</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-gray-400 truncate">
                                            {file.path}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Canvas Area */}
            <div className="flex-1 relative">

                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={handleNodesChange}
                    onEdgesChange={handleEdgesChange}
                    onConnect={handleConnect}
                    onNodeClick={handleNodeClick}
                    onNodeDoubleClick={handleNodeDoubleClick}
                    onEdgeClick={handleEdgeClick}
                    onPaneClick={handleCanvasClick}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    connectionLineType={ConnectionLineType.SmoothStep}
                    fitView
                    attributionPosition="bottom-left"
                    className="bg-gray-900"
                >
                    {/* Background */}
                    <Background
                        variant={BackgroundVariant.Dots}
                        gap={30}
                        size={1.5}
                        color="#4B5563"
                        className="opacity-30"
                    />

                    {/* Controls */}
                    <Controls className="bg-gray-800 border border-gray-600 rounded-lg" />

                    {/* Mini Map */}
                    <MiniMap
                        className="bg-gray-800 border border-gray-600 rounded-lg"
                        nodeColor="#6b7280"
                        maskColor="rgba(0, 0, 0, 0.1)"
                    />


                </ReactFlow>


            </div>

            {/* Right Sidebar - Advanced Filtering & Options */}
            <div className="w-80 bg-gray-800/95 backdrop-blur-md border-l border-gray-700 p-4 overflow-y-auto">
                <h3 className="text-lg font-bold text-blue-400 mb-4">Visualization Options</h3>

                {/* Group By */}
                <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-300 mb-2">Group By</label>
                    <select
                        value={filterOptions.groupBy}
                        onChange={(e) => setFilterOptions(prev => ({ ...prev, groupBy: e.target.value as 'service' | 'category' | 'none' }))}
                        className="w-full px-3 py-2 text-sm bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50"
                    >
                        <option value="none">Show All Resources</option>
                        <option value="service">By Service</option>
                        <option value="category">By Category</option>
                    </select>
                </div>

                {/* Search */}
                <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-300 mb-2">Search Resources</label>
                    <input
                        type="text"
                        value={filterOptions.searchTerm}
                        onChange={(e) => setFilterOptions(prev => ({ ...prev, searchTerm: e.target.value }))}
                        placeholder="Search by name or description..."
                        className="w-full px-3 py-2 text-sm bg-gray-700/50 border border-gray-600/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50"
                    />
                </div>

                {/* Service Filter */}
                <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-300 mb-2">Filter by Service</label>
                    <select
                        value={filterOptions.serviceFilter}
                        onChange={(e) => setFilterOptions(prev => ({ ...prev, serviceFilter: e.target.value }))}
                        className="w-full px-3 py-2 text-sm bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50"
                    >
                        <option value="">All Services</option>
                        {services.map(service => (
                            <option key={service} value={service} className="capitalize">{service}</option>
                        ))}
                    </select>
                </div>

                {/* Display Options */}
                <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Display Options</h4>
                    <div className="space-y-2">
                        <label className="flex items-center text-xs text-gray-300">
                            <input
                                type="checkbox"
                                checked={filterOptions.showConnectivity}
                                onChange={(e) => setFilterOptions(prev => ({ ...prev, showConnectivity: e.target.checked }))}
                                className="mr-2"
                            />
                            Show Connectivity
                        </label>
                        <label className="flex items-center text-gray-300 text-xs">
                            <input
                                type="checkbox"
                                checked={filterOptions.showDependencies}
                                onChange={(e) => setFilterOptions(prev => ({ ...prev, showDependencies: e.target.checked }))}
                                className="mr-2"
                            />
                            Show Dependencies
                        </label>
                        <label className="flex items-center text-gray-300 text-xs">
                            <input
                                type="checkbox"
                                checked={filterOptions.showAttributes}
                                onChange={(e) => setFilterOptions(prev => ({ ...prev, showAttributes: e.target.checked }))}
                                className="mr-2"
                            />
                            Show Attributes
                        </label>
                    </div>
                </div>



                {/* Resource Statistics */}
                <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Resource Statistics</h4>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Total Resources:</span>
                            <span className="text-white font-medium">{filteredInfrastructureData.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Lambda Functions:</span>
                            <span className="text-white font-medium">
                                {filteredInfrastructureData.filter(r => getResourceTypeFromTerraform(r) === 'lambda').length}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Databases:</span>
                            <span className="text-white font-medium">
                                {filteredInfrastructureData.filter(r => ['dynamodb', 'rds'].includes(getResourceTypeFromTerraform(r))).length}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Storage:</span>
                            <span className="text-white font-medium">
                                {filteredInfrastructureData.filter(r => ['s3', 'cloudfront'].includes(getResourceTypeFromTerraform(r))).length}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Security:</span>
                            <span className="text-white font-medium">
                                {filteredInfrastructureData.filter(r => ['iam', 'cognito'].includes(getResourceTypeFromTerraform(r))).length}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Monitoring:</span>
                            <span className="text-white font-medium">
                                {filteredInfrastructureData.filter(r => ['cloudwatch', 'xray'].includes(getResourceTypeFromTerraform(r))).length}
                            </span>
                        </div>
                    </div>
                </div>





                {/* Quick Actions */}
                <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Quick Actions</h4>
                    <div className="space-y-2">
                        <button className="w-full p-2 bg-gray-700/50 border border-gray-600/50 rounded text-gray-300 hover:bg-gray-700/70 transition-all duration-200 text-sm">
                            🔍 Zoom to Fit
                        </button>
                        <button className="w-full p-2 bg-gray-700/50 border border-gray-600/50 rounded text-gray-300 hover:bg-gray-700/70 transition-all duration-200 text-sm">
                            📊 Export Diagram
                        </button>
                        <button className="w-full p-2 bg-gray-700/50 border border-gray-600/50 rounded text-gray-300 hover:bg-gray-700/70 transition-all duration-200 text-sm">
                            🎨 Toggle Labels
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Details Modal */}
            {showDetailsModal && selectedNodeData && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">Resource Details</h3>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="text-gray-400 hover:text-white text-xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-4">
                                                    <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 flex items-center justify-center">
                                {selectedNodeData.onScreenElements.icon ? (
                                    <img src={selectedNodeData.onScreenElements.icon} alt={selectedNodeData.service} className="w-12 h-12" />
                                ) : (
                                    <div className="text-3xl text-white">⚡</div>
                                )}
                            </div>
                            <div>
                                <h4 className="font-bold text-white">{selectedNodeData.name}</h4>
                                <p className="text-sm text-gray-300">{selectedNodeData.service}</p>
                            </div>
                        </div>

                        <div>
                            <h5 className="font-medium text-gray-300 mb-2">Resource Type</h5>
                            <p className="text-sm text-gray-400">{selectedNodeData.type}</p>
                        </div>

                        <div>
                            <h5 className="font-medium text-gray-300 mb-2">Category</h5>
                            <p className="text-sm text-gray-400">{selectedNodeData.category}</p>
                        </div>

                        <div>
                            <h5 className="font-medium text-gray-300 mb-2">Provider</h5>
                            <p className="text-sm text-gray-400">{selectedNodeData.provider}</p>
                        </div>

                        {selectedNodeData.modules && selectedNodeData.modules.length > 0 && (
                            <div>
                                <h5 className="font-medium text-gray-300 mb-2">Modules</h5>
                                <div className="space-y-1">
                                    {selectedNodeData.modules.map((module, idx) => (
                                        <div key={idx} className="text-xs text-gray-400 bg-gray-700 p-2 rounded">
                                            {module}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedNodeData.attributes && Object.keys(selectedNodeData.attributes || {}).length > 0 && (
                            <div>
                                <h5 className="font-medium text-gray-300 mb-2">Attributes</h5>
                                <div className="space-y-1">
                                    {Object.entries(selectedNodeData.attributes || {}).slice(0, 5).map(([key, value]) => (
                                        <div key={key} className="text-xs text-gray-400">
                                            <span className="font-medium">{key}:</span> {String(value)}
                                        </div>
                                    ))}
                                    {Object.keys(selectedNodeData.attributes || {}).length > 5 && (
                                        <div className="text-xs text-gray-500 italic">
                                            +{Object.keys(selectedNodeData.attributes || {}).length - 5} more...
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        </div>
                    </div>
                </div>
            )}

            {/* Terraform Resource Details Popup */}
            {showResourcePopup && selectedResourceDetails && (
                <div 
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    onClick={() => setShowResourcePopup(false)}
                >
                    <div 
                        className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">Terraform Resource Details</h3>
                            <button
                                onClick={() => setShowResourcePopup(false)}
                                className="text-gray-400 hover:text-white text-xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                            {/* Basic Information */}
                                <div className="space-y-4">
                                    <div className="bg-gray-700/50 rounded-lg p-4">
                                        <h4 className="font-semibold text-blue-400 mb-3">Basic Information</h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-300">Resource UUID:</span>
                                                <span className="text-white font-mono text-xs">{selectedResourceDetails.uuid}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-300">Resource Name:</span>
                                                <span className="text-white font-mono">{selectedResourceDetails.terraformAddress}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-300">Type:</span>
                                                <span className="text-white font-mono">{selectedResourceDetails.terraformType}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-300">Provider:</span>
                                                <span className="text-white font-mono">{selectedResourceDetails.terraformProvider}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-300">Service:</span>
                                                <span className="text-white font-mono">{selectedResourceDetails.terraformService}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-300">Category:</span>
                                                <span className="text-white font-mono">{selectedResourceDetails.terraformCategory}</span>
                                            </div>
                                        </div>
                                    </div>

                                {/* Terraform Configuration */}
                                {Object.keys(selectedResourceDetails.terraformConfiguration || {}).length > 0 && (
                                    <div className="bg-gray-700/50 rounded-lg p-4">
                                        <h4 className="font-semibold text-green-400 mb-3">Configuration</h4>
                                        <div className="space-y-2">
                                            {Object.entries(selectedResourceDetails.terraformConfiguration).map(([key, value]) => (
                                                <div key={key} className="text-sm">
                                                    <div className="text-gray-300 font-medium">{key}:</div>
                                                    <div className="text-white font-mono text-xs bg-gray-800 p-2 rounded mt-1">
                                                        {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Terraform Attributes & Tags */}
                            <div className="space-y-4">
                                {/* Tags */}
                                {Object.keys(selectedResourceDetails.terraformAttributes || {}).length > 0 && (
                                    <div className="bg-gray-700/50 rounded-lg p-4">
                                        <h4 className="font-semibold text-yellow-400 mb-3">Tags</h4>
                                        <div className="space-y-2">
                                            {Object.entries(selectedResourceDetails.terraformAttributes).map(([key, value]) => (
                                                <div key={key} className="text-sm">
                                                    <div className="text-gray-300 font-medium">{key}:</div>
                                                    <div className="text-white font-mono text-xs bg-gray-800 p-2 rounded mt-1">
                                                        {String(value)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Dependencies */}
                                <div className="bg-gray-700/50 rounded-lg p-4">
                                    <h4 className="font-semibold text-purple-400 mb-3">Dependencies ({selectedResourceDetails.connectedResourcesCount || 0})</h4>
                                    <div className="text-sm text-gray-400">
                                        {selectedResourceDetails.terraformDependencies && selectedResourceDetails.terraformDependencies.length > 0 ? (
                                            <div className="space-y-1">
                                                {selectedResourceDetails.terraformDependencies.map((dep: any, idx: number) => (
                                                    <div key={idx} className="text-white font-mono text-xs bg-gray-800 p-2 rounded">
                                                        <div className="flex justify-between items-center">
                                                            <span>{dep.name} ({dep.service})</span>
                                                            <span className="text-gray-400 text-xs">{dep.uuid}</span>
                                                        </div>
                                                        <div className="text-gray-400 text-xs mt-1">{dep.connection}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-gray-500 italic">No explicit dependencies defined</span>
                                        )}
                                    </div>
                                </div>

                                {/* Modules */}
                                <div className="bg-gray-700/50 rounded-lg p-4">
                                    <h4 className="font-semibold text-orange-400 mb-3">Modules</h4>
                                    <div className="text-sm text-gray-400">
                                        {selectedResourceDetails.terraformModules.length > 0 ? (
                                            <div className="space-y-1">
                                                {selectedResourceDetails.terraformModules.map((module: string, idx: number) => (
                                                    <div key={idx} className="text-white font-mono text-xs bg-gray-800 p-2 rounded">
                                                        {module}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-gray-500 italic">Standalone resource (no modules)</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Raw Terraform Data */}
                        <div className="mt-6 bg-gray-700/50 rounded-lg p-4">
                            <h4 className="font-semibold text-gray-300 mb-3">Raw Terraform Data</h4>
                            <pre className="text-xs text-gray-300 bg-gray-800 p-3 rounded overflow-x-auto">
                                {JSON.stringify(selectedResourceDetails, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InfrastructureCanvasViewer;
