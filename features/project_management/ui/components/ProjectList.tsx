// features/project_management/ui/components/ProjectList.tsx
import React, { useState, useEffect } from 'react';
import apiClient from '../../../../app-ui/src/lib/apiClient'; // Go up 4 levels, then into app-ui/src
import { Project } from '../../../../app-ui/src/types/project'; // Go up 4 levels, then into app-ui/src

interface GenerationResponse { message: string; project_id: number; }

interface ProjectListProps {
    onProjectSelect: (projectId: number) => void;
    refreshTrigger: number;
    onStartGeneration: (projectId: number) => void; // <-- New prop
    onGenerationComplete: (projectId: number, success: boolean) => void; // <-- Modified prop
    generatingProjectId: number | null; // <-- New prop
    selectedProjectId: number | null;
    triggerRefresh: () => void; // <-- Add this to trigger refresh after deletion
}

const ProjectList: React.FC<ProjectListProps> = ({
    onProjectSelect,
    refreshTrigger,
    onStartGeneration, // <-- Destructure
    onGenerationComplete, // <-- Destructure
    generatingProjectId, // <-- Destructure
    selectedProjectId, // <-- Destructure
    triggerRefresh // <-- Destructure this new prop
}) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [listError, setListError] = useState<string | null>(null);
    const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);

    // --- Removed local generatingStatus and generationError state ---
    // We now rely on the generatingProjectId prop from the parent

    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(true);
            setListError(null);
            try {
                const data = await apiClient<Project[]>('/projects', { method: 'GET' });
                setProjects(data);
            } catch (err: any) {
                setListError(err.message || 'Failed to fetch projects');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, [refreshTrigger]);

    const handleGenerateClick = async (projectId: number, event: React.MouseEvent) => {
        event.stopPropagation();
        // Prevent multiple clicks if already generating this one
        if (generatingProjectId === projectId) return;

        // First ensure project is selected before starting generation
        onProjectSelect(projectId);
        
        onStartGeneration(projectId); // Notify parent generation is starting

        let success = false; // Track success
        try {
            const result = await apiClient<GenerationResponse>(`/requirements/generate/${projectId}`, { method: 'POST' });
            console.log('Generation API call successful:', result);
            success = true; // Mark as success
            // Optionally show temporary success state locally if needed, but parent handles refresh
        } catch (err: any) {
            console.error('Generation failed:', err);
            // Optionally display error message locally if needed
            success = false; // Mark as failure
        } finally {
            // Always notify parent when done, passing success status
            onGenerationComplete(projectId, success);
        }
    };

    const handleDeleteClick = async (projectId: number, event: React.MouseEvent) => {
        event.stopPropagation(); // Prevent project selection

        // Confirm deletion
        if (!window.confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
            return;
        }

        setDeletingProjectId(projectId);
        
        try {
            // Call the delete API endpoint
            await apiClient(`/projects/${projectId}`, { method: 'DELETE' });
            console.log('Project deleted successfully');
            
            // Remove from local state
            setProjects(projects.filter(p => p.id !== projectId));
            
            // If the deleted project was selected, clear selection
            if (selectedProjectId === projectId) {
                onProjectSelect(-1); // Pass an invalid ID to deselect
            }
            
            // Trigger refresh in parent
            triggerRefresh();
        } catch (err: any) {
            console.error('Project deletion failed:', err);
            alert('Failed to delete project: ' + (err.message || 'Unknown error'));
        } finally {
            setDeletingProjectId(null);
        }
    };

    if (loading) {
        return <div className="text-center p-4">Loading projects...</div>;
    }


    if (listError) {
        return <div className="text-center p-4 text-red-600">Error loading projects: {listError}</div>;
    }

    return (
        <div className="p-1 border rounded shadow-sm bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">  {/* Reduced padding slightly */}
        <h2 className="text-xl font-semibold mb-3 px-2 dark:text-gray-100">Projects</h2> {/* Added padding to header */}
            {projects.length === 0 ? (
                <p className="px-2">No projects found.</p>
            ) : (
                <ul className="space-y-1"> {/* Reduced spacing slightly */}
                    {projects.map((project) => {
                        // Determine button state based on the prop
                        const isGenerating = generatingProjectId === project.id;
                        const isDeleting = deletingProjectId === project.id;

                        return (
                            <li
                                key={project.id}
                                className={`p-2 border-b last:border-b-0 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center border-gray-200 dark:border-gray-700 ${selectedProjectId === project.id ? 'bg-blue-100 dark:bg-blue-900 dark:bg-opacity-40' : 'bg-white dark:bg-gray-800'}`} // Highlight selected
                                onClick={() => onProjectSelect(project.id)}
                            >
                                <div className="flex-1 mr-2">
                                <span className="block font-medium text-sm dark:text-gray-100">{project.name}</span> {/* Smaller text */}
                                <span className="text-xs text-gray-500 dark:text-gray-400">  {/* Smaller text */}
                                        Created: {new Date(project.created_at).toLocaleDateString()}
                                    </span>
                                    {/* Display generation error? (Need error prop from parent if desired) */}
                                </div>
                                <div className="flex space-x-2">
                                    {/* Delete Button */}
                                    <button
                                        onClick={(e) => handleDeleteClick(project.id, e)}
                                        disabled={isDeleting || isGenerating}
                                        className={`p-1 border border-gray-200 text-xs rounded-full w-7 h-7 flex items-center justify-center transition-all focus:outline-none ${
                                            isDeleting
                                                ? 'bg-gray-200 text-gray-500 cursor-wait'
                                                : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-red-500 hover:border-red-200'
                                        }`}
                                        title="Delete Project"
                                    >
                                        {isDeleting ? '...' : '🗑️'}
                                    </button>
                                    
                                    {/* Generate Button */}
                                    <button
                                        onClick={(e) => handleGenerateClick(project.id, e)}
                                        disabled={isGenerating || isDeleting}
                                        className={`py-1 px-3 border text-xs font-medium rounded-md transition-all focus:outline-none ${
                                            isGenerating
                                                ? 'bg-gray-200 text-gray-500 cursor-wait border-gray-300'
                                                : 'bg-white text-blue-600 hover:bg-blue-50 hover:border-blue-300 border-gray-200'
                                        }`}
                                    >
                                        {isGenerating ? 'Generating...' : 'Generate Reqs'}
                                    </button>
                                </div>
                            </li>
                        );
                     })}
                </ul>
            )}
        </div>
    );
};

export default ProjectList;

