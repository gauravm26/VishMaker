import React, { useState, useEffect, useMemo } from 'react';
import GitHubService from '../../utils/githubService';
import TerraformParser, { TerraformData, ArchitectureDiagram } from '../../utils/terraformParser';

interface TerraformArchitectureViewerProps {
  owner: string;
  repo: string;
  branch: string;
  refreshTrigger?: number;
}

interface FilterOptions {
  groupBy: 'category' | 'provider' | 'type' | 'none';
  searchTerm: string;
  categoryFilter: string;
  providerFilter: string;
  showConnectivity: boolean;
  showDependencies: boolean;
  showAttributes: boolean;
  sortBy: 'name' | 'type' | 'provider' | 'category';
  sortOrder: 'asc' | 'desc';
}

const TerraformArchitectureViewer: React.FC<TerraformArchitectureViewerProps> = ({
  owner,
  repo,
  branch,
  refreshTrigger = 0
}) => {
  const [tfFiles, setTfFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [tfData, setTfData] = useState<TerraformData | null>(null);
  const [architecture, setArchitecture] = useState<ArchitectureDiagram | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchProgress, setSearchProgress] = useState<string>('');
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    groupBy: 'category',
    searchTerm: '',
    categoryFilter: '',
    providerFilter: '',
    showConnectivity: true,
    showDependencies: true,
    showAttributes: true,
    sortBy: 'name',
    sortOrder: 'asc'
  });

  // Add zoom state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Helper functions for connection styling
  const getConnectionColor = (type: string): string => {
    const colors: Record<string, string> = {
      'dependency': '#6B7280',
      'integration': '#3B82F6',
      'security': '#EF4444',
      'storage': '#10B981',
      'database': '#8B5CF6',
      'monitoring': '#06B6D4',
      'reference': '#6B7280',
      'output': '#6B7280'
    };
    return colors[type] || '#6B7280';
  };

  const getConnectionWidth = (type: string): number => {
    const widths: Record<string, number> = {
      'dependency': 2,
      'network': 3,
      'security': 3,
      'storage': 2,
      'database': 3,
      'load_balancer': 2,
      'autoscaling': 2,
      'monitoring': 1,
      'reference': 1,
      'output': 1
    };
    return widths[type] || 2;
  };

  const getConnectionDash = (type: string): string => {
    const dashes: Record<string, string> = {
      'dependency': '5,5',
      'network': 'none',
      'security': 'none',
      'storage': '10,5',
      'database': 'none',
      'load_balancer': '5,5',
      'autoscaling': '10,5',
      'monitoring': '2,2',
      'reference': '1,1',
      'output': '1,1'
    };
    return dashes[type] || '5,5';
  };

  const getArrowheadMarker = (type: string): string => {
    const markers: Record<string, string> = {
      'network': 'arrowhead-network',
      'security': 'arrowhead-security',
      'storage': 'arrowhead-storage',
      'database': 'arrowhead-database'
    };
    return markers[type] || 'arrowhead';
  };

  // Get node color based on service
  const getNodeColor = (service: string): string => {
    return TerraformParser.getServiceColor(service);
  };

  // Filter and group resources for visualization
  const filteredVisualizationResources = useMemo(() => {
    if (!tfData) return [];

    let filtered = tfData.resources.filter(resource => {
      const matchesSearch = !filterOptions.searchTerm || 
        resource.name.toLowerCase().includes(filterOptions.searchTerm.toLowerCase()) ||
        resource.type.toLowerCase().includes(filterOptions.searchTerm.toLowerCase()) ||
        resource.provider.toLowerCase().includes(filterOptions.searchTerm.toLowerCase());
      
      const matchesCategory = !filterOptions.categoryFilter || 
        TerraformParser.getResourceCategory(resource.type) === filterOptions.categoryFilter;
      
      const matchesProvider = !filterOptions.providerFilter || 
        resource.provider === filterOptions.providerFilter;

      return matchesSearch && matchesCategory && matchesProvider;
    });

    // Sort resources
    filtered.sort((a, b) => {
      let aValue: string;
      let bValue: string;
      
      switch (filterOptions.sortBy) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'provider':
          aValue = a.provider;
          bValue = b.provider;
          break;
        case 'category':
          aValue = TerraformParser.getResourceCategory(a.type);
          bValue = TerraformParser.getResourceCategory(b.type);
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }
      
      const comparison = aValue.localeCompare(bValue);
      return filterOptions.sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [tfData, filterOptions]);

  // Group resources by service for better organization
  const groupedResources = useMemo(() => {
    if (!filteredVisualizationResources.length) return {};

    const grouped: Record<string, typeof filteredVisualizationResources> = {};
    
    filteredVisualizationResources.forEach(resource => {
      const service = TerraformParser.getResourceCategory(resource.type);
      if (!grouped[service]) {
        grouped[service] = [];
      }
      grouped[service].push(resource);
    });

    return grouped;
  }, [filteredVisualizationResources]);

  // Build filtered architecture diagram
  const filteredArchitecture = useMemo(() => {
    if (!tfData || !filteredVisualizationResources.length) return null;

    // Convert to ParsedResource format for enhanced parsing
    const parsedResources = TerraformParser.convertTerraformDataToParsedResources(
      { ...tfData, resources: filteredVisualizationResources }
    );

    return TerraformParser.buildArchitectureDiagram(parsedResources);
  }, [tfData, filteredVisualizationResources]);

  // Load all .tf files from the repository
  useEffect(() => {
    loadTerraformFiles();
  }, [owner, repo, branch]);

  // Handle refresh trigger
  useEffect(() => {
    if (refreshTrigger > 0) {
      loadTerraformFiles();
    }
  }, [refreshTrigger]);

  // Get unique services and providers for filters
  const services = useMemo(() => {
    if (!tfData) return [];
    const svcs = new Set<string>();
    tfData.resources.forEach(resource => {
      svcs.add(TerraformParser.getResourceCategory(resource.type));
    });
    return Array.from(svcs).sort();
  }, [tfData]);

  const providers = useMemo(() => {
    if (!tfData) return [];
    const provs = new Set<string>();
    tfData.resources.forEach(resource => {
      provs.add(resource.provider);
    });
    return Array.from(provs).sort();
  }, [tfData]);

  // Filter and group resources
  const filteredAndGroupedResources = useMemo(() => {
    if (!tfData) return {};

    let filtered = tfData.resources.filter(resource => {
      const matchesSearch = !filterOptions.searchTerm || 
        resource.name.toLowerCase().includes(filterOptions.searchTerm.toLowerCase()) ||
        resource.type.toLowerCase().includes(filterOptions.searchTerm.toLowerCase()) ||
        resource.provider.toLowerCase().includes(filterOptions.searchTerm.toLowerCase());
      
      const matchesCategory = !filterOptions.categoryFilter || 
        TerraformParser.getResourceCategory(resource.type) === filterOptions.categoryFilter;
      
      const matchesProvider = !filterOptions.providerFilter || 
        resource.provider === filterOptions.providerFilter;

      return matchesSearch && matchesCategory && matchesProvider;
    });

    // Sort resources
    filtered.sort((a, b) => {
      let aValue: string;
      let bValue: string;
      
      switch (filterOptions.sortBy) {
        case 'name':
          aValue = a.name;
          bValue = b.name;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        case 'provider':
          aValue = a.provider;
          bValue = b.provider;
          break;
        case 'category':
          aValue = TerraformParser.getResourceCategory(a.type);
          bValue = TerraformParser.getResourceCategory(b.type);
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }
      
      const comparison = aValue.localeCompare(bValue);
      return filterOptions.sortOrder === 'asc' ? comparison : -comparison;
    });

    // Group by selected option
    if (filterOptions.groupBy === 'none') {
      return { 'All Resources': filtered };
    }

    const grouped: Record<string, typeof filtered> = {};
    filtered.forEach(resource => {
      let key = '';
      switch (filterOptions.groupBy) {
        case 'category':
          key = TerraformParser.getResourceCategory(resource.type);
          break;
        case 'provider':
          key = resource.provider;
          break;
        case 'type':
          key = resource.type;
          break;
      }
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(resource);
    });

    return grouped;
  }, [tfData, filterOptions]);

  const loadTerraformFiles = async () => {
    setIsLoading(true);
    setError(null);
    setSearchProgress('Searching for Terraform files...');

    try {
      console.log(`Starting Terraform file search for ${owner}/${repo} on branch ${branch}`);
      
      // Recursively search for all .tf files in the repository
      const tfFileList = await searchTerraformFilesRecursively(owner, repo, branch, '');
      
      console.log(`Found ${tfFileList.length} Terraform files:`, tfFileList);
      setTfFiles(tfFileList);

      if (tfFileList.length === 0) {
        setError('No Terraform (.tf) files found in this repository. The search includes all directories and subdirectories.');
      } else {
        setSearchProgress(`Found ${tfFileList.length} Terraform file(s)`);
        // Load the first .tf file by default
        await loadTerraformFile(tfFileList[0]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load Terraform files';
      console.error('Error loading Terraform files:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setSearchProgress('');
    }
  };

  // Recursively search for .tf files in all directories
  const searchTerraformFilesRecursively = async (
    owner: string, 
    repo: string, 
    branch: string, 
    path: string
  ): Promise<string[]> => {
    const tfFiles: string[] = [];
    
    try {
      console.log(`Searching directory: ${path || 'root'}`);
      const contents = await GitHubService.getContents(owner, repo, path, branch);
      console.log(`Found ${contents.length} items in ${path || 'root'}:`, contents.map(item => `${item.type}: ${item.name}`));
      
      for (const item of contents) {
        if (item.type === 'file' && item.name.endsWith('.tf')) {
          // Simple filter: only exclude files specifically named for variables/outputs
          const fileName = item.name.toLowerCase();
          const isVariableFile = fileName === 'variables.tf' || fileName === 'terraform-variables.tf';
          const isOutputFile = fileName === 'outputs.tf' || fileName === 'output.tf' || fileName === 'terraform-outputs.tf';
          
          if (!isVariableFile && !isOutputFile) {
            // Include all other .tf files
            tfFiles.push(item.path);
            setSearchProgress(`Found: ${item.path}`);
            console.log(`Found Terraform file: ${item.path}`);
          } else {
            console.log(`Skipping: ${item.path} (variable/output file)`);
          }
        } else if (item.type === 'dir') {
          // Recursively search subdirectories
          setSearchProgress(`Searching directory: ${item.path}`);
          console.log(`Recursively searching subdirectory: ${item.path}`);
          try {
            const subDirFiles = await searchTerraformFilesRecursively(owner, repo, branch, item.path);
            tfFiles.push(...subDirFiles);
            console.log(`Found ${subDirFiles.length} files in subdirectory ${item.path}`);
          } catch (subDirError) {
            console.warn(`Failed to search subdirectory ${item.path}:`, subDirError);
            // Continue with other directories even if one fails
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to search directory ${path}:`, error);
      // Continue searching other directories even if one fails
    }
    
    console.log(`Returning ${tfFiles.length} files from ${path || 'root'}`);
    return tfFiles;
  };

  const loadTerraformFile = async (filePath: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const content = await GitHubService.getRawFileContent(owner, repo, filePath, branch);
      setSelectedFile(filePath);

      // Parse Terraform configuration
      const parsedData = TerraformParser.parseTerraformConfig(content);
      setTfData(parsedData);

      // Convert to ParsedResource format and build architecture diagram
      const parsedResources = TerraformParser.convertTerraformDataToParsedResources(parsedData, filePath);
      const diagram = TerraformParser.buildArchitectureDiagram(parsedResources);
      setArchitecture(diagram);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load Terraform file';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const renderCompactFilterPanel = () => {
    if (!tfData) return null;

    return (
      <div className="p-4 border-b border-white/10 bg-white/5">
        <h4 className="text-sm font-medium text-white mb-3">Visualization Filters</h4>
        
        <div className="space-y-3">
          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-white/90 mb-1">Search</label>
            <input
              type="text"
              value={filterOptions.searchTerm}
              onChange={(e) => setFilterOptions(prev => ({ ...prev, searchTerm: e.target.value }))}
              placeholder="Search resources..."
              className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50"
            />
          </div>

          {/* Service Filter */}
          <div>
            <label className="block text-xs font-medium text-white/90 mb-1">Service</label>
            <select
              value={filterOptions.categoryFilter}
              onChange={(e) => setFilterOptions(prev => ({ ...prev, categoryFilter: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50"
            >
              <option value="">All Services</option>
              {services.map(service => (
                <option key={service} value={service}>{service}</option>
              ))}
            </select>
          </div>

          {/* Provider Filter */}
          <div>
            <label className="block text-xs font-medium text-white/90 mb-1">Provider</label>
            <select
              value={filterOptions.providerFilter}
              onChange={(e) => setFilterOptions(prev => ({ ...prev, providerFilter: e.target.value }))}
              className="w-full px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50"
            >
              <option value="">All Providers</option>
              {providers.map(provider => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </div>

          {/* Display Options */}
          <div>
            <label className="block text-xs font-medium text-white/90 mb-1">Display</label>
            <div className="space-y-1">
              <label className="flex items-center text-xs text-white/80">
                <input
                  type="checkbox"
                  checked={filterOptions.showConnectivity}
                  onChange={(e) => setFilterOptions(prev => ({ ...prev, showConnectivity: e.target.checked }))}
                  className="mr-2"
                />
                Connectivity
              </label>
              <label className="flex items-center text-xs text-white/80">
                <input
                  type="checkbox"
                  checked={filterOptions.showDependencies}
                  onChange={(e) => setFilterOptions(prev => ({ ...prev, showDependencies: e.target.checked }))}
                  className="mr-2"
                />
                Dependencies
              </label>
              <label className="flex items-center text-xs text-white/80">
                <input
                  type="checkbox"
                  checked={filterOptions.showAttributes}
                  onChange={(e) => setFilterOptions(prev => ({ ...prev, showAttributes: e.target.checked }))}
                  className="mr-2"
                />
                Attributes
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSimpleResourceList = () => {
    if (!tfData) return null;

    return (
      <div className="flex-1 overflow-auto p-4">
        <h4 className="text-sm font-medium text-white mb-3 flex items-center">
          <span className="mr-2">🔧</span>
          All Resources ({tfData.resources.length})
        </h4>
        
        <div className="space-y-4">
          {Object.entries(groupedResources).map(([service, resources]) => (
            <div key={service} className="space-y-2">
              <div className="flex items-center space-x-2 text-xs font-medium text-white/90">
                {TerraformParser.getResourceIcon(service).includes('.svg') ? (
                  <img 
                    src={TerraformParser.getResourceIcon(service)} 
                    alt={service}
                    className="w-4 h-4"
                  />
                ) : (
                  <span className="text-sm">{TerraformParser.getResourceIcon(service)}</span>
                )}
                <span className="capitalize">{service}</span>
                <span className="text-gray-400">({resources.length})</span>
              </div>
              
              <div className="space-y-1 ml-4">
                {resources.map((resource, index) => (
                  <div
                    key={index}
                    className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    title={`${resource.type}.${resource.name}`}
                  >
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: getNodeColor(service) }}
                      ></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate">
                          {resource.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {resource.type}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEnhancedArchitectureDiagram = () => {
    if (!filteredArchitecture) return null;

    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-white">Infrastructure Architecture</h3>
            
            {/* Zoom Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}
                className="px-2 py-1 text-xs bg-white/10 border border-white/20 rounded text-white hover:bg-white/20"
              >
                -
              </button>
              <span className="text-xs text-gray-400 min-w-[40px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(Math.min(2, zoom + 0.2))}
                className="px-2 py-1 text-xs bg-white/10 border border-white/20 rounded text-white hover:bg-white/20"
              >
                +
              </button>
              <button
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                className="px-2 py-1 text-xs bg-white/10 border border-white/20 rounded text-white hover:bg-white/20"
              >
                Reset
              </button>
              <div className="w-px h-4 bg-white/20"></div>
              <button
                onClick={() => loadTerraformFiles()}
                className="flex items-center space-x-1 px-2 py-1 text-xs bg-white/10 border border-white/20 rounded text-white hover:bg-white/20"
                title="Refresh data from GitHub"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-gray-400 mb-3">
            <span>Resources: {filteredArchitecture.nodes.filter(n => n.type === 'resource').length}</span>
            <span>Modules: {filteredArchitecture.nodes.filter(n => n.type === 'module').length}</span>
            <span>Dependencies: {filteredArchitecture.connections.length}</span>
            {filterOptions.showConnectivity && (
              <span className="text-purple-400">• Connectivity Enabled</span>
            )}
          </div>
          
          {/* Connection Type Legend */}
          {filterOptions.showConnectivity && (
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-0.5 bg-blue-500"></div>
                <span className="text-gray-400">Integration</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-0.5 bg-red-500"></div>
                <span className="text-gray-400">Security</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-0.5 bg-green-500"></div>
                <span className="text-gray-400">Storage</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-0.5 bg-purple-500"></div>
                <span className="text-gray-400">Database</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-0.5 bg-cyan-500"></div>
                <span className="text-gray-400">Monitoring</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-0.5 bg-gray-500"></div>
                <span className="text-gray-400">Dependency</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden p-4">
          <div 
            className="relative w-full h-full min-h-[600px] bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-white/10 overflow-hidden"
          >
            <div
              className="w-full h-full"
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                transformOrigin: 'center center'
              }}
            >
            {/* Architecture Diagram */}
            <div className="absolute inset-0 p-4">
              {filteredArchitecture.nodes.map((node) => (
                <div
                  key={node.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform"
                  style={{
                    left: node.x || 0,
                    top: node.y || 0
                  }}
                  title={`${node.name}\nType: ${node.type}\nCategory: ${node.category}`}
                >
                  {/* Circular Node */}
                  <div 
                    className="w-16 h-16 rounded-full border-2 flex items-center justify-center relative"
                    style={{
                      backgroundColor: `${getNodeColor(node.category)}20`,
                      borderColor: getNodeColor(node.category),
                    }}
                  >
                    {TerraformParser.getResourceIcon(node.category).includes('.svg') ? (
                      <img 
                        src={TerraformParser.getResourceIcon(node.category)} 
                        alt={node.category}
                        className="w-8 h-8"
                      />
                    ) : (
                      <span className="text-lg">
                        {TerraformParser.getResourceIcon(node.category)}
                      </span>
                    )}
                  </div>
                  
                  {/* Node Label */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2">
                    <div className="text-xs font-medium text-white text-center bg-black/50 px-2 py-1 rounded whitespace-nowrap">
                      {node.name.split('.').pop()}
                    </div>
                  </div>
                </div>
              ))}

              {/* Enhanced edges with better connectivity */}
              {filterOptions.showConnectivity && (
                <svg className="absolute inset-0 pointer-events-none">
                  {filteredArchitecture.connections.map((connection) => {
                    const sourceNode = filteredArchitecture.nodes.find(n => n.id === connection.from);
                    const targetNode = filteredArchitecture.nodes.find(n => n.id === connection.to);
                    
                    if (!sourceNode || !targetNode) return null;

                    // Calculate connection points (8px offset from node center)
                    const sourceX = sourceNode.x;
                    const sourceY = sourceNode.y;
                    const targetX = targetNode.x;
                    const targetY = targetNode.y;

                    return (
                      <g key={`${connection.from}-${connection.to}`}>
                        {/* Main connection line with type-specific styling */}
                        <line
                          x1={sourceX}
                          y1={sourceY}
                          x2={targetX}
                          y2={targetY}
                          stroke={getConnectionColor(connection.type)}
                          strokeWidth={getConnectionWidth(connection.type)}
                          strokeDasharray={getConnectionDash(connection.type)}
                          markerEnd="url(#arrowhead)"
                        />
                        {/* Glow effect for better visibility */}
                        <line
                          x1={sourceX}
                          y1={sourceY}
                          x2={targetX}
                          y2={targetY}
                          stroke={getConnectionColor(connection.type)}
                          strokeWidth="1"
                          opacity="0.3"
                          markerEnd="url(#arrowhead-glow)"
                        />
                      </g>
                    );
                  })}
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#6B7280" />
                    </marker>
                    <marker
                      id="arrowhead-glow"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#6B7280" opacity="0.3" />
                    </marker>
                    {/* Type-specific arrowheads */}
                    <marker
                      id="arrowhead-network"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#3B82F6" />
                    </marker>
                    <marker
                      id="arrowhead-security"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#EF4444" />
                    </marker>
                    <marker
                      id="arrowhead-storage"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#10B981" />
                    </marker>
                    <marker
                      id="arrowhead-database"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 10 3.5, 0 7" fill="#8B5CF6" />
                    </marker>
                  </defs>
                </svg>
              )}
            </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-400 mb-2">Error loading Terraform files</p>
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-gray-300 mb-2">Loading Terraform architecture...</p>
          {searchProgress && (
            <p className="text-sm text-gray-400">{searchProgress}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* File List Sidebar */}
      <div className="w-80 border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-sm font-medium text-white mb-2">Terraform Files</h3>
          <div className="text-xs text-gray-400">
            {tfFiles.length} .tf files found (searched all directories)
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-2">
          <div className="space-y-1">
            {tfFiles.map((filePath) => {
              const fileName = filePath.split('/').pop() || '';
              const directory = filePath.split('/').slice(0, -1).join('/');
              
              return (
                <button
                  key={filePath}
                  onClick={() => loadTerraformFile(filePath)}
                  className={`w-full flex items-center px-3 py-2 text-sm hover:bg-white/5 rounded-lg transition-colors ${
                    selectedFile === filePath ? 'bg-purple-500/20 text-purple-300' : 'text-gray-300'
                  }`}
                >
                  <svg className="w-4 h-4 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="truncate font-medium">{fileName}</div>
                    {directory && (
                      <div className="text-xs text-gray-400 truncate">{directory}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex">
        <div className="flex-1">
          {renderEnhancedArchitectureDiagram()}
        </div>
        <div className="w-96 border-l border-white/10 flex flex-col">
          {/* Compact Filter Panel */}
          {renderCompactFilterPanel()}
          
                      {/* Simple Resource List */}
            {renderSimpleResourceList()}
        </div>
      </div>
    </div>
  );
};

export default TerraformArchitectureViewer; 