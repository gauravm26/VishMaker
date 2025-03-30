// features/project_management/ui/components/CreateProjectForm.tsx
import React, { useState } from 'react';
import apiClient from '../../../../app-ui/src/lib/apiClient'; // Adjust path
import { ProjectCreatePayload, Project } from '../../../../app-ui/src/types/project'; // Adjust path
import LlmService, { LlmResponse } from '../../../../app-ui/src/lib/llmService';

interface CreateProjectFormProps {
    onProjectCreated: () => void; // Callback to trigger refresh in parent
}

const CreateProjectForm: React.FC<CreateProjectFormProps> = ({ onProjectCreated }) => {
    const [name, setName] = useState('');
    const [prompt, setPrompt] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLlmProcessing, setIsLlmProcessing] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!name.trim()) {
            setError('Project name is required.');
            return;
        }

        if (!prompt.trim()) {
            setError('Initial prompt is required.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const payload: ProjectCreatePayload = {
            name: name.trim(),
            initial_prompt: prompt.trim(),
        };

        try {
            await apiClient<Project>('/projects', {
                method: 'POST',
                body: payload,
            });
            // Reset form and notify parent
            setName('');
            setPrompt('');
            onProjectCreated();
        } catch (err: any) {
            setError(err.message || 'Failed to create project.');
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAiClick = async (componentId: string, text: string) => {
        if (!text.trim()) {
            setError('Please enter some text in the Initial Prompt field to generate content.');
            return;
        }

        setIsLlmProcessing(true);
        setError(null);
        setSuccessMessage(null);
        
        try {
            // Process the text with the LLM service using the provided component ID
            const response = await LlmService.processWithLlm(componentId, text);
            
            // Update the prompt with the generated text
            setPrompt(response.result);
            
            // Show success message with model ID and instruction ID from the response
            setSuccessMessage(`Refined with ${response.modelId} using ${response.instructionId}`);
            
            // Clear success message after 4 seconds
            setTimeout(() => {
                setSuccessMessage(null);
            }, 4000);
        } catch (err: any) {
            setError('Failed to process text with AI. Please try again.');
            console.error('LLM processing error:', err);
        } finally {
            setIsLlmProcessing(false);
        }
    };

    return (
        <div className="p-4 border rounded shadow-sm bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-4">
            <h2 className="text-xl font-semibold mb-3 dark:text-gray-100">Create New Project</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                    <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Project Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        id="projectName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
                        disabled={isSubmitting || isLlmProcessing}
                    />
                </div>
                <div className="relative">
                    <label htmlFor="initialPrompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Initial Prompt <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <textarea
                            id="initialPrompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={15}
                            required
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-white dark:bg-gray-700 dark:text-gray-100"
                            disabled={isSubmitting || isLlmProcessing}
                        />
                        <button
                            type="button"
                            id="initialPromptButton"
                            onClick={(e) => handleAiClick(e.currentTarget.id, prompt)}
                            disabled={isSubmitting || isLlmProcessing}
                            className="absolute top-2 right-2 p-0.5 px-1.5 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-blue-500"
                            title="Generate with AI"
                        >
                            <span className={`text-xs font-bold ${isLlmProcessing ? 'animate-pulse' : ''} ${prompt ? 'ai-icon-text text-blue-500' : 'text-gray-400'}`}>
                                AI
                            </span>
                        </button>
                    </div>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
                
                <div>
                    <button
                        id="createProjectButton"
                        type="submit"
                        disabled={isSubmitting || isLlmProcessing}
                        className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                            isSubmitting || isLlmProcessing
                                ? 'bg-indigo-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                        }`}
                    >
                        {isSubmitting ? 'Creating...' : isLlmProcessing ? 'Processing...' : 'Create Project'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateProjectForm;
