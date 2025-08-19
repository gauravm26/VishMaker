// Terraform Parser for parsing and visualizing infrastructure configurations
// Provides methods for parsing .tf files and building architecture diagrams

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

// Terraform Parser class
class TerraformParserClass {
  /**
   * Parse Terraform configuration content
   * @param content - The content of a .tf file
   * @returns Parsed Terraform data
   */
  parseTerraformConfig(content: string): TerraformData {
    try {
      const resources: TerraformResource[] = [];
      
      // Simple regex-based parsing for basic resource extraction
      // This is a simplified parser - in production you might want a more robust solution
      const resourceRegex = /resource\s+["']([^"']+)["']\s+["']([^"']+)["']\s*{([^}]+)}/g;
      let match;
      
      while ((match = resourceRegex.exec(content)) !== null) {
        const [, resourceType, resourceName, resourceBody] = match;
        
        // Extract provider from resource type
        const provider = resourceType.split('_')[0];
        
        // Extract basic attributes (simplified)
        const attributes: Record<string, any> = {};
        const attrRegex = /(\w+)\s*=\s*["']([^"']+)["']/g;
        let attrMatch;
        
        while ((attrMatch = attrRegex.exec(resourceBody)) !== null) {
          const [, key, value] = attrMatch;
          attributes[key] = value;
        }
        
        resources.push({
          type: resourceType,
          name: resourceName,
          provider,
          attributes,
          dependencies: []
        });
      }
      
      return { resources };
    } catch (error) {
      console.error('Error parsing Terraform config:', error);
      return { resources: [] };
    }
  }

  /**
   * Get resource category based on Terraform resource type
   * @param resourceType - The Terraform resource type
   * @returns Category string
   */
  getResourceCategory(resourceType: string): string {
    const categoryMap: Record<string, string> = {
      'aws_lambda_function': 'compute',
      'aws_ec2_instance': 'compute',
      'aws_ecs_cluster': 'compute',
      'aws_ecs_service': 'compute',
      'aws_ecs_task_definition': 'compute',
      'aws_dynamodb_table': 'database',
      'aws_rds_cluster': 'database',
      'aws_rds_instance': 'database',
      'aws_elasticache_cluster': 'database',
      'aws_s3_bucket': 'storage',
      'aws_efs_file_system': 'storage',
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
      'aws_cognito_user_pool': 'security',
      'aws_iam_role': 'security',
      'aws_iam_policy': 'security',
      'aws_secretsmanager_secret': 'security',
      'aws_kms_key': 'security',
      'aws_cloudwatch_log_group': 'monitoring',
      'aws_cloudwatch_dashboard': 'monitoring',
      'aws_cloudwatch_alarm': 'monitoring',
      'aws_sns_topic': 'messaging',
      'aws_sqs_queue': 'messaging',
      'aws_eventbridge_rule': 'messaging',
      'aws_bedrock_model': 'ai',
      'aws_sagemaker_endpoint': 'ai',
      'aws_comprehend_entity_recognizer': 'ai'
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
      'other': '📋'
    };
    
    return iconMap[service] || iconMap['other'];
  }

  /**
   * Build architecture diagram from Terraform data
   * @param tfData - Parsed Terraform data
   * @returns Architecture diagram
   */
  buildArchitectureDiagram(tfData: TerraformData): ArchitectureDiagram {
    const nodes: ArchitectureNode[] = [];
    const connections: Array<{ from: string; to: string; type: string }> = [];
    
    // Create nodes for each resource
    tfData.resources.forEach((resource, index) => {
      const category = this.getResourceCategory(resource.type);
      const nodeId = `${resource.type}_${resource.name}`;
      
      // Simple grid layout
      const row = Math.floor(index / 3);
      const col = index % 3;
      
      nodes.push({
        id: nodeId,
        category,
        type: resource.type,
        name: resource.name,
        x: col * 200 + 100,
        y: row * 150 + 100,
        connections: []
      });
    });
    
    // Create connections based on dependencies (simplified)
    // In a real implementation, you'd parse actual dependency relationships
    nodes.forEach((node, index) => {
      if (index > 0) {
        const prevNode = nodes[index - 1];
        connections.push({
          from: prevNode.id,
          to: node.id,
          type: 'dependency'
        });
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
    const depRegex = /depends_on\s*=\s*\[([^\]]+)\]/g;
    let match;
    
    while ((match = depRegex.exec(content)) !== null) {
      const deps = match[1].split(',').map(dep => dep.trim().replace(/"/g, ''));
      dependencies.push(...deps);
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
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
const TerraformParser = new TerraformParserClass();
export default TerraformParser;
