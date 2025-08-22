// Enhanced Terraform Parser for parsing and visualizing infrastructure configurations
// Provides methods for parsing .tf files, terraform state, and building architecture diagrams
// Based on terraform state list parsing approach for better resource discovery

export interface ParsedResource {
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
  attributes?: Record<string, any>;
  /** Dependencies between resources */
  dependencies?: string[];
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

export interface GroupedResources {
  [key: string]: ParsedResource[];
}

export interface FilterOptions {
  provider?: string;
  service?: string;
  category?: string;
  modules?: string[];
  isData?: boolean;
}

export type GroupKey = "provider" | "service" | "category" | "modules";

// Enhanced Terraform Parser class
class TerraformParserClass {
  private cache: Map<string, ParsedResource[]> = new Map();
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
        address,
        type: parts[0] || "",
        name: parts[1] || "",
        modules,
        provider: "",
        service: "",
        category: "",
        isData,
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

    return { address, type, name, modules, provider, service, category, isData };
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
  groupResources(resources: ParsedResource[], groupBy: GroupKey): GroupedResources {
    return resources.reduce((acc, resource) => {
      let key: string;
      
      switch (groupBy) {
        case 'provider':
          key = resource.provider || 'unknown';
          break;
        case 'service':
          key = resource.service || 'unknown';
          break;
        case 'category':
          key = resource.category || 'general';
          break;
        case 'modules':
          key = resource.modules.length > 0 ? resource.modules.join('.') : 'root';
          break;
        default:
          key = 'unknown';
      }
      
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(resource);
      return acc;
    }, {} as GroupedResources);
  }

  /**
   * Filter resources based on criteria
   * @param resources - Array of parsed resources
   * @param filters - Filter options
   * @returns Filtered resources
   */
  filterResources(resources: ParsedResource[], filters: FilterOptions): ParsedResource[] {
    return resources.filter(resource => {
      if (filters.provider && resource.provider !== filters.provider) return false;
      if (filters.service && resource.service !== filters.service) return false;
      if (filters.category && !resource.category.includes(filters.category)) return false;
      if (filters.isData !== undefined && resource.isData !== filters.isData) return false;
      if (filters.modules && filters.modules.length > 0) {
        const hasMatchingModule = filters.modules.some(module => 
          resource.modules.includes(module)
        );
        if (!hasMatchingModule) return false;
      }
      return true;
    });
  }

