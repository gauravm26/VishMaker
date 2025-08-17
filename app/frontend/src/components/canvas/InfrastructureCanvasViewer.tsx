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

import InfrastructureNode, { InfrastructureNodeData, InfrastructureResourceType, RESOURCE_CONFIG } from './InfrastructureNode';

// Import AWS icons
import lambdaIcon from '../../../assets/aws/lambda.svg';
import dynamodbIcon from '../../../assets/aws/dynamodb.svg';
import cognitoIcon from '../../../assets/aws/cognito.svg';
import apigatewayIcon from '../../../assets/aws/apigateway.svg';
import iamIcon from '../../../assets/aws/iam.svg';
import s3Icon from '../../../assets/aws/s3.svg';

// AWS icon mapping
const AWS_ICONS: Record<string, string> = {
    lambda: lambdaIcon,
    dynamodb: dynamodbIcon,
    cognito: cognitoIcon,
    apigateway: apigatewayIcon,
    iam: iamIcon,
    s3: s3Icon,
    // Default fallback
    default: lambdaIcon
};

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
const SAMPLE_INFRASTRUCTURE: InfrastructureNodeData[] = [
    {
        title: 'VishMaker API Gateway',
        resourceType: 'apigateway',
        description: 'HTTP API Gateway for all backend services',
        status: 'active',
        region: 'us-east-1',
        tags: { Environment: 'prod', Project: 'VishMaker' },
        metrics: { requests: 1500, errors: 5 },
        security: { encryption: true, public: false }
    },
    {
        title: 'Auth Lambda',
        resourceType: 'lambda',
        description: 'Authentication and user management service',
        status: 'active',
        region: 'us-east-1',
        tags: { Service: 'auth', Environment: 'prod' },
        metrics: { cpu: 45, memory: 60, requests: 800 },
        cost: { monthly: 12.50, daily: 0.42 }
    },
    {
        title: 'LLM Lambda',
        resourceType: 'lambda',
        description: 'AI/ML processing and code generation service',
        status: 'active',
        region: 'us-east-1',
        tags: { Service: 'llm', Environment: 'prod' },
        metrics: { cpu: 78, memory: 85, requests: 300 },
        cost: { monthly: 45.20, daily: 1.51 }
    },
    {
        title: 'Projects Lambda',
        resourceType: 'lambda',
        description: 'Project management and CRUD operations',
        status: 'active',
        region: 'us-east-1',
        tags: { Service: 'projects', Environment: 'prod' },
        metrics: { cpu: 32, memory: 45, requests: 1200 },
        cost: { monthly: 8.75, daily: 0.29 }
    },
    {
        title: 'User Flows Table',
        resourceType: 'dynamodb',
        description: 'User flow and requirement storage',
        status: 'active',
        region: 'us-east-1',
        tags: { Table: 'user-flows', Environment: 'prod' },
        metrics: { requests: 2500 },
        cost: { monthly: 23.40, daily: 0.78 },
        security: { encryption: true }
    },
    {
        title: 'Requirements Table',
        resourceType: 'dynamodb',
        description: 'High and low level requirements storage',
        status: 'active',
        region: 'us-east-1',
        tags: { Table: 'requirements', Environment: 'prod' },
        metrics: { requests: 1800 },
        cost: { monthly: 18.90, daily: 0.63 },
        security: { encryption: true }
    },
    {
        title: 'Config S3 Bucket',
        resourceType: 's3',
        description: 'Application configuration and static assets',
        status: 'active',
        region: 'us-east-1',
        tags: { Bucket: 'configs', Environment: 'prod' },
        cost: { monthly: 2.15, daily: 0.07 },
        security: { encryption: true, public: false }
    },
    {
        title: 'CloudFront Distribution',
        resourceType: 'cloudfront',
        description: 'Global content delivery and caching',
        status: 'active',
        region: 'global',
        tags: { Service: 'cdn', Environment: 'prod' },
        metrics: { requests: 5000 },
        cost: { monthly: 15.80, daily: 0.53 }
    },
    {
        title: 'Cognito User Pool',
        resourceType: 'cognito',
        description: 'User authentication and management',
        status: 'active',
        region: 'us-east-1',
        tags: { Service: 'auth', Environment: 'prod' },
        security: { encryption: true, compliance: ['SOC2', 'GDPR'] }
    },
    {
        title: 'IAM Roles & Policies',
        resourceType: 'iam',
        description: 'Security permissions and access control',
        status: 'active',
        region: 'us-east-1',
        tags: { Service: 'security', Environment: 'prod' },
        security: { encryption: true }
    },
    {
        title: 'CloudWatch Logs',
        resourceType: 'cloudwatch',
        description: 'Application monitoring and logging',
        status: 'active',
        region: 'us-east-1',
        tags: { Service: 'monitoring', Environment: 'prod' },
        cost: { monthly: 8.45, daily: 0.28 }
    },
    {
        title: 'Route53 DNS',
        resourceType: 'route53',
        description: 'Domain management and routing',
        status: 'active',
        region: 'us-east-1',
        tags: { Service: 'dns', Environment: 'prod' },
        cost: { monthly: 0.50, daily: 0.02 }
    }
];

