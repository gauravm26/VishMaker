// app-ui/src/pages/ProjectDashboard.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import CreateProjectForm from '../components/project/CreateProjectForm';
import ProjectList from '../components/project/ProjectList';
import CanvasViewer from '../components/canvas/CanvasViewer';

const ProjectDashboard: React.FC = () => {
    // Existing state
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
    const [listRefreshKey, setListRefreshKey] = useState<number>(0);
    const [canvasRefreshNonce, setCanvasRefreshNonce] = useState<number>(0);

    // Mobile responsive state
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Check if mobile on mount and resize
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 1024; // lg breakpoint
            setIsMobile(mobile);
            
            // Auto-close sidebar on mobile when not explicitly opened
            if (mobile && !isSidebarOpen) {
                setIsSidebarOpen(false);
            }
            // Auto-open sidebar on desktop
            if (!mobile) {
                setIsSidebarOpen(true);
            }
        };

        // Initial check
        checkMobile();

        // Set up resize listener
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, [isSidebarOpen]);

    // Prevent body scroll when mobile sidebar is open
    useEffect(() => {
        if (isMobile && isSidebarOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }

        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isMobile, isSidebarOpen]);

    // Use refs to avoid issues with re-rendering
    const selectedProjectIdRef = useRef<number | null>(selectedProjectId);
    selectedProjectIdRef.current = selectedProjectId;

    const triggerListRefresh = useCallback(() => {
        setListRefreshKey(prev => prev + 1);
    }, []);

    const handleProjectCreated = useCallback(() => {
        triggerListRefresh();
        // Close mobile sidebar after creating project
        if (isMobile) {
            setIsSidebarOpen(false);
        }
    }, [triggerListRefresh, isMobile]);

    const handleProjectSelected = useCallback((projectId: number) => {
        setSelectedProjectId(projectId);
        setCanvasRefreshNonce(Date.now());
        
        // Close mobile sidebar after selecting project
        if (isMobile) {
            setIsSidebarOpen(false);
        }
    }, [isMobile]);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const closeSidebar = () => {
        setIsSidebarOpen(false);
    };

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        VishMaker
                    </h1>
                    <button
                        onClick={toggleSidebar}
                        className="touch-target text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                        aria-label="Toggle sidebar"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>
                
                {/* Mobile project info bar */}
                {selectedProjectId !== null && (
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Project {selectedProjectId} selected
                    </div>
                )}
            </div>

            {/* Sidebar Overlay (Mobile) */}
            {isMobile && isSidebarOpen && (
                <div 
                    className="drawer-overlay"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <div className={`
                ${isMobile 
                    ? `drawer-content ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
                    : 'relative w-80 xl:w-96'
                }
                flex flex-col bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
                ${isMobile ? 'z-50' : 'z-10'}
            `}>
                {/* Sidebar Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                    <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                        VishMaker
                    </h1>
                    {isMobile && (
                        <button
                            onClick={closeSidebar}
                            className="touch-target text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            aria-label="Close sidebar"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Sidebar Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    <div className="p-4 space-y-6">
                        {/* Create Project Form */}
                        <div className="lg:sticky lg:top-0 bg-gray-50 dark:bg-gray-800 lg:bg-transparent lg:dark:bg-transparent">
                            <CreateProjectForm onProjectCreated={handleProjectCreated} />
                        </div>

                        {/* Project List */}
                        <div className="flex-1">
                            <ProjectList
                                onProjectSelect={handleProjectSelected}
                                refreshTrigger={listRefreshKey}
                                selectedProjectId={selectedProjectId}
                                triggerRefresh={triggerListRefresh}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className={`
                flex-1 flex flex-col overflow-hidden
                ${isMobile ? 'pt-16' : ''}
            `}>
                {/* Desktop Header */}
                <div className="hidden lg:flex items-center justify-between p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {selectedProjectId !== null ? `Project ${selectedProjectId}` : 'No project selected'}
                    </h2>
                    
                    {/* Desktop actions could go here */}
                    <div className="flex items-center space-x-3">
                        {selectedProjectId !== null && (
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                Canvas View
                            </span>
                        )}
                    </div>
                </div>

                {/* Mobile Project Header */}
                <div className="lg:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            {selectedProjectId !== null ? `Project ${selectedProjectId}` : 'Select a project'}
                        </h2>
                        {selectedProjectId !== null && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                Canvas
                            </span>
                        )}
                    </div>
                </div>

                {/* Canvas Content */}
                <div className="flex-1 overflow-hidden bg-white dark:bg-gray-900">
                    {selectedProjectId !== null ? (
                        <div className="h-full w-full">
                            <CanvasViewer
                                projectId={selectedProjectId}
                                refreshTrigger={canvasRefreshNonce}
                            />
                        </div>
                    ) : (
                        /* Empty State */
                        <div className="h-full flex items-center justify-center p-8">
                            <div className="text-center max-w-md mx-auto">
                                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                                    No Project Selected
                                </h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-6">
                                    Create a new project or select an existing one from the sidebar to get started.
                                </p>
                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    {isMobile ? 'Open Projects' : 'Create Project'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Mobile Bottom Action Bar (Optional) */}
            {isMobile && selectedProjectId !== null && (
                <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 safe-area-inset">
                    <div className="flex justify-center">
                        <button
                            onClick={toggleSidebar}
                            className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
                            </svg>
                            Projects
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectDashboard;