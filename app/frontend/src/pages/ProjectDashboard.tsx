// app-ui/src/pages/ProjectDashboard.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import CreateProjectForm from '../components/project/CreateProjectForm';
import ProjectList from '../components/project/ProjectList';
import CanvasViewer from '../components/canvas/CanvasViewer';
import Settings from '../components/Settings';

const ProjectDashboard: React.FC = () => {
    // Existing state
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
    const [listRefreshKey, setListRefreshKey] = useState<number>(0);
    const [canvasRefreshNonce, setCanvasRefreshNonce] = useState<number>(0);

    // Mobile responsive state
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    
    // Settings state
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
        <div className="flex h-screen bg-[#0A071B] text-white overflow-hidden">
            {/* Animated Background */}
            <div className="fixed inset-0 z-0">
                <div className="absolute inset-0 bg-gradient-to-br from-[#0A071B] via-[#1A103A] to-[#0A071B]"></div>
                <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-gradient-to-br from-purple-900/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '20s' }}></div>
                <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-gradient-to-tl from-teal-800/15 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDuration: '20s', animationDelay: '10s' }}></div>
            </div>

            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white/5 backdrop-blur-lg border-b border-white/10 px-4 py-3">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        VishMaker
                    </h1>
                    <button
                        onClick={toggleSidebar}
                        className="touch-target text-gray-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                        aria-label="Toggle sidebar"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>
                
                {/* Mobile project info bar */}
                {selectedProjectId !== null && (
                    <div className="mt-2 text-sm text-gray-300 bg-white/5 rounded-lg px-3 py-1">
                        Project {selectedProjectId} selected
                    </div>
                )}
            </div>

            {/* Sidebar Overlay (Mobile) */}
            {isMobile && isSidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <div className={`
                ${isMobile 
                    ? `fixed top-0 left-0 h-full w-80 transform transition-transform duration-300 ease-out z-50 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
                    : 'relative w-80 xl:w-96'
                }
                flex flex-col bg-white/5 backdrop-blur-xl border-r border-white/10
            `}>
                {/* Sidebar Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                    <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        VishMaker
                    </h1>
                    {isMobile && (
                        <button
                            onClick={closeSidebar}
                            className="touch-target text-gray-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
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
                    <div className="p-6 space-y-6">
                        {/* Create Project Form */}
                        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-4 border border-white/10">
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

                {/* Settings Button - Bottom of Sidebar */}
                <div className="p-4 border-t border-white/10 bg-white/5">
                    <div className="flex justify-center">
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white rounded-full shadow-lg hover:shadow-purple-500/25 transition-all duration-300 flex items-center justify-center group"
                            title="Settings"
                        >
                            <svg className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className={`
                flex-1 flex flex-col overflow-hidden relative z-10
                ${isMobile ? 'pt-16' : ''}
            `}>
                {/* Desktop Header */}
                <div className="hidden lg:flex items-center justify-between p-6 bg-white/5 backdrop-blur-lg border-b border-white/10">
                    <h2 className="text-xl font-semibold text-white">
                        {selectedProjectId !== null ? `Project ${selectedProjectId}` : 'No project selected'}
                    </h2>
                    
                    {/* Desktop actions */}
                    <div className="flex items-center space-x-3">
                        {selectedProjectId !== null && (
                            <span className="text-sm text-gray-300 bg-white/10 px-3 py-1 rounded-full">
                                Canvas View
                            </span>
                        )}
                    </div>
                </div>

                {/* Mobile Project Header */}
                <div className="lg:hidden bg-white/5 backdrop-blur-lg border-b border-white/10 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-white">
                            {selectedProjectId !== null ? `Project ${selectedProjectId}` : 'Select a project'}
                        </h2>
                        {selectedProjectId !== null && (
                            <span className="text-xs text-gray-300 bg-white/10 px-2 py-1 rounded-full">
                                Canvas
                            </span>
                        )}
                    </div>
                </div>

                {/* Canvas Content */}
                <div className="flex-1 overflow-hidden bg-white/5 backdrop-blur-lg">
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
                                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full flex items-center justify-center border border-white/10 backdrop-blur-lg">
                                    <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-3">
                                    No Project Selected
                                </h3>
                                <p className="text-gray-300 mb-8 leading-relaxed">
                                    Create a new project or select an existing one from the sidebar to get started with your creative journey.
                                </p>
                                <button
                                    onClick={() => setIsSidebarOpen(true)}
                                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-purple-500/25 transform hover:scale-105"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <div className="fixed bottom-0 left-0 right-0 bg-white/5 backdrop-blur-lg border-t border-white/10 p-4 safe-area-inset z-30">
                    <div className="flex justify-center">
                        <button
                            onClick={toggleSidebar}
                            className="flex items-center px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-300 border border-white/20"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
                            </svg>
                            Projects
                        </button>
                    </div>
                </div>
            )}



            {/* Settings Modal */}
            <Settings 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
            />
        </div>
    );
};

export default ProjectDashboard;