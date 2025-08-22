// app-ui/src/pages/ProjectDashboard.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import CreateProjectForm from '../components/project/CreateProjectForm';
import ProjectList from '../components/project/ProjectList';
import CanvasViewer from '../components/canvas/CanvasViewer';
import RequirementsTab from '../components/tabs/RequirementsTab';
import ArchitectureTab from '../components/tabs/ArchitectureTab';
import CodeTab from '../components/tabs/CodeTab';
import Settings from '../components/Settings';
import Modal from '../components/shared/Modal';
import { useAuth } from '../contexts/AuthContext';

const ProjectDashboard: React.FC = () => {
    // Auth context
    const { signOut } = useAuth();
    
    // Existing state
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
    const [selectedProjectName, setSelectedProjectName] = useState<string>('');
    const [listRefreshKey, setListRefreshKey] = useState<number>(0);
    const [canvasRefreshNonce, setCanvasRefreshNonce] = useState<number>(0);

    // Mobile responsive state - Start with sidebar open on desktop for easier project selection
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    
    // Settings state
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    // Create project modal state
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    
    // Create project form expansion state
    const [shouldExpandCreateForm, setShouldExpandCreateForm] = useState(false);
    
    // Tab state
    const [activeTab, setActiveTab] = useState<'requirements' | 'architecture' | 'code'>('requirements');
    
    // Panel visibility states
    const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

    // Refresh triggers for tabs
    const [architectureRefreshTrigger, setArchitectureRefreshTrigger] = useState(0);
    const [codeRefreshTrigger, setCodeRefreshTrigger] = useState(0);

    // Handle refresh based on active tab
    const handleRefresh = () => {
        if (activeTab === 'architecture') {
            setArchitectureRefreshTrigger(prev => prev + 1);
        } else if (activeTab === 'code') {
            setCodeRefreshTrigger(prev => prev + 1);
        } else if (activeTab === 'requirements') {
            setCanvasRefreshNonce(Date.now());
        }
    };

    // Check if mobile on mount and resize
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 1024; // lg breakpoint
            setIsMobile(mobile);
            
            // Auto-close sidebar on mobile when not explicitly opened
            if (mobile && !isSidebarOpen) {
                setIsSidebarOpen(false);
            }
            // Keep sidebar open by default on desktop for easier project selection
            if (!mobile && isSidebarOpen === undefined) {
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

    const handleProjectCreated = useCallback((projectId?: number, projectName?: string) => {
        triggerListRefresh();
        
        // If a project ID is provided, automatically select it
        if (projectId) {
            setSelectedProjectId(projectId);
            setSelectedProjectName(projectName || '');
            setCanvasRefreshNonce(Date.now());
        }
        
        // Close modal after creating project
        setIsCreateModalOpen(false);
        // Close mobile sidebar after creating project
        if (isMobile) {
            setIsSidebarOpen(false);
        }
    }, [triggerListRefresh, isMobile]);

    const handleProjectSelected = useCallback((projectId: number, projectName?: string) => {
        setSelectedProjectId(projectId);
        setSelectedProjectName(projectName || '');
        
        // Auto-refresh all tabs when a project is selected
        setCanvasRefreshNonce(Date.now());
        setArchitectureRefreshTrigger(prev => prev + 1);
        setCodeRefreshTrigger(prev => prev + 1);
        
        // Close mobile sidebar after selecting project
        if (isMobile) {
            setIsSidebarOpen(false);
        }
    }, [isMobile]);

    const toggleSidebar = () => {
        console.log('ProjectDashboard: toggleSidebar called, current state:', isSidebarOpen);
        setIsSidebarOpen(!isSidebarOpen);
    };

    const closeSidebar = () => {
        setIsSidebarOpen(false);
    };

    // Panel toggle functions
    const toggleBottomPanel = () => {
        console.log('ProjectDashboard: toggleBottomPanel called, current state:', isBottomPanelOpen);
        setIsBottomPanelOpen(prev => {
            const newState = !prev;
            console.log('ProjectDashboard: Bottom panel state changing from', prev, 'to', newState);
            return newState;
        });
    };

    const toggleRightPanel = () => {
        console.log('ProjectDashboard: toggleRightPanel called, current state:', isRightPanelOpen);
        setIsRightPanelOpen(prev => {
            const newState = !prev;
            console.log('ProjectDashboard: Right panel state changing from', prev, 'to', newState);
            return newState;
        });
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
                    : `relative transition-all duration-300 ease-out ${isSidebarOpen ? 'w-80 xl:w-96' : 'w-0'} overflow-hidden`
                }
                flex flex-col bg-white/5 backdrop-blur-xl border-r border-white/10
            `}>
                {/* Sidebar Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                    <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        VishMaker
                    </h1>
                        <button
                            onClick={closeSidebar}
                            className="touch-target text-gray-300 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
                            aria-label="Close sidebar"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                </div>

                {/* Sidebar Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    <div className="p-6 space-y-6">
                        {/* Create Project Button */}
                        <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-4 border border-white/10">
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="w-full flex items-center justify-center px-6 py-4 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-purple-500/25 transform hover:scale-105"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                Create New Project
                            </button>
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

            {/* Main Content Area - Expands when sidebar is closed */}
            <div className={`
                flex-1 flex flex-col overflow-hidden relative z-10
                ${isMobile ? 'pt-16' : ''}
                transition-all duration-300 ease-out
            `}>
                {/* Desktop Header */}
                <div className="hidden lg:flex items-center justify-between p-6 bg-white/5 backdrop-blur-lg border-b border-white/10">
                    <h2 className="text-xl font-semibold text-white">
                        {selectedProjectId !== null ? (selectedProjectName || `Project ${selectedProjectId}`) : 'No project selected'}
                    </h2>
                    
                    {/* Desktop actions */}
                    <div className="flex items-center space-x-3">
                        {/* Panel Controls */}
                        <div className="flex items-center space-x-2">
                            {/* Bottom Panel Toggle */}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('ProjectDashboard: Bottom panel button clicked');
                                    toggleBottomPanel();
                                }}
                                className={`p-2 rounded-lg transition-colors text-gray-300 hover:bg-white/20 ${
                                    isBottomPanelOpen ? 'bg-green-500/20 border border-green-500/30' : 'bg-white/10'
                                }`}
                                title={`Toggle Terminal ${isBottomPanelOpen ? '(Open)' : '(Closed)'}`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </button>
                            
                            {/* Right Panel Toggle */}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log('ProjectDashboard: Right panel button clicked');
                                    toggleRightPanel();
                                }}
                                className={`p-2 rounded-lg transition-colors text-gray-300 hover:bg-white/20 ${
                                    isRightPanelOpen ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-white/10'
                                }`}
                                title={`Toggle Chat Panel ${isRightPanelOpen ? '(Open)' : '(Closed)'}`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.0M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            </button>
                        </div>
                        
                        {/* Settings and Sign Out */}
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white rounded-lg shadow-lg hover:shadow-purple-500/25 transition-all duration-300 flex items-center justify-center group"
                                title="Settings"
                            >
                                <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </button>
                            <button
                                onClick={signOut}
                                className="w-10 h-10 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg shadow-lg hover:shadow-red-500/25 transition-all duration-300 flex items-center justify-center group"
                                title="Sign Out"
                            >
                                <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </div>
                        
                        {/* Debug Panel States */}
                        <div className="text-xs text-gray-400 mt-2 flex space-x-4">
                            <span>Bottom: {isBottomPanelOpen ? '🟢 Open' : '🔴 Closed'}</span>
                            <span>Right: {isRightPanelOpen ? '🟢 Open' : '🔴 Closed'}</span>
                        </div>
                    </div>
                </div>

                {/* Mobile Project Header */}
                <div className="lg:hidden bg-white/5 backdrop-blur-lg border-b border-white/10 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-medium text-white">
                            {selectedProjectId !== null ? (selectedProjectName || `Project ${selectedProjectId}`) : 'Select a project'}
                        </h2>
                        {selectedProjectId !== null && (
                            <span className="text-xs text-gray-300 bg-white/10 px-2 py-1 rounded-full">
                                {activeTab === 'requirements' && 'Requirements'}
                                {activeTab === 'architecture' && 'Architecture'}
                                {activeTab === 'code' && 'Code'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Tab Navigation */}
                {selectedProjectId !== null && (
                    <div className="bg-white/5 backdrop-blur-lg border-b border-white/10">
                        <div className="flex items-center justify-between p-2">
                            <div className="flex space-x-1 flex-1">
                                <button
                                    onClick={() => setActiveTab('requirements')}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                                        activeTab === 'requirements'
                                            ? 'bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-lg'
                                            : 'text-gray-300 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    Requirements
                                </button>
                                <button
                                    onClick={() => setActiveTab('architecture')}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                                        activeTab === 'architecture'
                                            ? 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white shadow-lg'
                                            : 'text-gray-300 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    Architecture
                                </button>
                                <button
                                    onClick={() => setActiveTab('code')}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                                        activeTab === 'code'
                                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg'
                                            : 'text-gray-300 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    Code
                                </button>
                            </div>
                            <button
                                onClick={handleRefresh}
                                className="ml-2 flex items-center space-x-1 px-3 py-2 text-xs bg-white/10 border border-white/20 rounded text-white hover:bg-white/20 transition-colors"
                                title="Refresh data"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Tab Content */}
                <div className="flex-1 overflow-hidden bg-white/5 backdrop-blur-lg">
                    {selectedProjectId !== null ? (
                        <div className="h-full w-full">
                            {activeTab === 'requirements' && (
                                <CanvasViewer
                                    projectId={selectedProjectId}
                                    refreshTrigger={canvasRefreshNonce}
                                    onToggleSidebar={toggleSidebar}
                                    showCanvas={true}
                                    isBottomPanelOpen={isBottomPanelOpen}
                                    isRightPanelOpen={isRightPanelOpen}
                                    onToggleBottomPanel={toggleBottomPanel}
                                    onToggleRightPanel={toggleRightPanel}
                                />
                            )}
                            {activeTab === 'architecture' && (
                                <ArchitectureTab 
                                    projectId={selectedProjectId} 
                                    refreshTrigger={architectureRefreshTrigger}
                                />
                            )}
                            {activeTab === 'code' && (
                                <CodeTab 
                                    projectId={selectedProjectId} 
                                    refreshTrigger={codeRefreshTrigger}
                                />
                            )}
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
                                <p className="text-gray-300 mb-8 leading-relaxed">
                                    Create a new project or select an existing one from the sidebar to get started with your creative journey.
                                </p>
                                <button
                                    onClick={() => setIsCreateModalOpen(true)}
                                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white rounded-xl transition-all duration-300 font-semibold shadow-lg hover:shadow-purple-500/25 transform hover:scale-105"
                                >
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Create New Project
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

            {/* Create Project Modal */}
            <Modal 
                isOpen={isCreateModalOpen} 
                onClose={() => setIsCreateModalOpen(false)}
                title="Create New Project"
                size="lg"
            >
                <CreateProjectForm 
                    onProjectCreated={handleProjectCreated} 
                    shouldExpand={true}
                    onExpandChange={setShouldExpandCreateForm}
                />
            </Modal>

            {/* Settings Modal */}
            <Settings 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
            />
        </div>
    );
};

export default ProjectDashboard;