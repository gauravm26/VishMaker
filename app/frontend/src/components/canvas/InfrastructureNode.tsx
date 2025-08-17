// app-ui/src/components/canvas/InfrastructureNode.tsx
import React, { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';

// Infrastructure resource types
export type InfrastructureResourceType = 
  | 'lambda' 
  | 'dynamodb' 
  | 's3' 
  | 'apigateway' 
  | 'cloudfront' 
  | 'cognito' 
  | 'iam' 
  | 'cloudwatch' 
  | 'route53'
  | 'vpc'
  | 'alb'
  | 'ecs'
  | 'rds'
  | 'elasticache'
  | 'sqs'
  | 'sns'
  | 'eventbridge'
  | 'secretsmanager'
  | 'ssm'
  | 'ses'
  | 'bedrock'
  | 'glue'
  | 'athena'
  | 'quicksight'
  | 'appsync';

// Infrastructure node data interface
export interface InfrastructureNodeData {
  title: string;
  resourceType: InfrastructureResourceType;
  description?: string;
  status?: 'active' | 'inactive' | 'error' | 'pending';
  region?: string;
  tags?: Record<string, string>;
  configuration?: Record<string, any>;
  awsIcon?: string; // AWS icon path
  isHighlighted?: boolean; // Whether this node is highlighted
  isConnected?: boolean; // Whether this node is connected to selected node
  metrics?: {
    cpu?: number;
    memory?: number;
    requests?: number;
    errors?: number;
  };
  cost?: {
    monthly?: number;
    daily?: number;
  };
  security?: {
    encryption?: boolean;
    public?: boolean;
    compliance?: string[];
  };
}

// Props for the InfrastructureNode component
interface InfrastructureNodeProps extends NodeProps<InfrastructureNodeData> {
  onNodeClick?: (nodeId: string, data: InfrastructureNodeData) => void;
  onNodeDoubleClick?: (nodeId: string, data: InfrastructureNodeData) => void;
  onNodeEdit?: (nodeId: string, data: InfrastructureNodeData) => void;
  awsIcon?: string; // AWS icon path
}

// Resource type configuration
export const RESOURCE_CONFIG = {
  lambda: {
    color: 'bg-orange-500',
    borderColor: 'border-orange-400',
    textColor: 'text-orange-100',
    bgColor: 'bg-gradient-to-br from-orange-600/30 to-orange-700/20',
    label: 'Lambda Function'
  },
  dynamodb: {
    color: 'bg-blue-500',
    borderColor: 'border-blue-400',
    textColor: 'text-blue-100',
    bgColor: 'bg-gradient-to-br from-blue-600/30 to-blue-700/20',
    label: 'DynamoDB Table'
  },
  s3: {
    color: 'bg-green-500',
    borderColor: 'border-green-400',
    textColor: 'text-green-100',
    bgColor: 'bg-gradient-to-br from-green-600/30 to-green-700/20',
    label: 'S3 Bucket'
  },
  apigateway: {
    color: 'bg-purple-500',
    borderColor: 'border-purple-400',
    textColor: 'text-purple-100',
    bgColor: 'bg-purple-600/20',
    label: 'API Gateway'
  },
  cloudfront: {
    color: 'bg-indigo-500',
    borderColor: 'border-indigo-400',
    textColor: 'text-indigo-100',
    bgColor: 'bg-indigo-600/20',
    label: 'CloudFront'
  },
  cognito: {
    color: 'bg-pink-500',
    borderColor: 'border-pink-400',
    textColor: 'text-pink-100',
    bgColor: 'bg-pink-600/20',
    label: 'Cognito'
  },
  iam: {
    color: 'bg-red-500',
    borderColor: 'border-red-400',
    textColor: 'text-red-100',
    bgColor: 'bg-red-600/20',
    label: 'IAM'
  },
  cloudwatch: {
    color: 'bg-yellow-500',
    borderColor: 'border-yellow-400',
    textColor: 'text-yellow-100',
    bgColor: 'bg-yellow-600/20',
    label: 'CloudWatch'
  },
  route53: {
    color: 'bg-teal-500',
    borderColor: 'border-teal-400',
    textColor: 'text-teal-100',
    bgColor: 'bg-teal-600/20',
    label: 'Route53'
  },
  vpc: {
    color: 'bg-gray-500',
    borderColor: 'border-gray-400',
    textColor: 'text-gray-100',
    bgColor: 'bg-gray-600/20',
    label: 'VPC'
  },
  alb: {
    color: 'bg-cyan-500',
    borderColor: 'border-cyan-400',
    textColor: 'text-cyan-100',
    bgColor: 'bg-cyan-600/20',
    label: 'Application Load Balancer'
  },
  ecs: {
    color: 'bg-emerald-500',
    borderColor: 'border-emerald-400',
    textColor: 'text-emerald-100',
    bgColor: 'bg-emerald-600/20',
    label: 'ECS'
  },
  rds: {
    icon: '🗃️',
    color: 'bg-amber-500',
    borderColor: 'border-amber-400',
    textColor: 'text-amber-100',
    bgColor: 'bg-amber-600/20',
    label: 'RDS'
  },
  elasticache: {
    icon: '⚡',
    color: 'bg-lime-500',
    borderColor: 'border-lime-400',
    textColor: 'text-lime-100',
    bgColor: 'bg-lime-600/20',
    label: 'ElastiCache'
  },
  sqs: {
    icon: '📨',
    color: 'bg-fuchsia-500',
    borderColor: 'border-fuchsia-400',
    textColor: 'text-fuchsia-100',
    bgColor: 'bg-fuchsia-600/20',
    label: 'SQS'
  },
  sns: {
    icon: '📢',
    color: 'bg-rose-500',
    borderColor: 'border-rose-400',
    textColor: 'text-rose-100',
    bgColor: 'bg-rose-600/20',
    label: 'SNS'
  },
  eventbridge: {
    icon: '🚀',
    color: 'bg-violet-500',
    borderColor: 'border-violet-400',
    textColor: 'text-violet-100',
    bgColor: 'bg-violet-600/20',
    label: 'EventBridge'
  },
  secretsmanager: {
    icon: '🔑',
    color: 'bg-orange-600',
    borderColor: 'border-orange-500',
    textColor: 'text-orange-100',
    bgColor: 'bg-orange-700/20',
    label: 'Secrets Manager'
  },
  ssm: {
    icon: '⚙️',
    color: 'bg-slate-500',
    borderColor: 'border-slate-400',
    textColor: 'text-slate-100',
    bgColor: 'bg-slate-600/20',
    label: 'SSM'
  },
  ses: {
    icon: '📧',
    color: 'bg-sky-500',
    borderColor: 'border-sky-400',
    textColor: 'text-sky-100',
    bgColor: 'bg-sky-600/20',
    label: 'SES'
  },
  bedrock: {
    icon: '🤖',
    color: 'bg-purple-600',
    borderColor: 'border-purple-500',
    textColor: 'text-purple-100',
    bgColor: 'bg-purple-700/20',
    label: 'Bedrock'
  },
  glue: {
    icon: '🕷️',
    color: 'bg-orange-700',
    borderColor: 'border-orange-600',
    textColor: 'text-orange-100',
    bgColor: 'bg-orange-800/20',
    label: 'Glue'
  },
  athena: {
    icon: '🏛️',
    color: 'bg-blue-700',
    borderColor: 'border-blue-600',
    textColor: 'text-blue-100',
    bgColor: 'bg-blue-800/20',
    label: 'Athena'
  },
  quicksight: {
    icon: '📈',
    color: 'bg-green-700',
    borderColor: 'border-green-600',
    textColor: 'text-green-100',
    bgColor: 'bg-green-800/20',
    label: 'QuickSight'
  },
  appsync: {
    icon: '🔄',
    color: 'bg-indigo-700',
    borderColor: 'border-indigo-600',
    textColor: 'text-indigo-100',
    bgColor: 'bg-indigo-800/20',
    label: 'AppSync'
  }
};

const InfrastructureNode: React.FC<InfrastructureNodeProps> = ({ 
  data, 
  id: nodeId, 
  selected,
  onNodeClick,
  onNodeDoubleClick,
  onNodeEdit,
  awsIcon
}) => {
  const { title, resourceType, description, status = 'active', region, tags, configuration, metrics, cost, security } = data;
  const reactFlowInstance = useReactFlow();
  
  const config = RESOURCE_CONFIG[resourceType] || RESOURCE_CONFIG.lambda;
  
  // Status colors
  const statusColors = {
    active: 'bg-green-500',
    inactive: 'bg-gray-500',
    error: 'bg-red-500',
    pending: 'bg-yellow-500'
  };

  const handleNodeClick = useCallback(() => {
    onNodeClick?.(nodeId, data);
  }, [nodeId, data, onNodeClick]);

  const handleNodeDoubleClick = useCallback(() => {
    onNodeDoubleClick?.(nodeId, data);
  }, [nodeId, data, onNodeDoubleClick]);

  const handleNodeEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onNodeEdit?.(nodeId, data);
  }, [nodeId, data, onNodeEdit]);

  // Determine node styling based on selection state
  const getNodeStyling = () => {
    let baseClasses = 'relative w-20 h-20 cursor-pointer transition-all duration-300 hover:scale-110';
    
    if (data.isHighlighted) {
      // Highlighted node - full opacity
      baseClasses += ' opacity-100';
    } else if (data.isConnected) {
      // Connected node - slightly dimmed
      baseClasses += ' opacity-60';
    } else {
      // Non-connected node - heavily dimmed
      baseClasses += ' opacity-20';
    }
    
    if (selected) {
      baseClasses += ' ring-2 ring-blue-400 ring-offset-2';
    }
    
    return baseClasses;
  };

  return (
    <div
      className={getNodeStyling()}
      onClick={handleNodeClick}
      onDoubleClick={handleNodeDoubleClick}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-blue-400 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-green-400 border-2 border-white"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-purple-400 border-2 border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-orange-400 border-2 border-white"
      />

      {/* Icon Only - No Box */}
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-16 h-16 flex items-center justify-center mb-2">
          {awsIcon ? (
            <img src={awsIcon} alt={config.label} className="w-16 h-16" />
          ) : (
            <div className="text-5xl text-white drop-shadow-lg">⚡</div>
          )}
        </div>
        <div className="text-center">
          <h3 className="font-bold text-xs text-white mb-1 line-clamp-2">
            {title}
          </h3>
          <p className="text-xs text-gray-300 opacity-90">
            {config.label}
          </p>
        </div>
      </div>
    </div>
  );
};

export default memo(InfrastructureNode);