// Sample connections between infrastructure components
const SAMPLE_CONNECTIONS: Edge[] = [
    // API Gateway connections
    { id: 'e1', source: 'VishMaker API Gateway', target: 'Auth Lambda', data: { type: 'integration', label: 'HTTP' } },
    { id: 'e2', source: 'VishMaker API Gateway', target: 'LLM Lambda', data: { type: 'integration', label: 'HTTP' } },
    { id: 'e3', source: 'VishMaker API Gateway', target: 'Projects Lambda', data: { type: 'integration', label: 'HTTP' } },

    // Lambda to DynamoDB connections
    { id: 'e4', source: 'Auth Lambda', target: 'User Flows Table', data: { type: 'database', label: 'CRUD' } },
    { id: 'e5', source: 'LLM Lambda', target: 'User Flows Table', data: { type: 'database', label: 'CRUD' } },
    { id: 'e6', source: 'Projects Lambda', target: 'User Flows Table', data: { type: 'database', label: 'CRUD' } },
    { id: 'e7', source: 'LLM Lambda', target: 'Requirements Table', data: { type: 'database', label: 'CRUD' } },
    { id: 'e8', source: 'Projects Lambda', target: 'Requirements Table', data: { type: 'database', label: 'CRUD' } },

    // Lambda to S3 connections
    { id: 'e9', source: 'LLM Lambda', target: 'Config S3 Bucket', data: { type: 'storage', label: 'Config' } },

    // CloudFront connections
    { id: 'e10', source: 'CloudFront Distribution', target: 'Config S3 Bucket', data: { type: 'storage', label: 'Origin' } },

    // Security connections
    { id: 'e11', source: 'IAM Roles & Policies', target: 'Auth Lambda', data: { type: 'security', label: 'Permissions' } },
    { id: 'e12', source: 'IAM Roles & Policies', target: 'LLM Lambda', data: { type: 'security', label: 'Permissions' } },
    { id: 'e13', source: 'IAM Roles & Policies', target: 'Projects Lambda', data: { type: 'security', label: 'Permissions' } },

    // Monitoring connections
    { id: 'e14', source: 'Auth Lambda', target: 'CloudWatch Logs', data: { type: 'monitoring', label: 'Logs' } },
    { id: 'e15', source: 'LLM Lambda', target: 'CloudWatch Logs', data: { type: 'monitoring', label: 'Logs' } },
    { id: 'e16', source: 'Projects Lambda', target: 'CloudWatch Logs', data: { type: 'monitoring', label: 'Logs' } },

    // DNS connections
    { id: 'e17', source: 'Route53 DNS', target: 'CloudFront Distribution', data: { type: 'dependency', label: 'CNAME' } },
    { id: 'e18', source: 'Route53 DNS', target: 'VishMaker API Gateway', data: { type: 'dependency', label: 'CNAME' } },

    // Authentication flow
    { id: 'e19', source: 'Auth Lambda', target: 'Cognito User Pool', data: { type: 'integration', label: 'Auth' } },

    // Data flow dependencies
    { id: 'e20', source: 'User Flows Table', target: 'Requirements Table', data: { type: 'dependency', label: 'References' } }
];

interface InfrastructureCanvasViewerProps {
    projectId?: string | null;
    onNodeClick?: (nodeId: string, data: InfrastructureNodeData) => void;
    onNodeEdit?: (nodeId: string, data: InfrastructureNodeData) => void;
    customInfrastructureData?: InfrastructureNodeData[];
    terraformFiles?: Array<{ name: string; path: string; selected?: boolean }>;
    onTerraformFileSelect?: (filePath: string) => void;
    onGroupByService?: () => void;
}