  /**
   * Get resource category based on Terraform resource type (enhanced)
   * @param resourceType - The Terraform resource type
   * @returns Category string
   */
  getResourceCategory(resourceType: string): string {
    const categoryMap: Record<string, string> = {
      // Compute
      'aws_lambda_function': 'compute',
      'aws_ec2_instance': 'compute',
      'aws_ecs_cluster': 'compute',
      'aws_ecs_service': 'compute',
      'aws_ecs_task_definition': 'compute',
      'aws_ecr_repository': 'compute',
      'aws_ecr_image': 'compute',
      'aws_batch_job_definition': 'compute',
      'aws_batch_compute_environment': 'compute',
      
      // Database
      'aws_dynamodb_table': 'database',
      'aws_rds_cluster': 'database',
      'aws_rds_instance': 'database',
      'aws_elasticache_cluster': 'database',
      'aws_elasticache_subnet_group': 'database',
      'aws_elasticache_parameter_group': 'database',
      'aws_docdb_cluster': 'database',
      'aws_docdb_cluster_instance': 'database',
      'aws_neptune_cluster': 'database',
      'aws_neptune_cluster_instance': 'database',
      
      // Storage
      'aws_s3_bucket': 'storage',
      'aws_s3_bucket_versioning': 'storage',
      'aws_s3_bucket_lifecycle_configuration': 'storage',
      'aws_efs_file_system': 'storage',
      'aws_efs_mount_target': 'storage',
      'aws_ebs_volume': 'storage',
      'aws_ebs_snapshot': 'storage',
      'aws_glacier_vault': 'storage',
      
      // Network
      'aws_apigatewayv2_api': 'network',
      'aws_apigatewayv2_stage': 'network',
      'aws_apigatewayv2_integration': 'network',
      'aws_apigatewayv2_route': 'network',
      'aws_cloudfront_distribution': 'network',
      'aws_alb': 'network',
      'aws_nlb': 'network',
      'aws_vpc': 'network',
      'aws_subnet': 'network',
      'aws_route_table': 'network',
      'aws_internet_gateway': 'network',
      'aws_nat_gateway': 'network',
      'aws_vpc_endpoint': 'network',
      'aws_vpc_peering_connection': 'network',
      'aws_transit_gateway': 'network',
      'aws_transit_gateway_vpc_attachment': 'network',
      
      // Security
      'aws_cognito_user_pool': 'security',
      'aws_cognito_user_pool_client': 'security',
      'aws_iam_role': 'security',
      'aws_iam_policy': 'security',
      'aws_iam_user': 'security',
      'aws_iam_group': 'security',
      'aws_secretsmanager_secret': 'security',
      'aws_kms_key': 'security',
      'aws_kms_alias': 'security',
      'aws_wafv2_web_acl': 'security',
      'aws_shield_protection': 'security',
      
      // Monitoring
      'aws_cloudwatch_log_group': 'monitoring',
      'aws_cloudwatch_dashboard': 'monitoring',
      'aws_cloudwatch_alarm': 'monitoring',
      'aws_cloudwatch_metric': 'monitoring',
      'aws_cloudwatch_event_rule': 'monitoring',
      'aws_cloudwatch_event_target': 'monitoring',
      'aws_grafana_workspace': 'monitoring',
      
      // Messaging
      'aws_sns_topic': 'messaging',
      'aws_sns_topic_subscription': 'messaging',
      'aws_sqs_queue': 'messaging',
      'aws_sqs_queue_policy': 'messaging',
      'aws_eventbridge_rule': 'messaging',
      'aws_eventbridge_target': 'messaging',
      'aws_mq_broker': 'messaging',
      'aws_mq_configuration': 'messaging',
      
      // AI/ML
      'aws_bedrock_model': 'ai',
      'aws_sagemaker_endpoint': 'ai',
      'aws_sagemaker_model': 'ai',
      'aws_sagemaker_notebook_instance': 'ai',
      'aws_comprehend_entity_recognizer': 'ai',
      'aws_translate_parallel_data': 'ai',
      'aws_rekognition_collection': 'ai',
      
      // Analytics
      'aws_glue_job': 'analytics',
      'aws_glue_crawler': 'analytics',
      'aws_glue_database': 'analytics',
      'aws_athena_workgroup': 'analytics',
      'aws_athena_database': 'analytics',
      'aws_quicksight_data_source': 'analytics',
      'aws_quicksight_dashboard': 'analytics',
      'aws_emr_cluster': 'analytics',
      'aws_emr_step': 'analytics',
      
      // Developer Tools
      'aws_codebuild_project': 'devtools',
      'aws_codedeploy_application': 'devtools',
      'aws_codedeploy_deployment_group': 'devtools',
      'aws_codepipeline': 'devtools',
      'aws_codecommit_repository': 'devtools',
      'aws_codestarconnections_connection': 'devtools',
      
      // Management
      'aws_organizations_organization': 'management',
      'aws_organizations_account': 'management',
      'aws_organizations_organizational_unit': 'management',
      'aws_controltower_control': 'management',
      'aws_servicecatalog_product': 'management',
      'aws_servicecatalog_provisioned_product': 'management'
    };
    
    return categoryMap[resourceType] || 'other';
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
            address,
            type: resource.type,
            name: resource.name,
            modules,
            provider,
            service,
            category,
            isData: false, // Resources are not data sources
            attributes: resource.attributes,
            dependencies: resource.dependencies
          };
          
