// app-ui/src/components/Settings.tsx
import React, { useState, useEffect } from 'react';
import GitHubService from '../lib/githubService';

interface SettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

interface SettingsData {
    apiKeys: {
        openai?: string;
        anthropic?: string;
        google?: string;
    };
    aws: {
        accountId?: string;
        crossAccountRoleArn?: string;
        region?: string;
    };
    github: {
        repo?: string;
        branch?: string;
        token?: string;
    };
    techStack: {
        stack: {
            frontend: string;
            css: string;
            api: string;
            language: string;
            cloud: string;
        };
        selectedBundle: string;
        capabilities: {
            authentication: {
                impl: string;
                scope: string[];
                config: {
                    userpool: boolean;
                    hosted_ui: boolean;
                };
            };
            oltp: {
                impl: string;
                scope: string[];
                config: {
                    billing: string;
                    single_table: boolean;
                };
            };
            api_ingress: {
                impl: string;
                scope: string[];
            };
            compute: {
                impl: string;
                scope: string[];
                config: {
                    runtime: string;
                    arch: string;
                };
            };
            object_storage: {
                impl: string;
                scope: string[];
            };
            cdn: {
                impl: string;
                scope: string[];
            };
            messaging: {
                impl: string;
                scope: string[];
                optional: boolean;
            };
            events: {
                impl: string;
                scope: string[];
            };
            observability: {
                impl: string;
                scope: string[];
            };
            secrets: {
                impl: string;
                scope: string[];
            };
            email: {
                impl: string;
                scope: string[];
                optional: boolean;
            };
        };
    };
}

interface TechBundle {
    id: string;
    name: string;
    description: string;
    capabilities: {
        [key: string]: any;
    };
    recommended: boolean;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
    // Tech Bundle Definitions
    const techBundles: TechBundle[] = [
        {
            id: "serverless-starter",
            name: "Serverless Starter",
            description: "CloudFront + S3 (static hosting), API Gateway (HTTP), Lambda (Python 3.11, ARM64), DynamoDB (on-demand), Cognito (User Pool + Hosted UI), CloudWatch Logs, X-Ray, Route53 (optional), SSM Parameter Store, IAM least-priv roles.",
            recommended: true,
            capabilities: {
                authentication: {
                    impl: "aws.cognito",
                    scope: ["global:web", "global:api"],
                    config: { userpool: true, hosted_ui: true }
                },
                oltp: {
                    impl: "aws.dynamodb",
                    scope: ["global:api"],
                    config: { billing: "PAY_PER_REQUEST", single_table: true }
                },
                api_ingress: {
                    impl: "aws.apigateway.http",
                    scope: ["global:api"]
                },
                compute: {
                    impl: "aws.lambda",
                    scope: ["api:/v1/*", "jobs:*"],
                    config: { runtime: "python3.11", arch: "arm64" }
                },
                object_storage: {
                    impl: "aws.s3",
                    scope: ["web:assets", "api:uploads"]
                },
                cdn: {
                    impl: "aws.cloudfront",
                    scope: ["web:*"]
                },
                observability: {
                    impl: "aws.cloudwatch+xray",
                    scope: ["global:*"]
                },
                secrets: {
                    impl: "aws.ssm",
                    scope: ["global:*"]
                }
            }
        },
        {
            id: "containerized-api",
            name: "Containerized API",
            description: "ALB + ECS Fargate (FastAPI), RDS Postgres, ElastiCache Redis (optional), Cognito, CloudWatch, Route53.",
            recommended: false,
            capabilities: {
                authentication: {
                    impl: "aws.cognito",
                    scope: ["global:web", "global:api"],
                    config: { userpool: true, hosted_ui: true }
                },
                oltp: {
                    impl: "aws.rds.postgresql",
                    scope: ["global:api"],
                    config: { engine: "postgresql", instance_class: "db.t3.micro" }
                },
                api_ingress: {
                    impl: "aws.alb",
                    scope: ["global:api"]
                },
                compute: {
                    impl: "aws.ecs.fargate",
                    scope: ["api:/v1/*"],
                    config: { platform: "linux", cpu: "256", memory: "512" }
                },
                object_storage: {
                    impl: "aws.s3",
                    scope: ["api:uploads"]
                },
                observability: {
                    impl: "aws.cloudwatch",
                    scope: ["global:*"]
                }
            }
        },
        {
            id: "realtime-graphql",
            name: "Realtime/GraphQL",
            description: "AppSync, DynamoDB, Cognito, EventBridge, Lambda resolvers, CloudFront + S3.",
            recommended: false,
            capabilities: {
                authentication: {
                    impl: "aws.cognito",
                    scope: ["global:web", "global:api"],
                    config: { userpool: true, hosted_ui: true }
                },
                oltp: {
                    impl: "aws.dynamodb",
                    scope: ["global:api"],
                    config: { billing: "PAY_PER_REQUEST", single_table: true }
                },
                api_ingress: {
                    impl: "aws.appsync",
                    scope: ["global:api"]
                },
                compute: {
                    impl: "aws.lambda",
                    scope: ["api:resolvers"],
                    config: { runtime: "python3.11", arch: "arm64" }
                },
                object_storage: {
                    impl: "aws.s3",
                    scope: ["web:assets"]
                },
                cdn: {
                    impl: "aws.cloudfront",
                    scope: ["web:*"]
                },
                events: {
                    impl: "aws.eventbridge",
                    scope: ["global:*"]
                }
            }
        },
        {
            id: "data-etl",
            name: "Data/ETL",
            description: "S3 data lake, Glue, Athena, Lake Formation, EventBridge, Lambda, QuickSight (optional).",
            recommended: false,
            capabilities: {
                object_storage: {
                    impl: "aws.s3",
                    scope: ["data:lake", "api:uploads"]
                },
                compute: {
                    impl: "aws.lambda",
                    scope: ["etl:jobs"],
                    config: { runtime: "python3.11", arch: "arm64" }
                },
                events: {
                    impl: "aws.eventbridge",
                    scope: ["etl:workflows"]
                },
                analytics: {
                    impl: "aws.glue+athena",
                    scope: ["data:processing"]
                },
                visualization: {
                    impl: "aws.quicksight",
                    scope: ["data:insights"],
                    optional: true
                }
            }
        },
        {
            id: "custom",
            name: "Custom Capabilities",
            description: "Build your own tech stack by selecting individual capabilities.",
            recommended: false,
            capabilities: {}
        }
    ];

