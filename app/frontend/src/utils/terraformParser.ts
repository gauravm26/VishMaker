// Enhanced Terraform Parser for parsing and visualizing infrastructure configurations
// Provides methods for parsing .tf files, terraform state, and building architecture diagrams
// Based on terraform state list parsing approach for better resource discovery

// Utility function to generate UUID
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Map AWS services to icon paths dynamically
function getServiceIcon(service: string): string {
  // Normalize service name to match SVG filename
  const normalizedService = service.toLowerCase().trim();
  
  // Use the public assets path that Vite can resolve at build time
  // The assets are in /public/assets/aws/ so they'll be available at runtime
  const dynamicPath = `/assets/aws/${normalizedService}.svg`;
  
  // Return dynamic path with default fallback
  // If the specific service SVG doesn't exist, it will fall back to default.svg
  return dynamicPath;
}

export interface ParsedResource {
  /** Unique identifier for the node */
  uuid: string;
  /** Full TF address as returned by `terraform state list` */
  address: string;                        // e.g., module.net.aws_eip.app_eip
  /** Type token (e.g., aws_eip) */
  type: string;                           // e.g., aws_eip
  /** Name token after the first dot (e.g., app_eip) */
  name: string;                           // e.g., app_eip
  /** Optional module path (dot-joined modules) */
  modules: string[];                      // e.g., ["module", "net"] or ["module.vpc"]
  /** Provider (first segment of type) */
  provider: string;                       // e.g., aws
  /** Service (second segment of type) */
  service: string;                        // e.g., eip
  /** Category (remaining segments of type, joined by "_") */
  category: string;                       // e.g., "" or "instance_profile" or "security_group_rule"
  /** True if this looks like a data source */
  isData: boolean;
  /** Resource attributes from configuration */
  attributes: Record<string, any>;
  /** Dependencies between resources */
  dependencies: string[];
  /** UI elements for display on screen */
  onScreenElements: {
    icon: string;                         // Path to the icon file
    label: string;                        // Display label (service.category format)
    connectedNodes: string[];             // UUIDs of dependent nodes
  };
}

export interface TerraformResource {
  type: string;
  name: string;
  provider: string;
  attributes?: Record<string, any>;
  dependencies?: string[];
}

export interface TerraformData {
  resources: TerraformResource[];
  variables?: Record<string, any>;
  outputs?: Record<string, any>;
}

export interface ArchitectureNode {
  id: string;
  category: string;
  type: string;
  name: string;
  x: number;
  y: number;
  connections: string[];
}

export interface ArchitectureDiagram {
  nodes: ArchitectureNode[];
  connections: Array<{ from: string; to: string; type: string }>;
}

export interface GroupedResource {
  uuid: string;
  group_key: 'service' | 'category';
  child_uuids: string[];
  onScreenElements: {
    icon: string;
    label: string;
    connectionNodes: string[];
  };
}

export interface GroupedResources {
  [key: string]: GroupedResource;
}

export interface FilterOptions {
  service?: string;
  category?: string;
  isData?: boolean;
}



