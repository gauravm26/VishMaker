// app-ui/src/components/project/ProjectList.tsx
import React, { useState, useEffect } from 'react';
import { Project } from '../../types/project';
import apiClient from '../../utils/apiClient';
import Modal from '../shared/Modal';

interface ProjectListProps {
    onProjectSelect: (projectId: number, projectName?: string) => void;
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
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
    const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
    const [isAlive, setIsAlive] = useState<boolean>(true);

    useEffect(() => {
        const fetchProjects = async () => {
            setLoading(true);
            setListError(null);
            try {
                const data = await apiClient<Project[]>('/projects', { method: 'GET' });
                setProjects(data);
                setIsAlive(true);
            } catch (err: any) {
                setListError(err.message || 'Failed to fetch projects');
                setIsAlive(false);
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProjects();
    }, [refreshTrigger]);

    const handleDeleteClick = (project: Project, e: React.MouseEvent) => {
        e.stopPropagation();
        setProjectToDelete(project);
        setShowDeleteConfirm(true);
    };

    const handleDeleteConfirm = async () => {
        if (!projectToDelete) return;
        
        setShowDeleteConfirm(false);
        setDeletingProjectId(projectToDelete.id);
        
        try {
            await apiClient(`/projects/${projectToDelete.id}`, { method: 'DELETE' });
            triggerRefresh();
        } catch (err: any) {
            console.error('Failed to delete project:', err);
            alert('Failed to delete project. Please try again.');
        } finally {
            setDeletingProjectId(null);
            setProjectToDelete(null);
        }
    };

    const handleDeleteCancel = () => {
        setShowDeleteConfirm(false);
        setProjectToDelete(null);
    };

    if (loading) {
        return (
            <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                        <div className="h-20 bg-white/10 rounded-xl"></div>
                    </div>
                ))}
            </div>
        );
    }

    if (listError) {
        // Don't show error state, just return empty state
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <h2 className="text-lg sm:text-xl font-semibold text-white">
                        Projects
                    </h2>
                    
                    {/* Alive Status Indicator */}
                    <div className="flex items-center gap-2">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-300 ${
                            isAlive 
                                ? 'bg-green-500/20 border-green-400/30 text-green-300' 
                                : 'bg-red-500/20 border-red-400/30 text-red-300'
                        }`}>
                            <div className={`w-2 h-2 rounded-full animate-pulse ${
                                isAlive ? 'bg-green-400' : 'bg-red-400'
                            }`}></div>
                            <span>{isAlive ? 'Alive' : 'Offline'}</span>
                        </div>
                        
                        {/* Heartbeat Icon */}
                        <div className={`p-1.5 rounded-full transition-all duration-300 ${
                            isAlive 
                                ? 'bg-green-500/10 text-green-400' 
                                : 'bg-red-500/10 text-red-400'
                        }`}>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                        </div>
                    </div>
                </div>
                
                <span className="text-xs sm:text-sm text-gray-300 bg-white/10 px-3 py-1 rounded-full border border-white/20">
                    {projects.length}
                </span>
            </div>

            {projects.length === 0 ? (
                <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center border border-white/10">
                        <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-white mb-3">
                        No projects yet
                    </h3>
                    <p className="text-gray-300 text-sm leading-relaxed">
                        Create your first project to begin your creative journey.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {projects.map((project) => {
                        const isDeleting = deletingProjectId === project.id;
                        const isSelected = selectedProjectId === project.id;

                        return (
                            <div
                                key={project.id}
                                className={`
                                    group relative p-4 rounded-xl border transition-all duration-300 cursor-pointer transform hover:scale-[1.02]
                                    ${isSelected 
                                        ? 'bg-gradient-to-r from-purple-500/20 to-blue-500/20 border-purple-400/30 shadow-lg shadow-purple-500/10' 
                                        : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 hover:shadow-lg'
                                    }
                                    ${isDeleting ? 'opacity-50' : ''}
                                `}
                                onClick={() => !isDeleting && onProjectSelect(project.id, project.name)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0 pr-3">
                                        <h3 className={`
                                            text-sm sm:text-base font-semibold truncate
                                            ${isSelected 
                                                ? 'text-white' 
                                                : 'text-white'
                                            }
                                        `}>
                                            {project.name}
                                        </h3>
                                        <p className={`
                                            text-xs sm:text-sm mt-2
                                            ${isSelected 
                                                ? 'text-purple-200' 
                                                : 'text-gray-300'
                                            }
                                        `}>
                                            Created: {new Date(project.created_at).toLocaleDateString()}
                                        </p>
                                        
                                        {/* Project ID for debugging */}
                                        <span className="text-xs text-gray-400 mt-1 block">
                                            ID: {project.id}
                                        </span>
                                    </div>

                                    {/* Delete Button */}
                                    <button
                                        onClick={(e) => handleDeleteClick(project, e)}
                                        disabled={isDeleting}
                                        className={`
                                            p-2 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100
                                            ${isDeleting 
                                                ? 'text-gray-400 cursor-not-allowed' 
                                                : 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
                                            }
                                        `}
                                        title="Delete project"
                                    >
                                        {isDeleting ? (
                                            <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        )}
                                    </button>
                                </div>

                                {/* Selection indicator */}
                                {isSelected && (
                                    <div className="absolute top-2 right-2 w-2 h-2 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full"></div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {showDeleteConfirm && projectToDelete && (
                <Modal
                    isOpen={showDeleteConfirm}
                    onClose={handleDeleteCancel}
                    title="Confirm Deletion"
                    size="sm"
                >
                    <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-full flex items-center justify-center border border-red-400/30">
                            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        
                        <h3 className="text-lg font-semibold text-white mb-3">
                            Delete Project
                        </h3>
                        
                        <p className="text-gray-300 text-sm leading-relaxed mb-6">
                            Are you sure you want to delete <span className="text-white font-medium">"{projectToDelete.name}"</span>? 
                            This action cannot be undone.
                        </p>
                        
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={handleDeleteCancel}
                                className="px-6 py-2 rounded-lg border border-white/20 text-white hover:bg-white/10 transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                className="px-6 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg"
                            >
                                Delete Project
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ProjectList; 