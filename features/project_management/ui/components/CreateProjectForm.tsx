// features/project_management/ui/components/CreateProjectForm.tsx
import React, { useState } from 'react';
import apiClient from '../../../../app-ui/src/lib/apiClient'; // Adjust path
import { ProjectCreatePayload, Project } from '../../../../app-ui/src/types/project'; // Adjust path

interface CreateProjectFormProps {
    onProjectCreated: () => void; // Callback to trigger refresh in parent
}

const CreateProjectForm: React.FC<CreateProjectFormProps> = ({ onProjectCreated }) => {
    const [name, setName] = useState('');
    const [prompt, setPrompt] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!name.trim()) {
            setError('Project name is required.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const payload: ProjectCreatePayload = {
            name: name.trim(),
            initial_prompt: prompt.trim() || null,
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

    return (
        <div className="p-4 border rounded shadow-sm bg-white mb-4">
            <h2 className="text-xl font-semibold mb-3">Create New Project</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                    <label htmlFor="projectName" className="block text-sm font-medium text-gray-700">
                        Project Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        id="projectName"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        disabled={isSubmitting}
                    />
                </div>
                <div>
                    <label htmlFor="initialPrompt" className="block text-sm font-medium text-gray-700">
                        Initial Prompt (Optional)
                    </label>
                    <textarea
                        id="initialPrompt"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        rows={3}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        disabled={isSubmitting}
                    />
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                            isSubmitting
                                ? 'bg-indigo-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                        }`}
                    >
                        {isSubmitting ? 'Creating...' : 'Create Project'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateProjectForm;
