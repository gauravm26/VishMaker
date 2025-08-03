import React, { useState, useEffect } from 'react';
import TerraformArchitectureViewer from '../architecture/TerraformArchitectureViewer';
import GitHubService from '../../lib/githubService';

interface ArchitectureTabProps {
    projectId: number | null;
    refreshTrigger?: number;
}

interface GitHubSettings {
    repo: string;
    branch: string;
}

const ArchitectureTab: React.FC<ArchitectureTabProps> = ({ projectId, refreshTrigger = 0 }) => {
    const [githubSettings, setGitHubSettings] = useState<GitHubSettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showConfigureMessage, setShowConfigureMessage] = useState(false);
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

    const renderConfigureMessage = () => {
        return (
            <div className="h-full w-full flex items-center justify-center p-8">
                <div className="text-center max-w-md mx-auto">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full flex items-center justify-center border border-white/10 backdrop-blur-lg">
                        <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-4">Terraform Architecture Viewer</h3>
                    <p className="text-gray-300 mb-8 leading-relaxed">
                        View infrastructure architecture diagrams from Terraform (.tf) files in your GitHub repository.
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
                                <strong className="text-white">Architecture Diagrams:</strong> Visual representation of infrastructure components
                            </div>
                        </div>
                        
                        <div className="flex items-start space-x-3">
                            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                            <div>
                                <strong className="text-white">Resource Analysis:</strong> Detailed breakdown of AWS, Azure, GCP resources
                            </div>
                        </div>
                        
                        <div className="flex items-start space-x-3">
                            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                            <div>
                                <strong className="text-white">Dependency Mapping:</strong> Shows relationships between infrastructure components
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderError = (errorMessage: string) => {
        const isPrivateRepo = errorMessage.includes('private') || errorMessage.includes('authentication');
        const isRateLimited = errorMessage.includes('rate limit');
        const suggestedRepos = GitHubService.getSuggestedRepositories();

        return (
            <div className="h-full w-full flex items-center justify-center p-8">
                <div className="text-center max-w-md mx-auto">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center border border-red-400/20">
                        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                        {isRateLimited ? 'Rate Limit Exceeded' : isPrivateRepo ? 'Repository Access Error' : 'Repository Error'}
                    </h3>
                    <p className="text-gray-300 mb-4">
                        {errorMessage}
                    </p>
                    
                    {isRateLimited && (
                        <div className="bg-yellow-500/10 border border-yellow-400/30 rounded-xl p-4 mb-6">
                            <p className="text-sm text-yellow-300 mb-3">
                                <strong>Note:</strong> GitHub API rate limit exceeded. This happens with unauthenticated requests. You can:
                            </p>
                            <div className="space-y-2 text-xs text-yellow-200">
                                <div>• Wait a few minutes and try again</div>
                                <div>• Add a GitHub token in Settings for higher limits</div>
                                <div>• Try a different public repository</div>
                            </div>
                        </div>
                    )}
                    
                    {isPrivateRepo && !isRateLimited && (
                        <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-4 mb-6">
                            <p className="text-sm text-blue-300 mb-3">
                                <strong>Note:</strong> Repository access issue. For testing, try a public repository with Terraform files:
                            </p>
                            <div className="space-y-2">
                                {suggestedRepos.slice(0, 3).map((repo, index) => (
                                    <div key={index} className="text-xs text-blue-200">
                                        <code className="bg-white/10 px-2 py-1 rounded">{repo.name}</code>
                                        <span className="text-blue-300 ml-2">- {repo.description}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    <div className="text-sm text-gray-400">
                        Update this in <strong className="text-white">Settings → GitHub Repository</strong>
                    </div>
                </div>
            </div>
        );
    };

    const renderArchitectureViewer = () => {
        if (!githubSettings) return null;
        
        const repoInfo = GitHubService.parseRepoPath(githubSettings.repo);
        if (!repoInfo) {
            return renderError(`Invalid repository format: "${githubSettings.repo}". Please use the format: owner/repository`);
        }

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
                </div>
                <div className="h-full">
                    <TerraformArchitectureViewer
                        owner={repoInfo.owner}
                        repo={repoInfo.repo}
                        branch={githubSettings.branch}
                        refreshTrigger={internalRefreshTrigger}
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

    if (githubSettings) {
        return renderArchitectureViewer();
    }

    // Fallback loading state
    return (
        <div className="h-full w-full flex items-center justify-center p-8">
            <div className="text-center max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full flex items-center justify-center border border-white/10 backdrop-blur-lg">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400"></div>
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Loading Architecture View</h3>
                <p className="text-gray-300">Setting up your architecture environment...</p>
            </div>
        </div>
    );
};

export default ArchitectureTab; 