// Enhanced Terraform Parser class
class TerraformParserClass {
  private cache: Map<string, ParsedResource[]> = new Map();
  private groupedCache: Map<string, GroupedResources> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Parse Terraform resource address into structured components
   * @param address - Full resource address from terraform state list
   * @returns Parsed resource object
   */
  parseAddress(address: string): ParsedResource | null {
    let addr = address.trim();
    if (!addr) return null;

    // Separate module path(s) (e.g., module.vpc.module.subnet.aws_xxx.name)
    const parts = addr.split(".");
    const modules: string[] = [];
    
    // Collect leading "module.<name>" pairs
    while (parts.length >= 2 && parts[0] === "module") {
      const _module = parts.shift(); // "module"
      const name = parts.shift();    // "<name>"
      modules.push(`${_module}.${name}`);
    }

    // Handle data sources: data.<provider_type>.<name>
    let isData = false;
    if (parts[0] === "data") {
      isData = true;
      parts.shift(); // remove "data"
    }

    // Now we expect: <type>.<name>[.indexing...]
    if (parts.length < 2) {
      return {
        uuid: generateUUID(),
        address,
        type: parts[0] || "",
        name: parts[1] || "",
        modules,
        provider: "",
        service: "",
        category: "",
        isData,
        attributes: {},
        dependencies: [],
        onScreenElements: {
          icon: getServiceIcon(""),
          label: ".",
          connectedNodes: []
        }
      };
    }

    const type = parts[0]; // aws_iam_policy
    const nameAndRest = parts.slice(1).join("."); // name and any indexers
    const name = nameAndRest;

    // Split type by underscores to provider/service/category
    const segs = type.split("_");
    const provider = segs[0] || "";
    const service = segs[1] || "";
    const category = segs.slice(2).join("_"); // may be ""

    return { 
      uuid: generateUUID(),
      address, 
      type, 
      name, 
      modules, 
      provider, 
      service, 
      category, 
      isData,
      attributes: {},
      dependencies: [],
      onScreenElements: {
        icon: getServiceIcon(service),
        label: `${service}.${category}`,
        connectedNodes: []
      }
    };
  }

