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
import TerraformParser from '../../utils/terraformParser';

// Import AWS icons
import lambdaIcon from '../../../assets/aws/lambda.svg';
import dynamodbIcon from '../../../assets/aws/dynamodb.svg';
import cognitoIcon from '../../../assets/aws/cognito.svg';
import apigatewayIcon from '../../../assets/aws/apigateway.svg';
import iamIcon from '../../../assets/aws/iam.svg';
import s3Icon from '../../../assets/aws/s3.svg';

// Simple function to get resource type from TerraformParser data
const getResourceTypeFromTerraform = (resource: any): string => {
    // Use the service property directly from TerraformParser
    return resource.service || resource.resourceType || 'lambda';
};

// AWS icon mapping
const AWS_ICONS: Record<string, string> = {
    lambda: lambdaIcon,
    dynamodb: dynamodbIcon,
    cognito: cognitoIcon,
    apigateway: apigatewayIcon,
    iam: iamIcon,
    s3: s3Icon,
    // Additional resource types with appropriate icons
    cloudfront: s3Icon, // Use S3 icon for CloudFront
    cloudwatch: iamIcon, // Use IAM icon for CloudWatch
    route53: apigatewayIcon, // Use API Gateway icon for Route53
    vpc: iamIcon, // Use IAM icon for VPC
    alb: apigatewayIcon, // Use API Gateway icon for ALB
    ecs: lambdaIcon, // Use Lambda icon for ECS
    rds: dynamodbIcon, // Use DynamoDB icon for RDS
    elasticache: dynamodbIcon, // Use DynamoDB icon for ElastiCache
    sqs: lambdaIcon, // Use Lambda icon for SQS
    sns: lambdaIcon, // Use Lambda icon for SNS
    eventbridge: lambdaIcon, // Use Lambda icon for EventBridge
    secretsmanager: iamIcon, // Use IAM icon for Secrets Manager
    ssm: iamIcon, // Use IAM icon for SSM
    ses: lambdaIcon, // Use Lambda icon for SES
    bedrock: lambdaIcon, // Use Lambda icon for Bedrock
    glue: lambdaIcon, // Use Lambda icon for Glue
    athena: dynamodbIcon, // Use DynamoDB icon for Athena
    quicksight: dynamodbIcon, // Use DynamoDB icon for QuickSight
    appsync: apigatewayIcon, // Use API Gateway icon for AppSync
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


// Sample connections between infrastructure components


interface InfrastructureCanvasViewerProps {
    projectId?: string | null;
    onNodeClick?: (nodeId: string, data: InfrastructureNodeData) => void;
    onNodeEdit?: (nodeId: string, data: InfrastructureNodeData) => void;
    customInfrastructureData?: InfrastructureNodeData[];
    terraformFiles?: Array<{ name: string; path: string; selected?: boolean }>;
    onTerraformFileSelect?: (filePath: string) => void;
    onGroupByService?: () => void;
    parsedTerraformResources?: any[];
}

interface FilterOptions {
    searchTerm: string;
    serviceFilter: string;
    groupBy: 'service' | 'modules' | 'category';
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
    onGroupByService,
    parsedTerraformResources
}) => {
    // Use custom data if provided, otherwise use empty array
    const infrastructureData = customInfrastructureData || [];

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
        groupBy: 'service',
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
    
    // Resource details popup state
    const [selectedResourceDetails, setSelectedResourceDetails] = useState<any>(null);
    const [showResourcePopup, setShowResourcePopup] = useState(false);

    // Get unique services for filtering
    const services = useMemo(() => {
        const serviceSet = new Set(infrastructureData.map(resource => getResourceTypeFromTerraform(resource)));
        return Array.from(serviceSet).sort();
    }, [infrastructureData]);

    // Convert infrastructure data to ParsedResource format for grouping
    const parsedResourcesForGrouping = useMemo(() => {
        return infrastructureData.map(resource => ({
            address: resource.title,
            type: getResourceTypeFromTerraform(resource),
            name: resource.title,
            modules: [],
            provider: 'aws',
            service: getResourceTypeFromTerraform(resource),
            category: TerraformParser.getResourceCategory(getResourceTypeFromTerraform(resource)),
            isData: false,
            attributes: resource.tags || {},
            dependencies: []
        }));
    }, [infrastructureData]);

    // Group resources based on selected grouping option
    const groupedResources = useMemo(() => {
        if (!parsedResourcesForGrouping.length) return {};
        
        return TerraformParser.groupResources(parsedResourcesForGrouping, filterOptions.groupBy);
    }, [parsedResourcesForGrouping, filterOptions.groupBy]);

    // Filtered infrastructure data
    const filteredInfrastructureData = useMemo(() => {
        return infrastructureData.filter(resource => {
            const matchesSearch = !filterOptions.searchTerm ||
                resource.title.toLowerCase().includes(filterOptions.searchTerm.toLowerCase()) ||
                (resource.description || '').toLowerCase().includes(filterOptions.searchTerm.toLowerCase());

            const matchesService = !filterOptions.serviceFilter ||
                getResourceTypeFromTerraform(resource) === filterOptions.serviceFilter;

            return matchesSearch && matchesService;
        });
    }, [infrastructureData, filterOptions.searchTerm, filterOptions.serviceFilter]);



    // Generate dynamic connections based on infrastructure data
    const generateConnections = (infraData: InfrastructureNodeData[]): Edge[] => {
        const connections: Edge[] = [];
        const nodeIds = infraData.map(item => item.title);

        // Create basic connections based on resource types
        infraData.forEach((resource, index) => {
            const resourceType = getResourceTypeFromTerraform(resource);
            if (resourceType === 'apigateway') {
                // API Gateway connects to Lambda functions
                infraData.forEach(target => {
                    const targetType = getResourceTypeFromTerraform(target);
                    if (targetType === 'lambda') {
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
            } else if (resourceType === 'lambda') {
                // Lambda functions connect to databases and storage
                infraData.forEach(target => {
                    const targetType = getResourceTypeFromTerraform(target);
                    if (['dynamodb', 's3', 'rds'].includes(targetType)) {
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
        let filteredNodes: Node<InfrastructureNodeData>[];

        if (filterOptions.groupBy === 'service') {
            // Group by service - arrange resources in clusters
            const serviceGroups: Record<string, InfrastructureNodeData[]> = {};
            
            // Group resources by service
            filteredInfrastructureData.forEach(resource => {
                const service = getResourceTypeFromTerraform(resource);
                if (!serviceGroups[service]) {
                    serviceGroups[service] = [];
                }
                serviceGroups[service].push(resource);
            });

            filteredNodes = [];
            let nodeIndex = 0;

            // Position each service group
            Object.entries(serviceGroups).forEach(([service, resources], groupIndex) => {
                const groupX = 100 + (groupIndex % 3) * 500; // 3 groups per row
                const groupY = 100 + Math.floor(groupIndex / 3) * 400; // New row every 3 groups

                // Position resources within each service group
                resources.forEach((resource, resourceIndex) => {
                    const resourcesPerRow = 4;
                    const row = Math.floor(resourceIndex / resourcesPerRow);
                    const col = resourceIndex % resourcesPerRow;
                    
                    const x = groupX + col * 140; // Closer spacing within groups
                    const y = groupY + row * 120;

                    // Get AWS icon for the resource type
                    const resourceType = getResourceTypeFromTerraform(resource);
                    const awsIcon = AWS_ICONS[resourceType] || AWS_ICONS.default;

                    // Determine if this node should be highlighted
                    let isHighlighted = false;
                    let isConnected = false;

                    if (isInitialState) {
                        isHighlighted = true;
                        isConnected = false;
                    } else if (selectedNodeId) {
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
                        const connectedNodeIds = getEdgeConnectedNodes(selectedEdgeId);
                        if (connectedNodeIds.has(resource.title)) {
                            isHighlighted = true;
                            isConnected = false;
                        } else {
                            isHighlighted = false;
                            isConnected = false;
                        }
                    }

                    filteredNodes.push({
                        id: resource.title,
                        type: 'infrastructureNode',
                        position: { x, y },
                        data: {
                            ...resource,
                            resourceType: resourceType as InfrastructureResourceType, // Use converted resource type
                            awsIcon: awsIcon,
                            isHighlighted,
                            isConnected
                        },
                        draggable: true,
                        selectable: true
                    });
                    nodeIndex++;
                });
            });
        } else {
            // Default grid layout for other grouping options
            filteredNodes = filteredInfrastructureData.map((resource, index) => {
                const cols = 8; // More columns since nodes are smaller
                const spacingX = 120; // Smaller spacing since nodes are smaller
                const spacingY = 120;

                const startX = 50;
                const startY = 50;

                const col = index % cols;
                const row = Math.floor(index / cols);

                // Get AWS icon for the resource type
                const resourceType = getResourceTypeFromTerraform(resource);
                const awsIcon = AWS_ICONS[resourceType] || AWS_ICONS.default;

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
                        resourceType: resourceType as InfrastructureResourceType, // Use converted resource type
                        awsIcon: awsIcon,
                        isHighlighted,
                        isConnected
                    },
                    draggable: true,
                    selectable: true
                };
            });
        }

        setNodes(filteredNodes);
        setEdges(generateConnections(filteredInfrastructureData));
    }, [filteredInfrastructureData, setNodes, setEdges, filterOptions.groupBy, isInitialState, selectedNodeId, selectedEdgeId]);

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
    const handleNodeClick = useCallback((event: React.MouseEvent, node: Node<InfrastructureNodeData>) => {
        console.log('Infrastructure node clicked:', node.id, node.data);

        // Set selected node and clear edge selection
        setSelectedNodeId(node.id);
        setSelectedEdgeId(null);

        onNodeClick?.(node.id, node.data);
    }, [onNodeClick]);

    // Handle node double click (opens modal)
    const handleNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node<InfrastructureNodeData>) => {
        console.log('Infrastructure node double-clicked:', node.id, node.data);

        // Show details modal
        setSelectedNodeData(node.data);
        setShowDetailsModal(true);

        // Also prepare resource details for Terraform popup
        const resourceDetails = {
            ...node.data,
            terraformType: node.data.resourceType,
            terraformAddress: node.data.title,
            terraformCategory: TerraformParser.getResourceCategory(node.data.resourceType),
            terraformService: node.data.resourceType,
            terraformProvider: 'aws',
            terraformAttributes: node.data.tags || {},
            terraformConfiguration: node.data.configuration || {},
            terraformDependencies: edges
                .filter(edge => edge.source === node.data.title || edge.target === node.data.title)
                .map(edge => {
                    if (edge.source === node.data.title) {
                        return `→ ${edge.target} (${edge.data?.type || 'connection'})`;
                    } else {
                        return `← ${edge.source} (${edge.data?.type || 'connection'})`;
                    }
                }),
            terraformModules: []
        };
        setSelectedResourceDetails(resourceDetails);
        setShowResourcePopup(true);
    }, [edges]);

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
                onNodeClick={(nodeId: string, data: InfrastructureNodeData) => {
                    // Convert to ReactFlow format
                    const mockEvent = {} as React.MouseEvent;
                    const mockNode = { id: nodeId, data } as Node<InfrastructureNodeData>;
                    handleNodeClick(mockEvent, mockNode);
                }}
                onNodeDoubleClick={(nodeId: string, data: InfrastructureNodeData) => {
                    // Convert to ReactFlow format
                    const mockEvent = {} as React.MouseEvent;
                    const mockNode = { id: nodeId, data } as Node<InfrastructureNodeData>;
                    handleNodeDoubleClick(mockEvent, mockNode);
                }}
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

                    {/* Service Group Labels - Only show when grouping by service */}
                    {filterOptions.groupBy === 'service' && Object.keys(groupedResources).length > 0 && (
                        <div className="absolute inset-0 pointer-events-none">
                            {Object.entries(groupedResources).map(([service, resources], groupIndex) => {
                                const groupX = 100 + (groupIndex % 3) * 500;
                                const groupY = 100 + Math.floor(groupIndex / 3) * 400;
                                
                                return (
                                    <div
                                        key={service}
                                        className="absolute bg-blue-600/20 border border-blue-400/50 rounded-lg px-3 py-2 text-blue-300 font-semibold text-sm backdrop-blur-sm"
                                        style={{
                                            left: groupX - 20,
                                            top: groupY - 40,
                                            minWidth: '120px',
                                            textAlign: 'center'
                                        }}
                                    >
                                        {service.charAt(0).toUpperCase() + service.slice(1)} ({resources.length})
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ReactFlow>


            </div>

            {/* Right Sidebar - Advanced Filtering & Options */}
            <div className="w-80 bg-gray-800/95 backdrop-blur-md border-l border-gray-700 p-4 overflow-y-auto">
                <h3 className="text-lg font-bold text-blue-400 mb-4">Visualization Options</h3>

                {/* Group By */}
                <div className="mb-4">
                    <label className="block text-xs font-medium text-gray-300 mb-2">Group By</label>
                    <select
                        value={filterOptions.groupBy || 'service'}
                        onChange={(e) => setFilterOptions(prev => ({ ...prev, groupBy: e.target.value as 'service' | 'modules' | 'category' }))}
                        className="w-full px-3 py-2 text-sm bg-gray-700/50 border border-gray-600/50 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50"
                    >
                                                    <option value="service">Service</option>
                            <option value="modules">Modules</option>
                            <option value="category">Categories</option>
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
                                    <h4 className="font-semibold text-purple-400 mb-3">Dependencies</h4>
                                    <div className="text-sm text-gray-400">
                                        {selectedResourceDetails.terraformDependencies.length > 0 ? (
                                            <div className="space-y-1">
                                                {selectedResourceDetails.terraformDependencies.map((dep: string, idx: number) => (
                                                    <div key={idx} className="text-white font-mono text-xs bg-gray-800 p-2 rounded">
                                                        {dep}
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