interface FilterOptions {
    searchTerm: string;
    serviceFilter: string;
    showConnectivity: boolean;
    showDependencies: boolean;
    showAttributes: boolean;
}

const InfrastructureCanvasViewer: React.FC<InfrastructureCanvasViewerProps> = ({
    projectId,
    onNodeClick,
    onNodeEdit,
    customInfrastructureData,
    terraformFiles,
    onTerraformFileSelect,
    onGroupByService
}) => {
    // Use custom data if provided, otherwise use sample data
    const infrastructureData = customInfrastructureData || SAMPLE_INFRASTRUCTURE;

    // Convert infrastructure data to ReactFlow nodes with better layout
    const initialNodes: Node<InfrastructureNodeData>[] = infrastructureData.map((resource, index) => {
        // Create a more organized grid layout
        const cols = 5; // 5 columns for better spacing
        const nodeWidth = 320;
        const nodeHeight = 280;
        const spacingX = 380;
        const spacingY = 320;

        // Center the grid
        const startX = 50;
        const startY = 50;

        const col = index % cols;
        const row = Math.floor(index / cols);

        return {
            id: resource.title,
            type: 'infrastructureNode',
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
    const [selectedNodeData, setSelectedNodeData] = useState<InfrastructureNodeData | null>(null);

    // Get unique services for filtering
    const services = useMemo(() => {
        const serviceSet = new Set(infrastructureData.map(resource => resource.resourceType));
        return Array.from(serviceSet).sort();
    }, [infrastructureData]);

    // Filtered infrastructure data
    const filteredInfrastructureData = useMemo(() => {
        return infrastructureData.filter(resource => {
            const matchesSearch = !filterOptions.searchTerm ||
                resource.title.toLowerCase().includes(filterOptions.searchTerm.toLowerCase()) ||
                (resource.description || '').toLowerCase().includes(filterOptions.searchTerm.toLowerCase());

            const matchesService = !filterOptions.serviceFilter ||
                resource.resourceType === filterOptions.serviceFilter;

            return matchesSearch && matchesService;
        });
    }, [infrastructureData, filterOptions]);



    // Generate dynamic connections based on infrastructure data
    const generateConnections = (infraData: InfrastructureNodeData[]): Edge[] => {
        const connections: Edge[] = [];
        const nodeIds = infraData.map(item => item.title);

        // Create basic connections based on resource types
        infraData.forEach((resource, index) => {
            if (resource.resourceType === 'apigateway') {
                // API Gateway connects to Lambda functions
                infraData.forEach(target => {
                    if (target.resourceType === 'lambda') {
                        // Determine if this edge should be highlighted
                        let isHighlighted = false;
                        const edgeId = `e${connections.length + 1}`;
                        if (isInitialState) {
                            // Initial state: everything is highlighted
                            isHighlighted = true;
                        } else if (selectedNodeId) {
                            const { connectedEdgeIds } = getConnectedElements(selectedNodeId);
                            isHighlighted = connectedEdgeIds.has(edgeId);
                        } else if (selectedEdgeId) {
                            isHighlighted = selectedEdgeId === edgeId;
                        } else {
                            isHighlighted = false;
                        }

                        connections.push({
                            id: `e${connections.length + 1}`,
                            source: resource.title,
                            target: target.title,
                            data: {
                                type: 'integration',
                                label: 'HTTP',
                                isHighlighted
                            }
                        });
                    }
                });
            } else if (resource.resourceType === 'lambda') {
                // Lambda functions connect to databases and storage
                infraData.forEach(target => {
                    if (['dynamodb', 's3', 'rds'].includes(target.resourceType)) {
                        // Determine if this edge should be highlighted
                        let isHighlighted = false;
                        const edgeId = `e${connections.length + 1}`;
                        if (isInitialState) {
                            // Initial state: everything is highlighted
                            isHighlighted = true;
                        } else if (selectedNodeId) {
                            const { connectedEdgeIds } = getConnectedElements(selectedNodeId);
                            isHighlighted = connectedEdgeIds.has(edgeId);
                        } else if (selectedEdgeId) {
                            isHighlighted = selectedEdgeId === edgeId;
                        } else {
                            isHighlighted = false;
                        }

                        connections.push({
                            id: `e${connections.length + 1}`,
                            source: resource.title,
                            target: target.title,
                            data: {
                                type: 'database',
                                label: 'CRUD',
                                isHighlighted
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

    // Update nodes when filtered data changes
    useEffect(() => {
        const filteredNodes: Node<InfrastructureNodeData>[] = filteredInfrastructureData.map((resource, index) => {
            const cols = 8; // More columns since nodes are smaller
            const spacingX = 120; // Smaller spacing since nodes are smaller
            const spacingY = 120;

            const startX = 50;
            const startY = 50;

            const col = index % cols;
            const row = Math.floor(index / cols);

            // Get AWS icon for the resource type
            const awsIcon = AWS_ICONS[resource.resourceType] || AWS_ICONS.default;

            // Determine if this node should be highlighted
            let isHighlighted = false;
            let isConnected = false;

            if (isInitialState) {
                // Initial state: everything is highlighted
                isHighlighted = true;
                isConnected = false;
            } else if (selectedNodeId) {
                // Node selected: highlight selected node and connected nodes, dim everything else
                const { connectedNodeIds } = getConnectedElements(selectedNodeId);
                if (resource.title === selectedNodeId) {
                    isHighlighted = true;
                    isConnected = false;
                } else if (connectedNodeIds.has(resource.title)) {
                    isHighlighted = true;
                    isConnected = true;
                } else {
                    isHighlighted = false;
                    isConnected = false;
                }
            } else if (selectedEdgeId) {
                // Edge selected: highlight connected nodes, dim everything else
                const connectedNodeIds = getEdgeConnectedNodes(selectedEdgeId);
                if (connectedNodeIds.has(resource.title)) {
                    isHighlighted = true;
                    isConnected = false;
                } else {
                    isHighlighted = false;
                    isConnected = false;
                }
            }

            return {
                id: resource.title,
                type: 'infrastructureNode',
                position: {
                    x: startX + col * spacingX,
                    y: startY + row * spacingY
                },
                data: {
                    ...resource,
                    awsIcon: awsIcon,
                    isHighlighted,
                    isConnected
                },
                draggable: true,
                selectable: true
            };
        });

        setNodes(filteredNodes);
        setEdges(generateConnections(filteredInfrastructureData));
    }, [filteredInfrastructureData, setNodes, setEdges]);

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
    const handleNodeClick = useCallback((nodeId: string, data: InfrastructureNodeData) => {
        console.log('Infrastructure node clicked:', nodeId, data);

        // Set selected node and clear edge selection
        setSelectedNodeId(nodeId);
        setSelectedEdgeId(null);

        onNodeClick?.(nodeId, data);
    }, [onNodeClick]);

    // Handle node double click (opens modal)
    const handleNodeDoubleClick = useCallback((nodeId: string, data: InfrastructureNodeData) => {
        console.log('Infrastructure node double-clicked:', nodeId, data);

        // Show details modal
        setSelectedNodeData(data);
        setShowDetailsModal(true);
    }, []);

    // Handle edge click
    const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
        console.log('Edge clicked:', edge.id);

        // Set selected edge and clear node selection
        setSelectedEdgeId(edge.id);
        setSelectedNodeId(null);
    }, []);

    // Handle canvas click (click away)
    const handleCanvasClick = useCallback((event: React.MouseEvent) => {
        // Clear selection to return everything to highlighted state
        console.log('Canvas clicked - resetting to full highlight');
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
    }, []);

    // Handle node edit
    const handleNodeEdit = useCallback((nodeId: string, data: InfrastructureNodeData) => {
        console.log('Infrastructure node edit:', nodeId, data);
        onNodeEdit?.(nodeId, data);
    }, [onNodeEdit]);

    // Custom node types
    const nodeTypes: NodeTypes = {
        infrastructureNode: (props) => (
            <InfrastructureNode
                {...props}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                onNodeEdit={handleNodeEdit}
                awsIcon={props.data.awsIcon}
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
                {/* Canvas Header */}
                <div className="absolute top-4 left-4 z-10 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl p-4 text-white shadow-2xl">
                    <h2 className="text-xl font-bold text-blue-400 mb-2">AWS Infrastructure</h2>
                    <p className="text-sm text-gray-300">Interactive visualization of your AWS resources</p>
                    <div className="mt-2 text-xs text-gray-400">
                        {infrastructureData.length} resources loaded
                    </div>
                </div>

                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={handleNodesChange}
                    onEdgesChange={handleEdgesChange}
                    onConnect={handleConnect}
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

                {/* Group by Service */}
                <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Group by Service</h4>
                    <button
                        onClick={onGroupByService}
                        className="w-full p-3 bg-blue-600/30 border border-blue-400/50 rounded-lg text-blue-300 hover:bg-blue-600/50 transition-all duration-200"
                    >
                        <div className="flex items-center space-x-2">
                            <span>🔧</span>
                            <span>Group by AWS Service</span>
                        </div>
                    </button>
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
                                {filteredInfrastructureData.filter(r => r.resourceType === 'lambda').length}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Databases:</span>
                            <span className="text-white font-medium">
                                {filteredInfrastructureData.filter(r => ['dynamodb', 'rds'].includes(r.resourceType)).length}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Storage:</span>
                            <span className="text-white font-medium">
                                {filteredInfrastructureData.filter(r => ['s3', 'cloudfront'].includes(r.resourceType)).length}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Security:</span>
                            <span className="text-white font-medium">
                                {filteredInfrastructureData.filter(r => ['iam', 'cognito'].includes(r.resourceType)).length}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-400">Monitoring:</span>
                            <span className="text-white font-medium">
                                {filteredInfrastructureData.filter(r => ['cloudwatch', 'xray'].includes(r.resourceType)).length}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Service Breakdown */}
                <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Service Breakdown</h4>
                    <div className="space-y-2">
                        {Object.entries(
                            filteredInfrastructureData.reduce((acc, resource) => {
                                const type = resource.resourceType;
                                acc[type] = (acc[type] || 0) + 1;
                                return acc;
                            }, {} as Record<string, number>)
                        ).map(([service, count]) => (
                            <div key={service} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                                <div className="flex items-center space-x-2">
                                    <div className={`w-3 h-3 rounded-full ${RESOURCE_CONFIG[service as InfrastructureResourceType]?.bgColor || 'bg-gray-500'}`}></div>
                                    <span className="text-sm text-gray-300 capitalize">{service}</span>
                                </div>
                                <span className="text-sm font-medium text-white">{count}</span>
                            </div>
                        ))}
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
                                    {selectedNodeData.awsIcon ? (
                                        <img src={selectedNodeData.awsIcon} alt={selectedNodeData.resourceType} className="w-12 h-12" />
                                    ) : (
                                        <div className="text-3xl text-white">⚡</div>
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-bold text-white">{selectedNodeData.title}</h4>
                                    <p className="text-sm text-gray-300">{selectedNodeData.resourceType}</p>
                                </div>
                            </div>

                            {selectedNodeData.description && (
                                <div>
                                    <h5 className="font-medium text-gray-300 mb-2">Description</h5>
                                    <p className="text-sm text-gray-400">{selectedNodeData.description}</p>
                                </div>
                            )}

                            {selectedNodeData.region && (
                                <div>
                                    <h5 className="font-medium text-gray-300 mb-2">Region</h5>
                                    <p className="text-sm text-gray-400">{selectedNodeData.region}</p>
                                </div>
                            )}

                            {selectedNodeData.tags && Object.keys(selectedNodeData.tags || {}).length > 0 && (
                                <div>
                                    <h5 className="font-medium text-gray-300 mb-2">Tags</h5>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(selectedNodeData.tags || {}).map(([key, value]) => (
                                            <span key={key} className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded">
                                                {key}: {value}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {selectedNodeData.configuration && Object.keys(selectedNodeData.configuration || {}).length > 0 && (
                                <div>
                                    <h5 className="font-medium text-gray-300 mb-2">Configuration</h5>
                                    <div className="space-y-1">
                                        {Object.entries(selectedNodeData.configuration || {}).slice(0, 5).map(([key, value]) => (
                                            <div key={key} className="text-xs text-gray-400">
                                                <span className="font-medium">{key}:</span> {String(value)}
                                            </div>
                                        ))}
                                        {Object.keys(selectedNodeData.configuration || {}).length > 5 && (
                                            <div className="text-xs text-gray-500 italic">
                                                +{Object.keys(selectedNodeData.configuration || {}).length - 5} more...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InfrastructureCanvasViewer;
