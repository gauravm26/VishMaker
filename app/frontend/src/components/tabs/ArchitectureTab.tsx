import React, { useState, useEffect } from 'react';
import InfrastructureCanvasViewer from '../canvas/InfrastructureCanvasViewer';
import GitHubService from '../../utils/githubService';
import TerraformParser from '../../utils/terraformParser';
import { InfrastructureNodeData, InfrastructureResourceType } from '../canvas/InfrastructureNode';

interface ArchitectureTabProps {
    projectId: number | null;
    refreshTrigger?: number;
}

interface GitHubSettings {
    repo: string;
    branch: string;
}

// Terraform resource type mapping to our infrastructure types
const TERRAFORM_TO_INFRASTRUCTURE_TYPE: Record<string, InfrastructureResourceType> = {
    'aws_lambda_function': 'lambda',
    'aws_dynamodb_table': 'dynamodb',
    'aws_s3_bucket': 's3',
    'aws_apigatewayv2_api': 'apigateway',
    'aws_cloudfront_distribution': 'cloudfront',
    'aws_cognito_user_pool': 'cognito',
    'aws_iam_role': 'iam',
    'aws_cloudwatch_log_group': 'cloudwatch',
    'aws_route53_zone': 'route53',
    'aws_vpc': 'vpc',
    'aws_lb': 'alb',
    'aws_ecs_cluster': 'ecs',
    'aws_db_instance': 'rds',
    'aws_elasticache_cluster': 'elasticache',
    'aws_sqs_queue': 'sqs',
    'aws_sns_topic': 'sns',
    'aws_cloudwatch_event_rule': 'eventbridge',
    'aws_secretsmanager_secret': 'secretsmanager',
    'aws_ssm_parameter': 'ssm',
    'aws_ses_domain': 'ses',
    'aws_bedrock_model': 'bedrock',
    'aws_glue_job': 'glue',
    'aws_athena_workgroup': 'athena',
    'aws_quicksight_data_source': 'quicksight',
    'aws_appsync_graphql_api': 'appsync'
};

