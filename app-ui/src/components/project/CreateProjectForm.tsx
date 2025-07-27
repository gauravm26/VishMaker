// app-ui/src/components/project/CreateProjectForm.tsx
import React, { useState } from 'react';
import apiClient from '../../lib/apiClient';
import { ProjectCreatePayload, Project } from '../../types/project';
import LlmService, { LlmResponse } from '../../lib/llmService';

interface CreateProjectFormProps {
    onProjectCreated: () => void; // Callback to trigger refresh in parent
}

const CreateProjectForm: React.FC<CreateProjectFormProps> = ({ onProjectCreated }) => {
    const [name, setName] = useState('');
    const [prompt, setPrompt] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isLlmProcessing, setIsLlmProcessing] = useState<boolean>(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [progressUpdate, setProgressUpdate] = useState<string | null>(null);

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
            
            // Show success message with model ID and instruction ID from the response
            setSuccessMessage(`Refined with ${response.modelId} using ${response.instructionId}`);
            
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

        setIsSubmitting(true);
        setError(null);
        setProgressUpdate("Creating project...");
        
        try {
            // First create the project
            const project = await apiClient<Project>('/projects', {
                method: 'POST',
                body: {
                    name: name.trim(),
                    initial_prompt: text.trim(),
                } as ProjectCreatePayload,
            });

            setProgressUpdate("Project created. Generating user flow...");
            
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
                    onProjectCreated();
                }, 2000);
                
            } catch (llmErr: any) {
                console.error('Error generating user flow:', llmErr);
                setError('Created project but failed to generate user flow. Please try again from the project page.');
                // Still consider the operation partially successful since project was created
                setTimeout(() => {
                    setName('');
                    setPrompt('');
                    setProgressUpdate(null);
                    onProjectCreated();
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
        <div className="card-responsive">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
                Create New Project
            </h2>
            
            <form onSubmit={handleSubmit} className="form-mobile">
                {/* Project Name Field */}
                <div className="form-group">
                    <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Project Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        id="projectName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="form-mobile input"
                        placeholder="Enter project name"
                        disabled={isSubmitting || isLlmProcessing}
                    />
                </div>

                {/* Initial Prompt Field */}
                <div className="form-group">
                    <label htmlFor="initialPrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Initial Prompt <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <textarea
                            id="initialPrompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={window.innerWidth < 640 ? 8 : 12} // Responsive rows
                            required
                            className="form-mobile textarea resize-none"
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
                                absolute top-3 right-3 px-3 py-1.5 rounded-md text-xs font-bold
                                transition-all duration-200 touch-target
                                ${prompt.trim() 
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50' 
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-600 cursor-not-allowed'
                                }
                                ${isLlmProcessing ? 'animate-pulse' : ''}
                            `}
                            title="Refine with AI"
                        >
                            {isLlmProcessing ? '...' : 'AI'}
                        </button>
                    </div>
                </div>

                {/* Status Messages */}
                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}
                
                {successMessage && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                        <p className="text-sm text-green-600 dark:text-green-400">{successMessage}</p>
                    </div>
                )}
                
                {progressUpdate && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
                        <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            {progressUpdate}
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
                            w-full sm:w-auto touch-target
                            inline-flex justify-center items-center px-6 py-3
                            text-sm font-medium rounded-lg
                            transition-all duration-200
                            focus:outline-none focus:ring-2 focus:ring-offset-2
                            ${(isSubmitting || isLlmProcessing || !name.trim() || !prompt.trim())
                                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500 shadow-sm hover:shadow-md'
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
    );
};

export default CreateProjectForm; 