  /**
   * Parse Terraform configuration content from .tf files (GitHub integration)
   * @param content - The content of a .tf file
   * @param filePath - Optional file path for module context
   * @returns Parsed Terraform data with enhanced resource information
   */
  parseTerraformConfig(content: string, filePath?: string): TerraformData {
    try {
      const resources: TerraformResource[] = [];
      
      // Enhanced regex-based parsing for resource extraction
      const resourceRegex = /resource\s+["']([^"']+)["']\s+["']([^"']+)["']\s*{([^}]+)}/g;
      let match;
      
      while ((match = resourceRegex.exec(content)) !== null) {
        const [, resourceType, resourceName, resourceBody] = match;
        
        // Extract provider from resource type
        const provider = resourceType.split('_')[0];
        
        // Extract basic attributes (enhanced)
        const attributes: Record<string, any> = {};
        const attrRegex = /(\w+)\s*=\s*["']([^"']+)["']/g;
        let attrMatch;
        
        while ((attrMatch = attrRegex.exec(resourceBody)) !== null) {
          const [, key, value] = attrMatch;
          attributes[key] = value;
        }
        
        // Extract dependencies
        const dependencies = this.extractDependencies(resourceBody);
        
        // Extract module context from file path
        const moduleContext = this.extractModuleContextFromPath(filePath);
        
        resources.push({
          type: resourceType,
          name: resourceName,
          provider,
          attributes,
          dependencies,
          // Add module context if available
          ...(moduleContext && { module: moduleContext })
        });
      }
      
      return { resources };
    } catch (error) {
      console.error('Error parsing Terraform config:', error);
      return { resources: [] };
    }
  }

  /**
   * Extract module context from file path
   * @param filePath - File path like "modules/vpc/main.tf" or "infrastructure/network.tf"
   * @returns Module context or null
   */
  private extractModuleContextFromPath(filePath?: string): string | null {
    if (!filePath) return null;
    
    const parts = filePath.split('/');
    
    // Check if this is in a modules directory
    const modulesIndex = parts.indexOf('modules');
    if (modulesIndex !== -1 && parts[modulesIndex + 1]) {
      return parts[modulesIndex + 1]; // Return module name
    }
    
    // Check if this is in a specific infrastructure directory
    const infraIndex = parts.indexOf('infrastructure');
    if (infraIndex !== -1 && parts[infraIndex + 1]) {
      return parts[infraIndex + 1]; // Return infrastructure area
    }
    
    return null;
  }

  /**
   * Parse multiple resource addresses (e.g., from terraform state list)
   * @param addresses - Array of resource addresses
   * @returns Array of parsed resources
   */
  parseAddresses(addresses: string[]): ParsedResource[] {
    return addresses
      .map(addr => this.parseAddress(addr))
      .filter((resource): resource is ParsedResource => resource !== null);
  }

  /**
   * Group resources by specified key
   * @param resources - Array of parsed resources
   * @param groupBy - Key to group by
   * @returns Grouped resources
   */
  groupResources(resources: ParsedResource[]): GroupedResources {
    const result: GroupedResources = {};
    
    // Group by service
    const serviceGroups: Record<string, string[]> = {};
    resources.forEach(resource => {
      const service = resource.service || 'unknown';
      if (!serviceGroups[service]) {
        serviceGroups[service] = [];
      }
      serviceGroups[service].push(resource.uuid);
    });
    
    // Create service group resources
    Object.entries(serviceGroups).forEach(([service, childUuids]) => {
      const serviceKey = `service_${service}`;
      result[serviceKey] = {
        uuid: generateUUID(),
        group_key: 'service',
        child_uuids: childUuids,
        onScreenElements: {
          icon: getServiceIcon(service),
          label: service,
          connectionNodes: []
        }
      };
    });
    
    // Group by category
    const categoryGroups: Record<string, string[]> = {};
    resources.forEach(resource => {
      const category = resource.category || 'general';
      if (!categoryGroups[category]) {
        categoryGroups[category] = [];
      }
      categoryGroups[category].push(resource.uuid);
    });
    
    // Create category group resources
    Object.entries(categoryGroups).forEach(([category, childUuids]) => {
      const categoryKey = `category_${category}`;
      result[categoryKey] = {
        uuid: generateUUID(),
        group_key: 'category',
        child_uuids: childUuids,
        onScreenElements: {
          icon: getServiceIcon('iam'), // Default icon for category groups
          label: category,
          connectionNodes: []
        }
      };
    });
    

    // Populate connection nodes between groups
    this.populateGroupConnections(result, resources);
    

    console.log('Grouped resources:', result);
    return result;
  }

  /**
   * Filter resources based on criteria
   * @param resources - Array of parsed resources
   * @param filters - Filter options
   * @returns Filtered resources
   */
  filterResources(resources: ParsedResource[], filters: FilterOptions): ParsedResource[] {
    return resources.filter(resource => {
      if (filters.service && resource.service !== filters.service) return false;
      if (filters.category && !resource.category.includes(filters.category)) return false;
      if (filters.isData !== undefined && resource.isData !== filters.isData) return false;
      return true;
    });
  }



  /**
   * Get service color for visualization
   * @param service - The service/category name
   * @returns Color string
   */
  getServiceColor(service: string): string {
    const colorMap: Record<string, string> = {
      'compute': '#3B82F6',      // Blue
      'database': '#10B981',     // Green
      'storage': '#F59E0B',      // Yellow
      'network': '#8B5CF6',      // Purple
      'security': '#EF4444',     // Red
      'monitoring': '#06B6D4',   // Cyan
      'messaging': '#EC4899',    // Pink
      'ai': '#84CC16',           // Lime
      'analytics': '#F97316',    // Orange
      'devtools': '#8B5CF6',     // Purple
      'management': '#6B7280',   // Gray
      'other': '#6B7280'         // Gray
    };
    
    return colorMap[service] || colorMap['other'];
  }

  /**
   * Get resource icon for visualization
   * @param service - The service/category name
   * @returns Icon string or path
   */
  getResourceIcon(service: string): string {
    const iconMap: Record<string, string> = {
      'compute': '⚙️',
      'database': '🗄️',
      'storage': '📦',
      'network': '🌐',
      'security': '🔒',
      'monitoring': '📊',
      'messaging': '💬',
      'ai': '🤖',
      'analytics': '📈',
      'devtools': '🛠️',
      'management': '⚡',
      'other': '📋'
    };
    
    return iconMap[service] || iconMap['other'];
  }

  /**
   * Populate connected nodes based on dependencies
   * @param resources - Array of parsed resources
   */
  private populateConnectedNodes(resources: ParsedResource[]): void {
    // Create a map of address to UUID for quick lookup
    const addressToUuid = new Map<string, string>();
    resources.forEach(resource => {
      addressToUuid.set(resource.address, resource.uuid);
    });
    
    // Populate connected nodes for each resource
    resources.forEach(resource => {
      if (resource.dependencies && resource.dependencies.length > 0) {
        resource.onScreenElements.connectedNodes = resource.dependencies
          .map(dep => addressToUuid.get(dep))
          .filter(uuid => uuid !== undefined) as string[];
      }
    });

      }

  /**
   * Get resources that belong to a specific group
   * @param groupKey - The group key (e.g., 'service_lambda', 'category_compute')
   * @param groupedResources - Grouped resources
   * @param resources - Original parsed resources
   * @returns Array of resources in the group
   */
  getResourcesByGroup(groupKey: string, groupedResources: GroupedResources, resources: ParsedResource[]): ParsedResource[] {
    const group = groupedResources[groupKey];
    if (!group) return [];
    
    return resources.filter(resource => group.child_uuids.includes(resource.uuid));
  }

  /**
   * Populate connection nodes between groups
   * @param groupedResources - Grouped resources
   * @param resources - Original parsed resources
   */
  private populateGroupConnections(groupedResources: GroupedResources, resources: ParsedResource[]): void {
    // Create a map of UUID to resource for quick lookup
    const uuidToResource = new Map<string, ParsedResource>();
    resources.forEach(resource => {
      uuidToResource.set(resource.uuid, resource);
    });
    
    // For each group, find connections to other groups
    Object.entries(groupedResources).forEach(([groupKey, group]) => {
      const connections: string[] = [];
      
      // Parse each child UUID in this group
      group.child_uuids.forEach(childUuid => {
        const childResource = uuidToResource.get(childUuid);
        if (childResource && childResource.onScreenElements.connectedNodes.length > 0) {
          // For each connected node, find its service and category
          childResource.onScreenElements.connectedNodes.forEach(connectedUuid => {
            const connectedResource = uuidToResource.get(connectedUuid);
            if (connectedResource) {
              // Get service and category keys for the connected resource
              const connectedServiceKey = `service_${connectedResource.service || 'unknown'}`;
              const connectedCategoryKey = `category_${connectedResource.category || 'general'}`;
              
              // Find unique service and category keys that this group connects to
              const targetKeys = new Set([connectedServiceKey, connectedCategoryKey]);
              
              // For each target key, get the group UUID and add to connections
              targetKeys.forEach(targetKey => {
                if (targetKey !== groupKey && groupedResources[targetKey]) {
                  const targetGroup = groupedResources[targetKey];
                  if (!connections.includes(targetGroup.uuid)) {
                    connections.push(targetGroup.uuid);
                  }
                }
              });
            }
          });
        }
      });
      
      // Update the group's connection nodes
      group.onScreenElements.connectionNodes = connections;
    });
  }

  /**
   * Parse GitHub Terraform files and convert to ParsedResource array
   * @param tfFiles - Array of .tf files with content and path
   * @returns Array of parsed resources in state-like format
   */
  parseGitHubTerraformFiles(tfFiles: Array<{ name: string; path: string; content: string }>): ParsedResource[] {
    const allResources: ParsedResource[] = [];
    
    tfFiles.forEach(file => {
      try {
        // Parse the .tf file content
        const parsedData = this.parseTerraformConfig(file.content, file.path);
        
        // Convert each resource to state-like format
        parsedData.resources.forEach(resource => {
          // Create a simulated "address" like terraform state list would return
          let address = resource.name;
          
          // Add module context if available
          if ((resource as any).module) {
            address = `module.${(resource as any).module}.${resource.type}.${resource.name}`;
          } else {
            address = `${resource.type}.${resource.name}`;
          }
          
          // Split type into provider/service/category
          const segs = resource.type.split('_');
          const provider = segs[0] || '';
          const service = segs[1] || '';
          const category = segs.slice(2).join('_') || '';
          
          // Extract modules from file path
          const modules: string[] = [];
          if ((resource as any).module) {
            modules.push(`module.${(resource as any).module}`);
          }
          
          // Check if file is in a modules subdirectory
          if (file.path.includes('/modules/')) {
            const pathParts = file.path.split('/');
            const modulesIndex = pathParts.indexOf('modules');
            if (modulesIndex !== -1 && pathParts[modulesIndex + 1]) {
              modules.push(`module.${pathParts[modulesIndex + 1]}`);
            }
          }
          
          const parsedResource: ParsedResource = {
            uuid: generateUUID(), // Generate a unique UUID
            address,
            type: resource.type,
            name: resource.name,
            modules,
            provider,
            service,
            category,
            isData: false, // Resources are not data sources
            attributes: resource.attributes || {},
            dependencies: resource.dependencies || [],
            onScreenElements: {
              icon: getServiceIcon(service), // Use the new utility function
              label: `${service}.${category}`,
              connectedNodes: [] // Will be populated after all resources are created
            }
          };
          
          allResources.push(parsedResource);
        });
        
      } catch (error) {
        console.warn(`Failed to parse Terraform file ${file.path}:`, error);
      }
    });
    
    // Populate connected nodes based on dependencies
    this.populateConnectedNodes(allResources);

    // Generate grouped resources and cache both
    const groupedResources = this.groupResources(allResources);
    const cacheKey = this.generateCacheKey(tfFiles);
    this.setCacheWithGrouped(cacheKey, allResources, groupedResources);

    console.log('All resources:', allResources);
    console.log('Grouped resources cached with key:', cacheKey);
    
    return allResources;
  }





  /**
   * Convert TerraformData to ParsedResource array for enhanced parsing
   * @param tfData - Terraform data from parseTerraformConfig
   * @param filePath - Optional file path for module context
   * @returns Array of parsed resources
   */
  convertTerraformDataToParsedResources(tfData: TerraformData, filePath?: string): ParsedResource[] {
    const parsedResources: ParsedResource[] = [];
    
    tfData.resources.forEach(resource => {
      // Create a simulated "address" like terraform state list would return
      let address = resource.name;
      
      // Add module context if available
      if ((resource as any).module) {
        address = `module.${(resource as any).module}.${resource.type}.${resource.name}`;
      } else {
        address = `${resource.type}.${resource.name}`;
      }
      
      // Split type into provider/service/category
      const segs = resource.type.split('_');
      const provider = segs[0] || '';
      const service = segs[1] || '';
      const category = segs.slice(2).join('_') || '';
      
      // Extract modules from file path or resource
      const modules: string[] = [];
      if ((resource as any).module) {
        modules.push(`module.${(resource as any).module}`);
      }
      
      // Check if file is in a modules subdirectory
      if (filePath && filePath.includes('/modules/')) {
        const pathParts = filePath.split('/');
        const modulesIndex = pathParts.indexOf('modules');
        if (modulesIndex !== -1 && pathParts[modulesIndex + 1]) {
          modules.push(`module.${pathParts[modulesIndex + 1]}`);
        }
      }
      
      const parsedResource: ParsedResource = {
        uuid: generateUUID(), // Generate a unique UUID
        address,
        type: resource.type,
        name: resource.name,
        modules,
        provider,
        service,
        category,
        isData: false, // Resources are not data sources
        attributes: resource.attributes || {},
        dependencies: resource.dependencies || [],
        onScreenElements: {
          icon: getServiceIcon(service), // Use the new utility function
          label: `${service}.${category}`,
          connectedNodes: [] // Will be populated after all resources are created
        }
      };
      
      parsedResources.push(parsedResource);
    });
    
    // Populate connected nodes based on dependencies
    this.populateConnectedNodes(parsedResources);
    
    // Generate grouped resources and cache both
    const groupedResources = this.groupResources(parsedResources);
    const cacheKey = `terraform_data_${filePath || 'unknown'}`;
    this.setCacheWithGrouped(cacheKey, parsedResources, groupedResources);
    
    return parsedResources;
  }

  /**
   * Build architecture diagram from parsed resources
   * @param resources - Array of parsed resources
   * @returns Architecture diagram
   */
  buildArchitectureDiagram(resources: ParsedResource[]): ArchitectureDiagram {
    const nodes: ArchitectureNode[] = [];
    const connections: Array<{ from: string; to: string; type: string }> = [];
    
    // Create nodes for each resource using ParsedResource data
    resources.forEach((resource, index) => {
      // Use the service.category from onScreenElements for better categorization
      const category = resource.onScreenElements.label || resource.service;
      // Use UUID as the node ID for consistency
      const nodeId = resource.uuid;
      
      // Smart layout based on category and modules
      let x = 100, y = 100;
      
      if (resource.modules.length > 0) {
        // Module resources get offset based on module depth
        x = 100 + (resource.modules.length * 50);
        y = 100 + (index * 80);
      } else {
        // Root resources get grid layout
        const row = Math.floor(index / 4);
        const col = index % 4;
        x = col * 250 + 100;
        y = row * 150 + 100;
      }
      
      nodes.push({
        id: nodeId,
        category,
        type: resource.type,
        name: resource.name,
        x,
        y,
        connections: []
      });
    });
    
    // Create connections based on ParsedResource dependencies and onScreenElements.connectedNodes
    nodes.forEach((node) => {
      const resource = resources.find(r => r.uuid === node.id);
      if (!resource) return;
      
      // Connect resources within the same module
      if (resource.modules.length > 0) {
        const modulePath = resource.modules.join('.');
        const sameModuleNodes = nodes.filter((n) => {
          const otherResource = resources.find(r => r.uuid === n.id);
          return otherResource && otherResource.modules.join('.') === modulePath && n.id !== node.id;
        });
        
        sameModuleNodes.forEach(otherNode => {
          connections.push({
            from: node.id,
            to: otherNode.id,
            type: 'module'
          });
        });
      }
      
      // Use the connectedNodes from onScreenElements for dependency connections
      if (resource.onScreenElements.connectedNodes.length > 0) {
        resource.onScreenElements.connectedNodes.forEach(connectedNodeUuid => {
          const targetNode = nodes.find(n => n.id === connectedNodeUuid);
          if (targetNode) {
            connections.push({
              from: node.id,
              to: targetNode.id,
              type: 'dependency'
            });
          }
        });
      }
      
      // Connect based on resource type dependencies (legacy logic)
      if (resource.type.includes('subnet') && resource.modules.length > 0) {
        // Find VPC in parent module
        const vpcNode = nodes.find(n => {
          const vpcResource = resources.find(r => r.uuid === n.id);
          return vpcResource && vpcResource.type.includes('vpc') && 
                 vpcResource.modules.length < resource.modules.length;
        });
        
        if (vpcNode) {
          connections.push({
            from: vpcNode.id,
            to: node.id,
            type: 'contains'
          });
        }
      }
    });
    
    return { nodes, connections };
  }

  /**
   * Extract dependencies from Terraform configuration
   * @param content - Terraform configuration content
   * @returns Array of dependency strings
   */
  extractDependencies(content: string): string[] {
    const dependencies: string[] = [];
    
    // depends_on dependencies
    const depRegex = /depends_on\s*=\s*\[([^\]]+)\]/g;
    let match;
    
    while ((match = depRegex.exec(content)) !== null) {
      const deps = match[1].split(',').map(dep => dep.trim().replace(/"/g, ''));
      dependencies.push(...deps);
    }
    
    // Reference dependencies (e.g., aws_subnet.private.id)
    const refRegex = /([a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*)/g;
    while ((match = refRegex.exec(content)) !== null) {
      if (!dependencies.includes(match[1])) {
        dependencies.push(match[1]);
      }
    }
    
    return dependencies;
  }

  /**
   * Validate Terraform configuration syntax
   * @param content - Terraform configuration content
   * @returns Validation result
   */
  validateTerraformConfig(content: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Basic validation checks
    if (!content.trim()) {
      errors.push('Configuration is empty');
    }
    
    // Check for balanced braces
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      errors.push('Unbalanced braces in configuration');
    }
    
    // Check for resource blocks
    if (!content.includes('resource')) {
      errors.push('No resource blocks found');
    }
    
    // Check for valid resource syntax
    const resourceRegex = /resource\s+["']([^"']+)["']\s+["']([^"']+)["']\s*{/g;
    if (!resourceRegex.test(content)) {
      errors.push('Invalid resource block syntax');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate cache key for a set of Terraform files
   * @param files - Array of Terraform files
   * @returns Cache key string
   */
  public generateCacheKey(files: Array<{ name: string; path: string; content: string }>): string {
    const fileCount = files.length;
    const filePaths = files.map(f => f.path).sort().join('|');
    const contentHash = files.map(f => f.content.length).reduce((sum, len) => sum + len, 0);
    return `tf_${fileCount}_${contentHash}_${filePaths.substring(0, 50)}`;
  }

  /**
   * Get cache key for resources
   * @param key - Cache key
   * @returns Cached resources or null
   */
  private getCache(key: string): ParsedResource[] | null {
    const cached = this.cache.get(key);
    const expiry = this.cacheExpiry.get(key);
    
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }
    
    // Clean up expired cache
    if (expiry && Date.now() >= expiry) {
      this.cache.delete(key);
      this.cacheExpiry.delete(key);
    }
    
    return null;
  }

  /**
   * Set cache for resources
   * @param key - Cache key
   * @param resources - Resources to cache
   */
  private setCache(key: string, resources: ParsedResource[]): void {
    this.cache.set(key, resources);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  /**
   * Get cached grouped resources by key
   * @param key - Cache key
   * @returns Cached grouped resources or null if not found/expired
   */
  private getGroupedCache(key: string): GroupedResources | null {
    const cached = this.groupedCache.get(key);
    const expiry = this.cacheExpiry.get(key);
    
    if (cached && expiry && Date.now() < expiry) {
      return cached;
    }
    
    // Clean up expired cache
    if (expiry && Date.now() >= expiry) {
      this.groupedCache.delete(key);
    }
    
    return null;
  }

  /**
   * Set cache with both resources and grouped resources
   * @param key - Cache key
   * @param resources - Resources to cache
   * @param groupedResources - Grouped resources to cache
   */
  private setCacheWithGrouped(key: string, resources: ParsedResource[], groupedResources: GroupedResources): void {
    this.cache.set(key, resources);
    this.groupedCache.set(key, groupedResources);
    this.cacheExpiry.set(key, Date.now() + this.CACHE_TTL);
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    this.groupedCache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getCacheStats(): { size: number; keys: string[]; groupedSize: number } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      groupedSize: this.groupedCache.size
    };
  }

  /**
   * Get cached grouped resources by key (public method)
   * @param key - Cache key
   * @returns Cached grouped resources or null if not found/expired
   */
  getCachedGroupedResources(key: string): GroupedResources | null {
    return this.getGroupedCache(key);
  }

  /**
   * Get cached resources by key (public method)
   * @param key - Cache key
   * @returns Cached resources or null if not found/expired
   */
  getCachedResources(key: string): ParsedResource[] | null {
    return this.getCache(key);
  }

  /**
   * Get detailed resource information by UUID
   * @param uuid - Resource UUID
   * @param resources - Array of parsed resources to search in
   * @returns ParsedResource or null if not found
   */
  getResourceByUUID(uuid: string, resources: ParsedResource[]): ParsedResource | null {
    return resources.find(resource => resource.uuid === uuid) || null;
  }

  /**
   * Get multiple resources by UUIDs
   * @param uuids - Array of resource UUIDs
   * @param resources - Array of parsed resources to search in
   * @returns Array of found ParsedResources
   */
  getResourcesByUUIDs(uuids: string[], resources: ParsedResource[]): ParsedResource[] {
    return resources.filter(resource => uuids.includes(resource.uuid));
  }

  /**
   * Get connected resources for a given resource UUID
   * @param uuid - Resource UUID
   * @param resources - Array of parsed resources to search in
   * @returns Array of connected ParsedResources
   */
  getConnectedResources(uuid: string, resources: ParsedResource[]): ParsedResource[] {
    const resource = this.getResourceByUUID(uuid, resources);
    if (!resource) return [];
    
    return this.getResourcesByUUIDs(resource.onScreenElements.connectedNodes, resources);
  }
}

// Export singleton instance
const TerraformParser = new TerraformParserClass();
export default TerraformParser;