const ArchitectureTab: React.FC<ArchitectureTabProps> = ({ projectId, refreshTrigger = 0 }) => {
    const [githubSettings, setGitHubSettings] = useState<GitHubSettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showConfigureMessage, setShowConfigureMessage] = useState(false);
    const [infrastructureData, setInfrastructureData] = useState<InfrastructureNodeData[]>([]);
    const [terraformFiles, setTerraformFiles] = useState<Array<{ name: string; path: string; selected: boolean }>>([]);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [internalRefreshTrigger, setInternalRefreshTrigger] = useState(0);

    // Load GitHub settings from localStorage
    useEffect(() => {
        const savedSettings = localStorage.getItem('appSettings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                if (settings.github?.repo && settings.github?.branch) {
                    setGitHubSettings({
                        repo: settings.github.repo,
                        branch: settings.github.branch
                    });
                    setShowConfigureMessage(false);
                } else {
                    setShowConfigureMessage(true);
                }
            } catch (error) {
                console.error('Failed to load GitHub settings:', error);
                setShowConfigureMessage(true);
            }
        } else {
            setShowConfigureMessage(true);
        }
    }, []);

    // Handle refresh trigger from parent
    useEffect(() => {
        if (refreshTrigger > 0) {
            setInternalRefreshTrigger(prev => prev + 1);
        }
    }, [refreshTrigger]);

    // Load infrastructure data from GitHub Terraform files
    useEffect(() => {
        if (!githubSettings) return;

        const loadInfrastructureData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const repoInfo = GitHubService.parseRepoPath(githubSettings.repo);
                if (!repoInfo) {
                    throw new Error(`Invalid repository format: "${githubSettings.repo}". Please use the format: owner/repository`);
                }

                // Get repository contents and filter for Terraform files
                const terraformFiles = await getTerraformFilesFromRepo(
                    repoInfo.owner,
                    repoInfo.repo,
                    githubSettings.branch
                );

                // Set the Terraform files list for the sidebar
                const fileList = terraformFiles.map((file, index) => ({
                    name: file.name,
                    path: file.path,
                    selected: index === 0 // First file is selected by default
                }));
                setTerraformFiles(fileList);
                setSelectedFile(terraformFiles[0]?.path || null);

                // Parse Terraform files and convert to infrastructure data
                const parsedData = parseTerraformToInfrastructure(terraformFiles);
                setInfrastructureData(parsedData);

            } catch (err) {
                console.error('Failed to load infrastructure data:', err);
                setError(err instanceof Error ? err.message : 'Failed to load infrastructure data');
            } finally {
                setIsLoading(false);
            }
        };

        loadInfrastructureData();
    }, [githubSettings, internalRefreshTrigger]);

    // Get Terraform files from GitHub repository using GitHubService
    const getTerraformFilesFromRepo = async (owner: string, repo: string, branch: string): Promise<any[]> => {
        try {
            const terraformFiles: any[] = [];
            
            // Recursively search for .tf files in all directories (using existing pattern)
            const searchTerraformFilesRecursively = async (path: string = ''): Promise<void> => {
                try {
                    const contents = await GitHubService.getContents(owner, repo, path, branch);
                    
                    for (const item of contents) {
                        if (item.type === 'file' && item.name.endsWith('.tf')) {
                            // Simple filter: exclude variable/output files like the backup code does
                            const fileName = item.name.toLowerCase();
                            const isVariableFile = fileName === 'variables.tf' || fileName === 'terraform-variables.tf';
                            const isOutputFile = fileName === 'outputs.tf' || fileName === 'output.tf' || fileName === 'terraform-outputs.tf';
                            
                            if (!isVariableFile && !isOutputFile) {
                                // Get file content using GitHubService
                                try {
                                    const content = await GitHubService.getRawFileContent(owner, repo, item.path, branch);
                                    terraformFiles.push({
                                        name: item.name,
                                        path: item.path,
                                        content: content
                                    });
                                    console.log(`Found Terraform file: ${item.path}`);
                                } catch (contentError) {
                                    console.warn(`Failed to get content for ${item.path}:`, contentError);
                                }
                            } else {
                                console.log(`Skipping: ${item.path} (variable/output file)`);
                            }
                        } else if (item.type === 'dir') {
                            // Recursively search subdirectories
                            await searchTerraformFilesRecursively(item.path);
                        }
                    }
                } catch (error) {
                    console.warn(`Failed to search directory ${path}:`, error);
                    // Continue searching other directories even if one fails
                }
            };
            
            await searchTerraformFilesRecursively();
            return terraformFiles;
            
        } catch (error) {
            console.error('Error fetching Terraform files:', error);
            throw error;
        }
    };

    // Parse Terraform files and convert to our infrastructure format using existing TerraformParser
    const parseTerraformToInfrastructure = (terraformFiles: any[]): InfrastructureNodeData[] => {
        const infrastructure: InfrastructureNodeData[] = [];
        
        terraformFiles.forEach(file => {
            if (file.content) {
                try {
                    // Use existing TerraformParser to parse the content
                    const parsedData = TerraformParser.parseTerraformConfig(file.content);
                    
                    // Convert parsed resources to our infrastructure format
                    if (parsedData.resources) {
                        parsedData.resources.forEach(resource => {
                            const infrastructureType = TERRAFORM_TO_INFRASTRUCTURE_TYPE[resource.type] || 'lambda';
                            
                            infrastructure.push({
                                title: resource.name || `${resource.type}_${resource.name}`,
                                resourceType: infrastructureType,
                                description: `Terraform resource: ${resource.type}`,
                                status: 'active' as const,
                                region: 'us-east-1', // Default region
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
    };

    // Handle Terraform file selection
    const handleTerraformFileSelect = async (filePath: string) => {
        console.log('Selected Terraform file:', filePath);
        
        // Update selected file
        setTerraformFiles(prev => prev.map(file => ({
            ...file,
            selected: file.path === filePath
        })));
        setSelectedFile(filePath);
        
        // Reload infrastructure data for the selected file
        if (githubSettings) {
            try {
                const repoInfo = GitHubService.parseRepoPath(githubSettings.repo);
                if (repoInfo) {
                    const fileContent = await getTerraformFileContent(
                        repoInfo.owner,
                        repoInfo.repo,
                        filePath,
                        githubSettings.branch
                    );
                    
                    if (fileContent) {
                        try {
                            // Use existing TerraformParser to parse the content
                            const parsedData = TerraformParser.parseTerraformConfig(fileContent);
                            
                            // Convert parsed resources to our infrastructure format
                            const infrastructure: InfrastructureNodeData[] = [];
                            if (parsedData.resources) {
                                parsedData.resources.forEach(resource => {
                                    const infrastructureType = TERRAFORM_TO_INFRASTRUCTURE_TYPE[resource.type] || 'lambda';
                                    
                                    infrastructure.push({
                                        title: resource.name || `${resource.type}_${resource.name}`,
                                        resourceType: infrastructureType,
                                        description: `Terraform resource: ${resource.type}`,
                                        status: 'active' as const,
                                        region: 'us-east-1',
                                        tags: resource.attributes || {},
                                        configuration: resource.attributes || {}
                                    });
                                });
                            }
                            
                            setInfrastructureData(infrastructure);
                        } catch (parseError) {
                            console.warn(`Failed to parse Terraform file ${filePath}:`, parseError);
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading selected file:', error);
            }
        }
    };

    // Handle grouping by service
    const handleGroupByService = () => {
        console.log('Group by service clicked');
        
        // Group infrastructure data by resource type
        const grouped = infrastructureData.reduce((acc, resource) => {
            const service = resource.resourceType;
            if (!acc[service]) {
                acc[service] = [];
            }
            acc[service].push(resource);
            return acc;
        }, {} as Record<string, InfrastructureNodeData[]>);
        
        // Convert grouped data back to flat array for the canvas
        const groupedInfrastructure: InfrastructureNodeData[] = [];
        Object.entries(grouped).forEach(([service, resources]) => {
            // Add a service header node
            groupedInfrastructure.push({
                title: `${service.toUpperCase()} Service Group`,
                resourceType: 'iam' as InfrastructureResourceType, // Use IAM icon for service groups
                description: `${resources.length} resources in ${service} service`,
                status: 'active' as const,
                region: 'us-east-1',
                tags: { Service: service, Group: 'service-group' },
                configuration: { resourceCount: resources.length }
            });
            
            // Add the actual resources
            groupedInfrastructure.push(...resources);
        });
        
        setInfrastructureData(groupedInfrastructure);
    };

    // Get content of a specific Terraform file using GitHubService
    const getTerraformFileContent = async (owner: string, repo: string, filePath: string, branch: string): Promise<string | null> => {
        try {
            const content = await GitHubService.getRawFileContent(owner, repo, filePath, branch);
            return content;
        } catch (error) {
            console.error('Error fetching file content:', error);
            return null;
        }
    };



    const renderConfigureMessage = () => {
        return (
            <div className="h-full w-full flex items-center justify-center p-8">
                <div className="text-center max-w-md mx-auto">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full flex items-center justify-center border border-white/10 backdrop-blur-lg">
                        <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-4">Infrastructure Architecture Canvas</h3>
                    <p className="text-gray-300 mb-8 leading-relaxed">
                        View your infrastructure architecture using an interactive Canvas, built from Terraform (.tf) files in your GitHub repository.
                    </p>
                    
                    <div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10 mb-6">
                        <p className="text-sm text-gray-400">
                            Go to <strong className="text-white">Settings → GitHub Repository</strong> and enter your repository path and branch.
                        </p>
                    </div>
                    
                    <div className="space-y-4 text-sm text-gray-400">
                        <div className="flex items-start space-x-3">
                            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                            <div>
                                <strong className="text-white">Terraform Files:</strong> Automatically detects and parses .tf files
                            </div>
                        </div>
                        
                        <div className="flex items-start space-x-3">
                            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                            <div>
                                <strong className="text-white">Interactive Canvas:</strong> Drag, zoom, and explore your infrastructure
                            </div>
                        </div>
                        
                        <div className="flex items-start space-x-3">
                            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                            <div>
                                <strong className="text-white">Resource Visualization:</strong> Beautiful, organized view of AWS resources
                            </div>
                        </div>
                        
                        <div className="flex items-start space-x-3">
                            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                            <div>
                                <strong className="text-white">Real-time Updates:</strong> Reflects changes in your Terraform files
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderError = (errorMessage: string) => {
        return (
            <div className="h-full w-full flex items-center justify-center p-8">
                <div className="text-center max-w-md mx-auto">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center border border-red-400/20">
                        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Error Loading Infrastructure</h3>
                    <p className="text-gray-300 mb-4">{errorMessage}</p>
                    <div className="text-sm text-gray-400">
                        Check your GitHub repository settings in <strong className="text-white">Settings → GitHub Repository</strong>
                    </div>
                </div>
            </div>
        );
    };

    const renderInfrastructureCanvas = () => {
        if (!githubSettings) return null;

        return (
            <div className="h-full">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center space-x-2">
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="text-sm font-medium text-white">
                            {githubSettings.repo}
                        </span>
                        <span className="text-xs text-gray-400">
                            ({githubSettings.branch})
                        </span>
                    </div>
                    <div className="text-xs text-gray-400">
                        {infrastructureData.length} resources loaded
                    </div>
                </div>
                <div className="h-full">
                    <InfrastructureCanvasViewer
                        projectId={projectId?.toString()}
                        onNodeClick={(nodeId, data) => console.log('Node clicked:', nodeId, data)}
                        onNodeEdit={(nodeId, data) => console.log('Node edit:', nodeId, data)}
                        customInfrastructureData={infrastructureData}
                        terraformFiles={terraformFiles}
                        onTerraformFileSelect={handleTerraformFileSelect}
                        onGroupByService={handleGroupByService}
                    />
                </div>
            </div>
        );
    };

    if (showConfigureMessage) {
        return renderConfigureMessage();
    }

    if (error) {
        return renderError(error);
    }

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center p-8">
                <div className="text-center max-w-md mx-auto">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full flex items-center justify-center border border-white/10 backdrop-blur-lg">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400"></div>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-4">Loading Infrastructure</h3>
                    <p className="text-gray-300">Parsing Terraform files from GitHub...</p>
                </div>
            </div>
        );
    }

    if (githubSettings && infrastructureData.length > 0) {
        return renderInfrastructureCanvas();
    }

    // Fallback state
    return (
        <div className="h-full w-full flex items-center justify-center p-8">
            <div className="text-center max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full flex items-center justify-center border border-white/10 backdrop-blur-lg">
                    <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">No Infrastructure Data</h3>
                <p className="text-gray-300">Configure your GitHub repository to view infrastructure architecture.</p>
            </div>
        </div>
    );
};

export default ArchitectureTab; 