    const [settings, setSettings] = useState<SettingsData>({
        apiKeys: {},
        aws: {
            crossAccountRoleArn: 'arn:aws:iam::[YOUR_ACCOUNT_ID]:role/VishCoder-TerraformExecutionRole'
        },
        github: {},
        techStack: {
            stack: {
                frontend: "react",
                css: "tailwind",
                api: "fastapi",
                language: "python",
                cloud: "aws"
            },
            selectedBundle: "serverless-starter",
            capabilities: {
                authentication: {
                    impl: "aws.cognito",
                    scope: ["global:web", "global:api"],
                    config: {
                        userpool: true,
                        hosted_ui: true
                    }
                },
                oltp: {
                    impl: "aws.dynamodb",
                    scope: ["global:api"],
                    config: {
                        billing: "PAY_PER_REQUEST",
                        single_table: true
                    }
                },
                api_ingress: {
                    impl: "aws.apigateway.http",
                    scope: ["global:api"]
                },
                compute: {
                    impl: "aws.lambda",
                    scope: ["api:/v1/*", "jobs:*"],
                    config: {
                        runtime: "python3.11",
                        arch: "arm64"
                    }
                },
                object_storage: {
                    impl: "aws.s3",
                    scope: ["web:assets", "api:uploads"]
                },
                cdn: {
                    impl: "aws.cloudfront",
                    scope: ["web:*"]
                },
                messaging: {
                    impl: "aws.sqs",
                    scope: ["workers:*"],
                    optional: true
                },
                events: {
                    impl: "aws.eventbridge",
                    scope: ["global:*"]
                },
                observability: {
                    impl: "aws.cloudwatch+xray",
                    scope: ["global:*"]
                },
                secrets: {
                    impl: "aws.secretsmanager+ssm",
                    scope: ["global:*"]
                },
                email: {
                    impl: "aws.ses",
                    scope: ["api:*"],
                    optional: true
                }
            }
        }
    });
    const [isSaving, setIsSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
    const [showOnboardingGuide, setShowOnboardingGuide] = useState(false);
    const [activeTab, setActiveTab] = useState<'tech-stack' | 'settings'>('tech-stack');
    const [editingCapability, setEditingCapability] = useState<string | null>(null);

    // Load settings from localStorage on mount
    useEffect(() => {
        const savedSettings = localStorage.getItem('appSettings');
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                // Merge with default cross account role ARN if not present
                setSettings({
                    ...parsed,
                    aws: {
                        ...parsed.aws,
                        crossAccountRoleArn: parsed.aws?.crossAccountRoleArn || 'arn:aws:iam::[YOUR_ACCOUNT_ID]:role/VishCoder-TerraformExecutionRole'
                    },
                    techStack: {
                        ...settings.techStack, // Keep defaults
                        ...parsed.techStack // Override with saved values
                    }
                });
            } catch (error) {
                console.error('Failed to load settings:', error);
            }
        }
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Save to localStorage
            localStorage.setItem('appSettings', JSON.stringify(settings));
            setSaveMessage('Settings saved successfully!');
            
            // Clear message after 3 seconds
            setTimeout(() => {
                setSaveMessage(null);
            }, 3000);
        } catch (error) {
            setSaveMessage('Failed to save settings');
            console.error('Save error:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const testGitHubConnection = async () => {
        setIsTestingConnection(true);
        setConnectionStatus(null);
        
        try {
            // Save settings first to ensure token is available
            localStorage.setItem('appSettings', JSON.stringify(settings));
            console.log('Saved settings with token:', settings.github.token ? 'Token present' : 'No token');
            
            const result = await GitHubService.testConnection();
            
            if (result.authenticated) {
                setConnectionStatus(`✅ Connected! Rate limit: ${result.remaining}/${result.rateLimit} remaining`);
            } else {
                setConnectionStatus(`⚠️ Connected (unauthenticated). Rate limit: ${result.remaining}/${result.rateLimit} remaining`);
            }
        } catch (error) {
            setConnectionStatus(`❌ Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsTestingConnection(false);
        }
    };

    const updateApiKey = (provider: string, value: string) => {
        setSettings(prev => ({
            ...prev,
            apiKeys: {
                ...prev.apiKeys,
                [provider]: value
            }
        }));
    };

    const updateAwsField = (field: string, value: string) => {
        setSettings(prev => ({
            ...prev,
            aws: {
                ...prev.aws,
                [field]: value
            }
        }));
    };

    const updateGitHubField = (field: string, value: string) => {
        setSettings(prev => ({
            ...prev,
            github: {
                ...prev.github,
                [field]: value
            }
        }));
    };

    const updateTechStackField = (section: 'stack' | 'capabilities', field: string, value: any) => {
        setSettings(prev => ({
            ...prev,
            techStack: {
                ...prev.techStack,
                [section]: {
                    ...prev.techStack[section],
                    [field]: value
                }
            }
        }));
    };

    const updateTechStackCapability = (capability: string, field: string, value: any) => {
        setSettings(prev => ({
            ...prev,
            techStack: {
                ...prev.techStack,
                capabilities: {
                    ...prev.techStack.capabilities,
                    [capability]: {
                        ...prev.techStack.capabilities[capability as keyof typeof prev.techStack.capabilities],
                        [field]: value
                    }
                }
            }
        }));
    };

    const selectTechBundle = (bundleId: string) => {
        const selectedBundle = techBundles.find(bundle => bundle.id === bundleId);
        if (selectedBundle && bundleId !== 'custom') {
            setSettings(prev => ({
                ...prev,
                techStack: {
                    ...prev.techStack,
                    selectedBundle: bundleId,
                    capabilities: {
                        ...prev.techStack.capabilities,
                        ...selectedBundle.capabilities
                    }
                }
            }));
        } else if (bundleId === 'custom') {
            setSettings(prev => ({
                ...prev,
                techStack: {
                    ...prev.techStack,
                    selectedBundle: bundleId
                }
            }));
        }
    };

    const validateAccountId = (accountId: string) => {
        return /^\d{12}$/.test(accountId);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-[#0A071B] border border-white/20 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/10">
                        <h2 className="text-xl font-semibold text-white flex items-center">
                            <svg className="w-6 h-6 mr-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Settings
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-white/50 hover:text-white/80 transition-colors p-1"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex border-b border-white/10">
                        <button
                            onClick={() => setActiveTab('tech-stack')}
                            className={`flex-1 px-6 py-4 text-sm font-medium transition-all duration-300 ${
                                activeTab === 'tech-stack'
                                    ? 'text-white border-b-2 border-purple-400 bg-white/5'
                                    : 'text-white/60 hover:text-white/80 hover:bg-white/5'
                            }`}
                        >
                            <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            Tech Stack
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`flex-1 px-6 py-4 text-sm font-medium transition-all duration-300 ${
                                activeTab === 'settings'
                                    ? 'text-white border-b-2 border-purple-400 bg-white/5'
                                    : 'text-white/60 hover:text-white/80 hover:bg-white/5'
                            }`}
                        >
                            <svg className="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Settings
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-8">
                        {/* Tech Stack Tab */}
                        {activeTab === 'tech-stack' && (
                            <>
                                {/* Tech Stack Section */}
                                <div className="space-y-6">
                                    <h3 className="text-lg font-medium text-white flex items-center">
                                        <svg className="w-5 h-5 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                        </svg>
                                        Tech Stack Configuration
                                    </h3>
                                    
                                    {/* Basic Stack */}
                                    <div className="space-y-4">
                                        <h4 className="text-md font-medium text-white/90 border-b border-white/10 pb-2">
                                            Basic
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-white/80">
                                                    Frontend
                                                </label>
                                                <select
                                                    value={settings.techStack.stack.frontend}
                                                    onChange={(e) => updateTechStackField('stack', 'frontend', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300"
                                                >
                                                    <option value="react" className="bg-gray-800">React 18</option>
                                                    <option value="vue" className="bg-gray-800">Vue 3</option>
                                                    <option value="angular" className="bg-gray-800">Angular 17</option>
                                                    <option value="svelte" className="bg-gray-800">Svelte 5</option>
                                                    <option value="nextjs" className="bg-gray-800">Next.js 14</option>
                                                    <option value="nuxt" className="bg-gray-800">Nuxt 3</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-white/80">
                                                    CSS Framework
                                                </label>
                                                <select
                                                    value={settings.techStack.stack.css}
                                                    onChange={(e) => updateTechStackField('stack', 'css', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300"
                                                >
                                                    <option value="tailwind" className="bg-gray-800">Tailwind CSS 3.4</option>
                                                    <option value="css-modules" className="bg-gray-800">CSS Modules</option>
                                                    <option value="styled-components" className="bg-gray-800">Styled Components</option>
                                                    <option value="emotion" className="bg-gray-800">Emotion</option>
                                                    <option value="bootstrap" className="bg-gray-800">Bootstrap 5</option>
                                                    <option value="bulma" className="bg-gray-800">Bulma</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-white/80">
                                                    API Framework
                                                </label>
                                                <select
                                                    value={settings.techStack.stack.api}
                                                    onChange={(e) => updateTechStackField('stack', 'api', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300"
                                                >
                                                    <option value="fastapi" className="bg-gray-800">FastAPI 0.104</option>
                                                    <option value="express" className="bg-gray-800">Express.js 4.18</option>
                                                    <option value="nestjs" className="bg-gray-800">NestJS 10</option>
                                                    <option value="django" className="bg-gray-800">Django 4.2</option>
                                                    <option value="flask" className="bg-gray-800">Flask 3.0</option>
                                                    <option value="spring" className="bg-gray-800">Spring Boot 3.2</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="block text-sm font-medium text-white/80">
                                                    Language
                                                </label>
                                                <select
                                                    value={settings.techStack.stack.language}
                                                    onChange={(e) => updateTechStackField('stack', 'language', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300"
                                                >
                                                    <option value="python" className="bg-gray-800">Python 3.12</option>
                                                    <option value="typescript" className="bg-gray-800">TypeScript 5.3</option>
                                                    <option value="javascript" className="bg-gray-800">JavaScript ES2023</option>
                                                    <option value="java" className="bg-gray-800">Java 21</option>
                                                    <option value="go" className="bg-gray-800">Go 1.21</option>
                                                    <option value="rust" className="bg-gray-800">Rust 1.75</option>
                                                </select>
                                            </div>
                                            <div className="space-y-2 col-span-2">
                                                <label className="block text-sm font-medium text-white/80">
                                                    Cloud Provider
                                                </label>
                                                <select
                                                    value={settings.techStack.stack.cloud}
                                                    onChange={(e) => updateTechStackField('stack', 'cloud', e.target.value)}
                                                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300"
                                                >
                                                    <option value="aws" className="bg-gray-800">AWS</option>
                                                    <option value="azure" className="bg-gray-800">Microsoft Azure</option>
                                                    <option value="gcp" className="bg-gray-800">Google Cloud Platform</option>
                                                    <option value="digitalocean" className="bg-gray-800">DigitalOcean</option>
                                                    <option value="heroku" className="bg-gray-800">Heroku</option>
                                                    <option value="vercel" className="bg-gray-800">Vercel</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tech Bundles - Only show when AWS is selected */}
                                    {settings.techStack.stack.cloud === 'aws' && (
                                        <div className="space-y-4">
                                            <h4 className="text-md font-medium text-white/90 border-b border-white/10 pb-2">
                                                Tech Bundles
                                            </h4>
                                            <div className="space-y-3">
                                                {techBundles.map((bundle) => (
                                                    <div
                                                        key={bundle.id}
                                                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-300 ${
                                                            settings.techStack.selectedBundle === bundle.id
                                                                ? 'border-purple-400 bg-purple-500/10'
                                                                : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/10'
                                                        }`}
                                                        onClick={() => selectTechBundle(bundle.id)}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-3">
                                                                <div className={`w-4 h-4 rounded-full border-2 ${
                                                                    settings.techStack.selectedBundle === bundle.id
                                                                        ? 'border-purple-400 bg-purple-400'
                                                                        : 'border-white/40'
                                                                }`}>
                                                                    {settings.techStack.selectedBundle === bundle.id && (
                                                                        <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <h5 className="text-sm font-medium text-white/90">
                                                                        {bundle.name}
                                                                    </h5>
                                                                    {bundle.recommended && (
                                                                        <span className="text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded-full">
                                                                            Recommended
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Capabilities - Only show when Custom Capabilities is selected */}
                                    {settings.techStack.selectedBundle === 'custom' && (
                                        <div className="space-y-4">
                                            <h4 className="text-md font-medium text-white/90 border-b border-white/10 pb-2">
                                                Custom Capabilities
                                            </h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                {Object.entries(settings.techStack.capabilities).map(([key, capability]) => {
                                                    const cap = capability as any;
                                                    return (
                                                        <div
                                                            key={key}
                                                            className="bg-white/5 rounded-lg p-4 space-y-3 cursor-pointer hover:bg-white/10 transition-all duration-300 border border-white/20 hover:border-white/40"
                                                            onClick={() => setEditingCapability(key)}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <h5 className="text-sm font-medium text-white/90 capitalize">
                                                                    {key.replace('_', ' ')}
                                                                </h5>
                                                                {cap.optional && (
                                                                    <span className="text-xs text-yellow-400 bg-yellow-500/20 px-2 py-1 rounded">
                                                                        Optional
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-white/60">
                                                                {cap.impl}
                                                            </div>
                                                            <div className="text-xs text-white/50">
                                                                Scope: {cap.scope?.join(', ') || 'Not configured'}
                                                            </div>
                                                            <div className="text-xs text-purple-300">
                                                                Click to edit →
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Bundle Summary - Show when a bundle is selected */}
                                    {settings.techStack.selectedBundle !== 'custom' && settings.techStack.stack.cloud === 'aws' && (
                                        <div className="space-y-4">
                                            <h4 className="text-md font-medium text-white/90 border-b border-white/10 pb-2">
                                                Selected Bundle: {techBundles.find(b => b.id === settings.techStack.selectedBundle)?.name}
                                            </h4>
                                            <div className="bg-purple-500/10 border border-purple-400/30 rounded-lg p-4">
                                                <p className="text-sm text-white/80 mb-3">
                                                    {techBundles.find(b => b.id === settings.techStack.selectedBundle)?.description}
                                                </p>
                                                <button
                                                    onClick={() => selectTechBundle('custom')}
                                                    className="text-sm text-purple-300 hover:text-purple-200 underline transition-colors"
                                                >
                                                    Want to customize? Switch to Custom Capabilities
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Settings Tab */}
                        {activeTab === 'settings' && (
                            <>
                                {/* API Keys Section - Disabled for now */}
                                {/* <div className="space-y-4">
                                    <h3 className="text-lg font-medium text-white flex items-center">
                                        <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-3.586l4.293-4.293A6 6 0 0119 9z" />
                                        </svg>
                                        API Keys
                                    </h3>
                                    
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/90">
                                                OpenAI API Key
                                            </label>
                                            <input
                                                type="password"
                                                value={settings.apiKeys.openai || ''}
                                                onChange={(e) => updateApiKey('openai', e.target.value)}
                                                placeholder="sk-..."
                                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/90">
                                                Anthropic API Key
                                            </label>
                                            <input
                                                type="password"
                                                value={settings.apiKeys.anthropic || ''}
                                                onChange={(e) => updateApiKey('anthropic', e.target.value)}
                                                placeholder="sk-ant-..."
                                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/90">
                                                Google API Key
                                            </label>
                                            <input
                                                type="password"
                                                value={settings.apiKeys.google || ''}
                                                onChange={(e) => updateApiKey('google', e.target.value)}
                                                placeholder="AIza..."
                                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                            />
                                        </div>
                                    </div>
                                </div> */}

                                {/* AWS Account Section */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium text-white flex items-center">
                                        <svg className="w-5 h-5 mr-2 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                        </svg>
                                        AWS Account
                                    </h3>
                                    
                                    <div className="space-y-4">
                                        {/* AWS Account ID */}
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/90">
                                                Account ID
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.aws.accountId || ''}
                                                onChange={(e) => updateAwsField('accountId', e.target.value)}
                                                placeholder="123456789012"
                                                className={`w-full px-4 py-3 bg-white/10 border rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm ${
                                                    settings.aws.accountId && !validateAccountId(settings.aws.accountId) 
                                                        ? 'border-red-400/50' 
                                                        : 'border-white/20'
                                                }`}
                                            />
                                            {settings.aws.accountId && !validateAccountId(settings.aws.accountId) && (
                                                <p className="text-xs text-red-400">
                                                    Account ID must be exactly 12 digits
                                                </p>
                                            )}
                                        </div>

                                        {/* Cross Account Role ARN */}
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/90">
                                                Cross Account Role ARN
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.aws.crossAccountRoleArn || ''}
                                                onChange={(e) => updateAwsField('crossAccountRoleArn', e.target.value)}
                                                placeholder="arn:aws:iam::123456789012:role/VishCoder-TerraformExecutionRole"
                                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                            />
                                            <button
                                                onClick={() => setShowOnboardingGuide(true)}
                                                className="text-sm text-blue-400 hover:text-blue-300 underline transition-colors"
                                            >
                                                Onboarding Guide
                                            </button>
                                        </div>

                                        {/* AWS Region */}
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/90">
                                                Region
                                            </label>
                                            <select
                                                value={settings.aws.region || ''}
                                                onChange={(e) => updateAwsField('region', e.target.value)}
                                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                            >
                                                <option value="" className="bg-gray-800">Select a region...</option>
                                                <option value="us-east-1" className="bg-gray-800">US East (N. Virginia)</option>
                                                <option value="us-east-2" className="bg-gray-800">US East (Ohio)</option>
                                                <option value="us-west-1" className="bg-gray-800">US West (N. California)</option>
                                                <option value="us-west-2" className="bg-gray-800">US West (Oregon)</option>
                                                <option value="eu-west-1" className="bg-gray-800">Europe (Ireland)</option>
                                                <option value="eu-west-2" className="bg-gray-800">Europe (London)</option>
                                                <option value="eu-central-1" className="bg-gray-800">Europe (Frankfurt)</option>
                                                <option value="ap-southeast-1" className="bg-gray-800">Asia Pacific (Singapore)</option>
                                                <option value="ap-southeast-2" className="bg-gray-800">Asia Pacific (Sydney)</option>
                                                <option value="ap-northeast-1" className="bg-gray-800">Asia Pacific (Tokyo)</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* GitHub Repository Section */}
                                <div className="space-y-4">
                                    <h3 className="text-lg font-medium text-white flex items-center">
                                        <svg className="w-5 h-5 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                                        </svg>
                                        GitHub Repository
                                    </h3>
                                    
                                    <div className="space-y-4">
                                        {/* GitHub Repository Path */}
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/90">
                                                Repository Path
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.github.repo || ''}
                                                onChange={(e) => updateGitHubField('repo', e.target.value)}
                                                placeholder="owner/repository"
                                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                            />
                                        </div>

                                        {/* GitHub Branch */}
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/90">
                                                Branch
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.github.branch || ''}
                                                onChange={(e) => updateGitHubField('branch', e.target.value)}
                                                placeholder="main"
                                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                            />
                                        </div>

                                        {/* GitHub Token */}
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/90">
                                                GitHub Token
                                            </label>
                                            <input
                                                type="password"
                                                value={settings.github.token || ''}
                                                onChange={(e) => updateGitHubField('token', e.target.value)}
                                                placeholder="ghp_..."
                                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                            />
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={testGitHubConnection}
                                                    disabled={isTestingConnection}
                                                    className={`
                                                        px-4 py-2 text-xs font-medium rounded-lg transition-all duration-300
                                                        ${isTestingConnection
                                                            ? 'bg-white/10 text-gray-400 cursor-not-allowed'
                                                            : 'bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-400/30'
                                                        }
                                                    `}
                                                >
                                                    {isTestingConnection ? (
                                                        <>
                                                            <svg className="animate-spin -ml-1 mr-1 h-3 w-3 inline" fill="none" viewBox="0 0 24 24">
                                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                            </svg>
                                                            Testing...
                                                        </>
                                                    ) : (
                                                        'Test Connection'
                                                    )}
                                                </button>
                                                {connectionStatus && (
                                                    <span className="text-xs text-gray-300">
                                                        {connectionStatus}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400">
                                                Optional: Add a GitHub Personal Access Token for higher rate limits and private repository access.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Save Message */}
                        {saveMessage && (
                            <div className={`p-4 rounded-xl backdrop-blur-sm ${
                                saveMessage.includes('success') 
                                    ? 'bg-green-500/10 border border-green-400/30' 
                                    : 'bg-red-500/10 border border-red-400/30'
                            }`}>
                                <p className={`text-sm flex items-center ${
                                    saveMessage.includes('success') ? 'text-green-300' : 'text-red-300'
                                }`}>
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        {saveMessage.includes('success') ? (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        ) : (
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        )}
                                    </svg>
                                    {saveMessage}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end space-x-4 p-6 border-t border-white/10">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 text-sm font-medium text-white/70 hover:text-white border border-white/20 rounded-lg hover:bg-white/5 transition-all duration-300"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className={`
                                px-6 py-2 text-sm font-semibold rounded-lg transition-all duration-300
                                ${isSaving
                                    ? 'bg-white/10 text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white shadow-lg hover:shadow-purple-500/25'
                                }
                            `}
                        >
                            {isSaving ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 inline" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Saving...
                                </>
                            ) : (
                                'Save Settings'
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Onboarding Guide Popup */}
            {showOnboardingGuide && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-[#0A071B] border border-white/20 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <h2 className="text-xl font-semibold text-white flex items-center">
                                <svg className="w-6 h-6 mr-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Onboarding Guide: Creating a Cross-Account Role for VishMaker Deployment
                            </h2>
                            <button
                                onClick={() => setShowOnboardingGuide(false)}
                                className="text-white/50 hover:text-white/80 transition-colors p-1"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6 text-white/90">
                            <div className="space-y-4">
                                <p className="text-lg leading-relaxed">
                                    Welcome! To allow the VishMaker deployment system to create the necessary application infrastructure in your AWS account, you need to create a secure IAM role. This role will grant our deployment user permission to act on your behalf.
                                </p>
                                <p className="text-lg leading-relaxed">
                                    This process should take about 5 minutes. Please follow these steps carefully.
                                </p>
                            </div>

                            <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-4">
                                <h3 className="text-lg font-semibold text-blue-300 mb-2">Prerequisite:</h3>
                                <p className="text-blue-200">
                                    You will need the 12-digit AWS Account ID of the source account that will be performing the deployment.
                                </p>
                                <div className="mt-3 p-3 bg-blue-500/20 rounded-lg">
                                    <p className="text-sm text-blue-200 mb-1">Source Account ID:</p>
                                    <p className="text-lg font-mono text-blue-100">489270312286</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-3">
                                    <h3 className="text-lg font-semibold text-white flex items-center">
                                        <span className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">1</span>
                                        Navigate to the IAM Role Creation Page
                                    </h3>
                                    <div className="ml-9 space-y-2 text-white/80">
                                        <p>• Log in to your AWS Management Console.</p>
                                        <p>• In the main search bar at the top, type <code className="bg-white/10 px-2 py-1 rounded text-purple-300">IAM</code> and press Enter. Click on the IAM service.</p>
                                        <p>• In the left-hand navigation pane, click on <strong>Roles</strong>.</p>
                                        <p>• Click the Noassume <strong>Create role</strong> button in the top right.</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-lg font-semibold text-white flex items-center">
                                        <span className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">2</span>
                                        Select the Trusted Entity
                                    </h3>
                                    <div className="ml-9 space-y-2 text-white/80">
                                        <p>This step tells the new role who to trust.</p>
                                        <p>• For "Trusted entity type," select <strong>AWS account</strong>.</p>
                                        <p>• Below that, select the radio button for <strong>"Another AWS account"</strong>.</p>
                                        <p>• In the "Account ID" text box, carefully enter the 12-digit Source Account ID provided above:</p>
                                        <div className="bg-purple-500/20 border border-purple-400/30 rounded-lg p-3 my-2">
                                            <p className="font-mono text-purple-200 text-center">489270312286</p>
                                        </div>
                                        <p>• Click the <strong>Next</strong> button.</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-lg font-semibold text-white flex items-center">
                                        <span className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">3</span>
                                        Add Permissions to the Role
                                    </h3>
                                    <div className="ml-9 space-y-2 text-white/80">
                                        <p>This step defines what the trusted account is allowed to do. For the initial setup, we will grant administrative access to allow Terraform to build the application stack.</p>
                                        <p>• On the "Add permissions" page, you will see a list of policies.</p>
                                        <p>• In the search bar, type <code className="bg-white/10 px-2 py-1 rounded text-purple-300">AdministratorAccess</code>.</p>
                                        <p>• A policy named <strong>AdministratorAccess</strong> will appear. Click the checkbox to the left of its name to select it.</p>
                                        <p>• Click the <strong>Next</strong> button.</p>
                                        <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-lg p-3 my-2">
                                            <p className="text-sm text-yellow-200">
                                                <strong>Security Note:</strong> This policy grants broad permissions necessary for the initial infrastructure setup. For long-term production use, we can work with you to create a more restrictive policy that follows the principle of least privilege.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-lg font-semibold text-white flex items-center">
                                        <span className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">4</span>
                                        Name the Role and Finalize Creation
                                    </h3>
                                    <div className="ml-9 space-y-2 text-white/80">
                                        <p>This is the final step where you will name the role and review your settings.</p>
                                        <p>• In the "Role name" box, enter a descriptive name. Please use the following name for consistency:</p>
                                        <div className="bg-green-500/20 border border-green-400/30 rounded-lg p-3 my-2">
                                            <p className="font-mono text-green-200 text-center">VishCoder-TerraformExecutionRole</p>
                                        </div>
                                        <p>• (Optional) You can add a description, for example: <em>Allows the VishMaker source account to deploy and manage application infrastructure.</em></p>
                                        <p>• Scroll down and review the configuration.</p>
                                        <p>• Ensure the "Trusted entities" shows the correct Source Account ID (489270312286).</p>
                                        <p>• Ensure the AdministratorAccess policy is listed under "Permissions policies."</p>
                                        <p>• Click the blue <strong>Create role</strong> button at the bottom of the page.</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-lg font-semibold text-white flex items-center">
                                        <span className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold mr-3">5</span>
                                        Provide the Role ARN
                                    </h3>
                                    <div className="ml-9 space-y-2 text-white/80">
                                        <p>You have successfully created the role! The final step is to provide us with its unique identifier so our deployment system can use it.</p>
                                        <p>• After creation, you will be taken back to the main "Roles" list.</p>
                                        <p>• Use the search bar to find the role you just created: <strong>VishCoder-TerraformExecutionRole</strong>.</p>
                                        <p>• Click on the role name to go to its summary page.</p>
                                        <p>• At the top of the summary page, you will see the ARN (Amazon Resource Name). There is a small "copy" icon right next to it. Click this icon to copy the full ARN to your clipboard.</p>
                                        <p>• The ARN will look like this:</p>
                                        <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-3 my-2">
                                            <p className="font-mono text-blue-200 text-center">arn:aws:iam::[YOUR_ACCOUNT_ID]:role/VishCoder-TerraformExecutionRole</p>
                                        </div>
                                        <p>• Please send this full ARN back to us.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end p-6 border-t border-white/10">
                            <button
                                onClick={() => setShowOnboardingGuide(false)}
                                className="px-6 py-2 text-sm font-medium text-white/70 hover:text-white border border-white/20 rounded-lg hover:bg-white/5 transition-all duration-300"
                            >
                                Close Guide
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Capability Editing Modal */}
            {editingCapability && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#0A071B] border border-white/20 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-white/10">
                            <h2 className="text-xl font-semibold text-white flex items-center">
                                <svg className="w-6 h-6 mr-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit {editingCapability.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </h2>
                            <button
                                onClick={() => setEditingCapability(null)}
                                className="text-white/50 hover:text-white/80 transition-colors p-1"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                            {editingCapability === 'authentication' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/80">Implementation</label>
                                            <input
                                                type="text"
                                                value={settings.techStack.capabilities.authentication.impl}
                                                onChange={(e) => updateTechStackCapability('authentication', 'impl', e.target.value)}
                                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/80">Scope</label>
                                            <input
                                                type="text"
                                                value={settings.techStack.capabilities.authentication.scope.join(', ')}
                                                onChange={(e) => updateTechStackCapability('authentication', 'scope', e.target.value.split(', '))}
                                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <label className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={settings.techStack.capabilities.authentication.config.userpool}
                                                onChange={(e) => updateTechStackCapability('authentication', 'config', {
                                                    ...settings.techStack.capabilities.authentication.config,
                                                    userpool: e.target.checked
                                                })}
                                                className="rounded border-white/20 bg-white/10 text-purple-500 focus:ring-purple-500/50"
                                            />
                                            <span className="text-sm text-white/70">User Pool</span>
                                        </label>
                                        <label className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={settings.techStack.capabilities.authentication.config.hosted_ui}
                                                onChange={(e) => updateTechStackCapability('authentication', 'config', {
                                                    ...settings.techStack.capabilities.authentication.config,
                                                    hosted_ui: e.target.checked
                                                })}
                                                className="rounded border-white/20 bg-white/10 text-purple-500 focus:ring-purple-500/50"
                                            />
                                            <span className="text-sm text-white/70">Hosted UI</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {editingCapability === 'oltp' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/80">Implementation</label>
                                            <input
                                                type="text"
                                                value={settings.techStack.capabilities.oltp.impl}
                                                onChange={(e) => updateTechStackCapability('oltp', 'impl', e.target.value)}
                                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/80">Billing</label>
                                            <select
                                                value={settings.techStack.capabilities.oltp.config.billing}
                                                onChange={(e) => updateTechStackCapability('oltp', 'config', {
                                                    ...settings.techStack.capabilities.oltp.config,
                                                    billing: e.target.value
                                                })}
                                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500/50"
                                            >
                                                <option value="PAY_PER_REQUEST" className="bg-gray-800">Pay Per Request</option>
                                                <option value="PROVISIONED" className="bg-gray-800">Provisioned</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <label className="flex items-center space-x-2">
                                            <input
                                                type="checkbox"
                                                checked={settings.techStack.capabilities.oltp.config.single_table}
                                                onChange={(e) => updateTechStackCapability('oltp', 'config', {
                                                    ...settings.techStack.capabilities.oltp.config,
                                                    single_table: e.target.checked
                                                })}
                                                className="rounded border-white/20 bg-white/10 text-green-500 focus:ring-green-500/50"
                                            />
                                            <span className="text-sm text-white/70">Single Table Design</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {editingCapability === 'compute' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/80">Runtime</label>
                                            <select
                                                value={settings.techStack.capabilities.compute.config.runtime}
                                                onChange={(e) => updateTechStackCapability('compute', 'config', {
                                                    ...settings.techStack.capabilities.compute.config,
                                                    runtime: e.target.value
                                                })}
                                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                            >
                                                <option value="python3.9" className="bg-gray-800">Python 3.9</option>
                                                <option value="python3.10" className="bg-gray-800">Python 3.10</option>
                                                <option value="python3.11" className="bg-gray-800">Python 3.11</option>
                                                <option value="python3.12" className="bg-gray-800">Python 3.12</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/80">Architecture</label>
                                            <select
                                                value={settings.techStack.capabilities.compute.config.arch}
                                                onChange={(e) => updateTechStackCapability('compute', 'config', {
                                                    ...settings.techStack.capabilities.compute.config,
                                                    arch: e.target.value
                                                })}
                                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                            >
                                                <option value="x86_64" className="bg-gray-800">x86_64</option>
                                                <option value="arm64" className="bg-gray-800">ARM64</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Generic capability editor for other capabilities */}
                            {!['authentication', 'oltp', 'compute'].includes(editingCapability) && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/80">Implementation</label>
                                            <input
                                                type="text"
                                                value={(settings.techStack.capabilities as any)[editingCapability]?.impl || ''}
                                                onChange={(e) => updateTechStackCapability(editingCapability, 'impl', e.target.value)}
                                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="block text-sm font-medium text-white/80">Scope</label>
                                            <input
                                                type="text"
                                                value={(settings.techStack.capabilities as any)[editingCapability]?.scope?.join(', ') || ''}
                                                onChange={(e) => updateTechStackCapability(editingCapability, 'scope', e.target.value.split(', '))}
                                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/10">
                                <button
                                    onClick={() => setEditingCapability(null)}
                                    className="px-4 py-2 text-sm font-medium text-white/70 hover:text-white border border-white/20 rounded-lg hover:bg-white/5 transition-all duration-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => setEditingCapability(null)}
                                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-all duration-300"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Settings; 