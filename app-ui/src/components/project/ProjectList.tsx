// app-ui/src/components/project/ProjectList.tsx
import React, { useState, useEffect } from 'react';
import apiClient from '../../lib/apiClient';
import { Project } from '../../types/project';

interface GenerationResponse { message: string; project_id: number; }

interface ProjectListProps {
    onProjectSelect: (projectId: number) => void;
    refreshTrigger: number;
    selectedProjectId: number | null;
    triggerRefresh: () => void;
}

const ProjectList: React.FC<ProjectListProps> = ({
    onProjectSelect,
    refreshTrigger,
    selectedProjectId,
    triggerRefresh
}) => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [listError, setListError] = useState<string | null>(null);
    const [deletingProjectId, setDeletingProjectId] = useState<number | null>(null);

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
        return (
            <div className="card-responsive">
                <div className="flex items-center justify-center py-8">
                    <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="ml-2 text-gray-600 dark:text-gray-400">Loading projects...</span>
                </div>
            </div>
        );
    }

    if (listError) {
        return (
            <div className="card-responsive">
                <div className="text-center py-8">
                    <svg className="w-12 h-12 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        Error Loading Projects
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                        {listError}
                    </p>
                    <button
                        onClick={() => triggerRefresh()}
                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="card-responsive">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Projects
                </h2>
                <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                    {projects.length}
                </span>
            </div>

            {projects.length === 0 ? (
                <div className="text-center py-12">
                    <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                        No projects yet
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        Create your first project to get started.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {projects.map((project) => {
                        const isDeleting = deletingProjectId === project.id;
                        const isSelected = selectedProjectId === project.id;

                        return (
                            <div
                                key={project.id}
                                className={`
                                    group relative p-3 sm:p-4 rounded-lg border transition-all duration-200 cursor-pointer
                                    ${isSelected 
                                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 shadow-sm' 
                                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600'
                                    }
                                    ${isDeleting ? 'opacity-50' : ''}
                                `}
                                onClick={() => !isDeleting && onProjectSelect(project.id)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0 pr-3">
                                        <h3 className={`
                                            text-sm sm:text-base font-medium truncate
                                            ${isSelected 
                                                ? 'text-blue-900 dark:text-blue-100' 
                                                : 'text-gray-900 dark:text-gray-100'
                                            }
                                        `}>
                                            {project.name}
                                        </h3>
                                        <p className={`
                                            text-xs sm:text-sm mt-1
                                            ${isSelected 
                                                ? 'text-blue-600 dark:text-blue-300' 
                                                : 'text-gray-500 dark:text-gray-400'
                                            }
                                        `}>
                                            Created: {new Date(project.created_at).toLocaleDateString()}
                                        </p>
                                        
                                        {/* Project ID for debugging */}
                                        <span className="text-xs text-gray-400 dark:text-gray-500">
                                            ID: {project.id}
                                        </span>
                                    </div>

                                    {/* Delete Button */}
                                    <button
                                        onClick={(e) => handleDeleteClick(project.id, e)}
                                        disabled={isDeleting}
                                        className={`
                                            touch-target flex-shrink-0 p-2 rounded-full transition-all duration-200
                                            focus:outline-none focus:ring-2 focus:ring-offset-2
                                            ${isDeleting
                                                ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-wait'
                                                : 'text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:ring-red-500'
                                            }
                                            ${isSelected 
                                                ? 'group-hover:text-red-500 dark:group-hover:text-red-400' 
                                                : ''
                                            }
                                        `}
                                        title="Delete Project"
                                        aria-label={`Delete project ${project.name}`}
                                    >
                                        {isDeleting ? (
                                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        )}
                                    </button>
                                </div>

                                {/* Selection Indicator */}
                                {isSelected && (
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 dark:bg-blue-400 rounded-l-lg"></div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ProjectList; 