          allResources.push(parsedResource);
        });
        
      } catch (error) {
        console.warn(`Failed to parse Terraform file ${file.path}:`, error);
      }
    });
    
    return allResources;
  }

  /**
   * Convert Terraform files to InfrastructureNodeData array
   * @param tfFiles - Array of .tf files with content and path
   * @returns Array of infrastructure node data
   */
  convertTerraformFilesToInfrastructure(tfFiles: Array<{ name: string; path: string; content: string }>): any[] {
    const infrastructure: any[] = [];
    
    tfFiles.forEach(file => {
      if (file.content) {
        try {
          // Parse the .tf file content with file path for module context
          const parsedData = this.parseTerraformConfig(file.content, file.path);
          
          // Convert parsed resources to infrastructure format
          if (parsedData.resources) {
            parsedData.resources.forEach(resource => {
              // Use built-in categorization
              const category = this.getResourceCategory(resource.type);
              const infrastructureType = this.mapCategoryToInfrastructureType(category);
              
              infrastructure.push({
                title: resource.name || `${resource.type}_${resource.name}`,
                resourceType: infrastructureType,
                description: `Terraform resource: ${resource.type} (${category})`,
                status: 'active',
                region: 'us-east-1',
                tags: resource.attributes || {},
                configuration: resource.attributes || {}
              });
            });
          }
        } catch (parseError) {
          console.warn(`Failed to parse Terraform file ${file.path}:`, parseError);
        }
      }
    });

    return infrastructure;
  }

  /**
   * Map TerraformParser categories to infrastructure types
   * @param category - Resource category from TerraformParser
   * @returns Infrastructure type string
   */
  mapCategoryToInfrastructureType(category: string): string {
    switch (category.toLowerCase()) {
      case 'compute':
      case 'lambda':
      case 'ecs':
      case 'ec2':
        return 'lambda';
      case 'storage':
      case 's3':
      case 'dynamodb':
      case 'rds':
      case 'elasticache':
        return 'dynamodb';
      case 'network':
      case 'vpc':
      case 'subnet':
      case 'gateway':
        return 'vpc';
      case 'security':
      case 'iam':
      case 'cognito':
      case 'secretsmanager':
        return 'iam';
      case 'monitoring':
      case 'cloudwatch':
      case 'logs':
        return 'cloudwatch';
      case 'integration':
      case 'apigateway':
      case 'sqs':
      case 'sns':
        return 'apigateway';
      case 'analytics':
      case 'glue':
      case 'athena':
      case 'quicksight':
        return 'glue';
      default:
        return 'lambda';
    }
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
        address,
        type: resource.type,
        name: resource.name,
        modules,
        provider,
        service,
        category,
        isData: false, // Resources are not data sources
        attributes: resource.attributes,
        dependencies: resource.dependencies
      };
      
      parsedResources.push(parsedResource);
    });
    
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
    
    // Create nodes for each resource
    resources.forEach((resource, index) => {
      const category = this.getResourceCategory(resource.type);
      const nodeId = resource.address.replace(/[^a-zA-Z0-9_]/g, '_');
      
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
    
    // Create connections based on dependencies and module relationships
    nodes.forEach((node, index) => {
      const resource = resources[index];
      
      // Connect resources within the same module
      if (resource.modules.length > 0) {
        const modulePath = resource.modules.join('.');
        const sameModuleNodes = nodes.filter((n, i) => {
          const otherResource = resources[i];
          return otherResource.modules.join('.') === modulePath && n.id !== node.id;
        });
        
        sameModuleNodes.forEach(otherNode => {
          connections.push({
            from: node.id,
            to: otherNode.id,
            type: 'module'
          });
        });
      }
      
      // Connect based on resource type dependencies
      if (resource.type.includes('subnet') && resource.modules.length > 0) {
        // Find VPC in parent module
        const vpcNode = nodes.find(n => 
          resources[nodes.indexOf(n)].type.includes('vpc') &&
          resources[nodes.indexOf(n)].modules.length < resource.modules.length
        );
        
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
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export singleton instance
const TerraformParser = new TerraformParserClass();
export default TerraformParser;
