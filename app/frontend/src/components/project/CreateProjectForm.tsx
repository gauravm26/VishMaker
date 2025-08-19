// app-ui/src/components/project/CreateProjectForm.tsx
import React, { useState, useEffect } from 'react';
import apiClient from '../../utils/apiClient';
import { ProjectCreatePayload, Project } from '../../types/project';
import LlmService, { LlmResponse } from '../../utils/llmService';
import { useAuth } from '../../contexts/AuthContext';

interface CreateProjectFormProps {
    onProjectCreated: (projectId?: number, projectName?: string) => void;
    shouldExpand?: boolean;
    onExpandChange?: (expanded: boolean) => void;
}

const CreateProjectForm: React.FC<CreateProjectFormProps> = ({ 
    onProjectCreated, 
    shouldExpand = false,
    onExpandChange 
}) => {
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [prompt, setPrompt] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isLlmProcessing, setIsLlmProcessing] = useState<boolean>(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [progressUpdate, setProgressUpdate] = useState<string | null>(null);
    const [isExpanded, setIsExpanded] = useState<boolean>(shouldExpand); // Use prop as initial value
    
    // Update isExpanded when shouldExpand prop changes
    useEffect(() => {
        if (shouldExpand !== undefined && shouldExpand !== isExpanded) {
            setIsExpanded(shouldExpand);
        }
    }, [shouldExpand, isExpanded]);
    
    // Notify parent when expansion state changes
    const handleExpandedChange = (expanded: boolean) => {
        setIsExpanded(expanded);
        onExpandChange?.(expanded);
        
        // Reset form state when closing
        if (!expanded) {
            setError(null);
            setSuccessMessage(null);
            setProgressUpdate(null);
        }
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        
        // Get the button ID from the form
        const buildButton = document.getElementById('genReqUserFlow');
        if (buildButton) {
            // Call the AI processing directly
            handleBuildClick(buildButton.id, prompt);
        } else {
            console.error("Could not find the 'Let's build it' button");
        }
    };

    // Handle AI refinement of prompt
    const handleAiClick = async (componentId: string, text: string) => {
        if (!componentId) {
            console.error("Component ID is required");
            setError('System error: Component ID is missing.');
            return;
        }

        if (!text.trim()) {
            setError('Please enter some text to process.');
            return;
        }

        setIsLlmProcessing(true);
        setError(null);
        setSuccessMessage(null);
        setProgressUpdate("Starting request...");
        
        try {
            console.log(`Refining prompt with ${componentId}...`);
            // Process the text with the LLM service using the provided component ID
            const response = await LlmService.processWithLlm(
                componentId, 
                text,
                undefined, // No project ID for refinement
                false, // Don't save to database
                (update: string) => {
                    console.log("Progress update received:", update);
                    setProgressUpdate(update);
                }
            );
            
            console.log("Response received:", response);
            
            // Update the prompt with the generated text
            setPrompt(response.result);
            
            // Show success message with model name and instruction ID from the response
            const modelName = response.modelName || response.modelId || 'AI Model';
            setSuccessMessage(`Refined with ${modelName} using ${response.instructionId}`);
            
            // Display the final progress update
            if (response.progressUpdates && response.progressUpdates.length > 0) {
                setProgressUpdate(response.progressUpdates[response.progressUpdates.length - 1]);
            }
            
            // Clear success message after 4 seconds
            setTimeout(() => {
                setSuccessMessage(null);
                setProgressUpdate(null);
            }, 4000);
        } catch (err: any) {
            setError('Failed to process text with AI. Please try again.');
            console.error('LLM processing error:', err);
            setProgressUpdate(null);
        } finally {
            setIsLlmProcessing(false);
        }
    };

    // Handle the "Let's build it" button click (both AI processing and project creation)
    const handleBuildClick = async (componentId: string, text: string) => {
        if (!componentId) {
            console.error("Component ID is required");
            setError('System error: Component ID is missing.');
            return;
        }

        if (!name.trim()) {
            setError('Project name is required.');
            return;
        }

        if (!text.trim()) {
            setError('Initial prompt is required.');
            return;
        }

        // Get client IP address for user ID
        const getClientIP = async () => {
            try {
                const response = await fetch('https://api.ipify.org?format=json');
                const data = await response.json();
                return data.ip;
            } catch (error) {
                console.error('Failed to get IP address:', error);
                return 'unknown-ip';
            }
        };
        
        const clientIP = await getClientIP();
        const userId = `ip-${clientIP}`;
        
        setIsSubmitting(true);
        setError(null);
        
        try {
            // First create the project
            const project = await apiClient<Project>('/projects', {
                method: 'POST',
                body: {
                    name: name.trim(),
                    initial_prompt: text.trim(),
                    user_id: userId, // Use IP address as user ID
                } as ProjectCreatePayload,
            });

            // Process with LLM
            try {
                console.log(`Processing with ${componentId}... for project ID: ${project.id}`);
                const response = await LlmService.processWithLlm(
                    componentId, 
                    text,
                    project.id, // Pass project ID to the LLM service
                    true, // Save to database
                    (update: string) => {
                        console.log("Progress update received:", update);
                        setProgressUpdate(update);
                    }
                );
                
                console.log("LLM Response received:", response);
                
                // Process user flow result
                setProgressUpdate("User flow generated.");
                
                // The LLM controller now handles saving the user flow directly
                // So we don't need to make a separate call to save the flow
                setProgressUpdate("User flow saved successfully!");
                
                // Reset form and notify parent
                setTimeout(() => {
                    setName('');
                    setPrompt('');
                    setProgressUpdate(null);
                    setIsExpanded(false); // Collapse after success
                    onProjectCreated(project.id, name.trim()); // Pass project ID and name back to parent
                }, 2000);
                
            } catch (llmErr: any) {
                console.error('Error generating user flow:', llmErr);
                setError('Created project but failed to generate user flow. Please try again from the project page.');
                // Still consider the operation partially successful since project was created
                setTimeout(() => {
                    setName('');
                    setPrompt('');
                    setProgressUpdate(null);
                    onProjectCreated(project.id, name.trim()); // Pass project ID and name even if LLM failed
                }, 3000);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create project.');
            console.error(err);
            setProgressUpdate(null);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="w-full">
            {!isExpanded ? (
                // Collapsed state - just a line with +
                <div 
                    onClick={() => handleExpandedChange(true)}
                    className="flex items-center justify-center py-4 px-6 bg-white/10 border border-white/20 rounded-xl cursor-pointer hover:bg-white/15 transition-all duration-300 backdrop-blur-sm group"
                >
                    <div className="flex items-center space-x-3 text-white/70 group-hover:text-white">
                        <svg 
                            className="w-5 h-5 text-purple-400" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-sm font-medium">Create new Project</span>
                    </div>
                </div>
            ) : (
                // Expanded state - full form
                <div className="space-y-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Project Name Field */}
                        <div className="space-y-2">
                            <label htmlFor="projectName" className="block text-sm font-medium text-white">
                                Project Name <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                id="projectName"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                placeholder="Enter project name"
                                disabled={isSubmitting || isLlmProcessing}
                            />
                        </div>

                        {/* Initial Prompt Field */}
                        <div className="space-y-2">
                            <label htmlFor="initialPrompt" className="block text-sm font-medium text-white">
                                Initial Prompt <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <textarea
                                    id="initialPrompt"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    rows={window.innerWidth < 640 ? 6 : 8} // Responsive rows
                                    required
                                    className="w-full px-4 py-3 pr-20 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm resize-none"
                                    placeholder="Describe your project idea in detail..."
                                    disabled={isSubmitting || isLlmProcessing}
                                />
                                
                                {/* AI Refine Button */}
                                <button
                                    type="button"
                                    id="gen_initialPrompt"
                                    onClick={(e) => handleAiClick(e.currentTarget.id, prompt)}
                                    disabled={isSubmitting || isLlmProcessing || !prompt.trim()}
                                    className={`
                                        absolute top-3 right-3 px-3 py-1.5 rounded-lg text-xs font-semibold
                                        transition-all duration-300 transform
                                        ${prompt.trim() 
                                            ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white shadow-lg hover:shadow-purple-500/40 hover:scale-110 hover:shadow-2xl hover:rotate-2 active:scale-95' 
                                            : 'bg-purple-300/30 text-purple-200 border border-purple-400/30 cursor-not-allowed'
                                        }
                                        ${isLlmProcessing ? 'animate-bounce scale-105 shadow-purple-500/50' : ''}
                                    `}
                                    title="Refine with AI"
                                >
                                    {isLlmProcessing ? (
                                        <div className="flex items-center space-x-1">
                                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span className="animate-pulse">AI</span>
                                        </div>
                                    ) : (
                                        <span className="flex items-center space-x-1">
                                            <span className="animate-pulse text-yellow-300">✨</span>
                                            <span>Refine with AI</span>
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Status Messages */}
                        {error && (
                            <div className="p-4 bg-red-500/10 border border-red-400/30 rounded-xl backdrop-blur-sm">
                                <p className="text-sm text-red-300 flex items-center">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {error}
                                </p>
                            </div>
                        )}
                        
                        {successMessage && (
                            <div className="p-4 bg-green-500/10 border border-green-400/30 rounded-xl backdrop-blur-sm">
                                <p className="text-sm text-green-300 flex items-center">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {successMessage}
                                </p>
                            </div>
                        )}
                        


                        {/* Submit Button */}
                        <div className="pt-2">
                            <button
                                id="gen_userflow"
                                type="button"
                                onClick={(e) => handleBuildClick(e.currentTarget.id, prompt)}
                                disabled={isSubmitting || isLlmProcessing || !name.trim() || !prompt.trim()}
                                className={`
                                    w-full touch-target
                                    inline-flex justify-center items-center px-6 py-3
                                    text-sm font-semibold rounded-xl
                                    transition-all duration-300
                                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0A071B]
                                    ${(isSubmitting || isLlmProcessing || !name.trim() || !prompt.trim())
                                        ? 'bg-white/10 text-gray-400 border border-white/20 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white focus:ring-purple-500 shadow-lg hover:shadow-purple-500/25 transform hover:scale-[1.02]'
                                    }
                                `}
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Building...
                                    </>
                                ) : isLlmProcessing ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        Let's build it
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default CreateProjectForm; 