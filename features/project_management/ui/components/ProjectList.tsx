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
    
}

const ProjectList: React.FC<ProjectListProps> = ({
    onProjectSelect,
    refreshTrigger,
    onStartGeneration, // <-- Destructure
    onGenerationComplete, // <-- Destructure
    generatingProjectId, // <-- Destructure
    selectedProjectId // <-- Destructure
    
}) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [listError, setListError] = useState<string | null>(null);

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
                                <button
                                    onClick={(e) => handleGenerateClick(project.id, e)}
                                    disabled={isGenerating} // Use the prop for disabled state
                                    className={`py-1 px-2 border border-transparent text-xs font-medium rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                                        isGenerating
                                            ? 'bg-gray-400 text-white cursor-wait'
                                            : 'bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-400'
                                    }`}
                                >
                                    {isGenerating ? 'Generating...' : 'Generate Reqs'}
                                </button>
                            </li>
                        );
                     })}
                </ul>
            )}
        </div>
    );
};

export default ProjectList;

