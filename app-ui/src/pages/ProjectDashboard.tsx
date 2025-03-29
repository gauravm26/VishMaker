// app-ui/src/pages/ProjectDashboard.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react'; // Import useRef
import CreateProjectForm from '@features/project_management/ui/components/CreateProjectForm';
import ProjectList from '@features/project_management/ui/components/ProjectList';
import CanvasViewer from '@/components/canvas/CanvasViewer';

const ProjectDashboard: React.FC = () => {
    const [listRefreshKey, setListRefreshKey] = useState<number>(0);
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
    const [canvasRefreshNonce, setCanvasRefreshNonce] = useState<number>(0);
    const [generatingProjectId, setGeneratingProjectId] = useState<number | null>(null);

    // --- Use a ref to track the latest selectedProjectId for the async callback ---
    // This avoids issues with stale closures in handleGenerationComplete
    const selectedProjectIdRef = useRef<number | null>(null);
    // Keep ref updated whenever state changes
    useEffect(() => {
        selectedProjectIdRef.current = selectedProjectId;
    }, [selectedProjectId]);


    const triggerListRefresh = useCallback(() => {
        setListRefreshKey(prev => prev + 1);
    }, []);

    // Function to trigger canvas refresh nonce
    const triggerCanvasRefresh = useCallback(() => {
        setCanvasRefreshNonce(prev => prev + 1);
    }, []);

    const handleProjectCreated = useCallback(() => {
        console.log("Project created, triggering list refresh and clearing selection.");
        triggerListRefresh();
        setSelectedProjectId(null); // Clear selection state
        // No explicit canvas refresh needed, clearing projectId handles it in CanvasViewer
    }, [triggerListRefresh]);

    const handleProjectSelected = useCallback((projectId: number) => {
        // Only update state and trigger canvas refresh if the ID actually changes
        if (projectId !== selectedProjectIdRef.current) { // Use ref for comparison
            console.log(`Project selected: ${projectId}, setting state & triggering canvas nonce.`);
            setSelectedProjectId(projectId); // Set state
            triggerCanvasRefresh(); // Trigger canvas load
        } else {
             console.log(`Project ${projectId} re-selected, no state change needed.`);
        }
         // Clear generation state if user selects a different project while one is generating
         if (generatingProjectId !== null && generatingProjectId !== projectId) {
            console.warn(`Selection changed during generation of ${generatingProjectId}. Clearing generation state.`);
            setGeneratingProjectId(null);
        }
    }, [generatingProjectId, triggerCanvasRefresh]); // Remove selectedProjectId dep, use ref

    const handleStartGeneration = useCallback((projectId: number) => {
         console.log(`Setting generatingProjectId to: ${projectId}`);
         setGeneratingProjectId(projectId);
    }, []);

    // --- Modified Generation Complete Handler using Ref ---
    const handleGenerationComplete = useCallback((completedProjectId: number, success: boolean) => {
         // Read the LATEST selectedProjectId using the ref
         const currentSelectedId = selectedProjectIdRef.current;
         console.log(`Generation ${success ? 'complete' : 'failed'} for project ${completedProjectId}. Currently selected (via ref): ${currentSelectedId}`);

         // Clear the generating state for this project
         setGeneratingProjectId(currentGenerating => {
             return currentGenerating === completedProjectId ? null : currentGenerating;
         });

         // Trigger canvas refresh ONLY if successful AND the completed project IS the currently selected one
         if (success && completedProjectId === currentSelectedId) {
            console.log("Currently selected project generated successfully, triggering canvas refresh nonce.");
            triggerCanvasRefresh(); // Trigger refresh
         } else if (success) {
             console.log(`Generation complete for ${completedProjectId}, but ${currentSelectedId} is selected. No canvas refresh.`);
         } else {
             console.log(`Generation failed for ${completedProjectId}. No canvas refresh.`);
         }

    }, [triggerCanvasRefresh]); // Remove selectedProjectId dependency, rely on ref


    // --- JSX Layout (Keep layout fixes from before) ---
    return (
        <div className="flex flex-row h-screen w-screen overflow-hidden">
            {/* Left Pane */}
            <div className="w-1/4 p-4 border-r border-gray-200 dark:border-gray-700 flex flex-col gap-4 overflow-y-auto bg-gray-50 dark:bg-gray-800"> {/* Adjusted bg */}
            <h1 className="text-2xl font-bold text-center mb-2 dark:text-gray-100">Vishmaker</h1>
                <div>
                    <CreateProjectForm onProjectCreated={handleProjectCreated} />
                </div>
                <div className="flex-grow">
                    <ProjectList
                        onProjectSelect={handleProjectSelected}
                        refreshTrigger={listRefreshKey}
                        onStartGeneration={handleStartGeneration}
                        onGenerationComplete={handleGenerationComplete}
                        generatingProjectId={generatingProjectId}
                        selectedProjectId={selectedProjectId} // Still pass state for highlighting
                        triggerRefresh={triggerListRefresh} // Add new prop for refreshing after deletion
                    />
                </div>
            </div>
            {/* Right Pane */}
            <div className="w-3/4 p-4 flex flex-col overflow-hidden bg-white dark:bg-gray-900"> {/* Adjusted bg */}
            <h2 className="text-xl font-semibold mb-3 shrink-0 dark:text-gray-100">
                    Requirements Canvas {selectedProjectId !== null ? `(Project ${selectedProjectId})` : '(No project selected)'}
                </h2>
                <div className="flex-grow border rounded shadow-sm bg-gray-100 dark:bg-gray-800 relative overflow-hidden"> 
                    <CanvasViewer
                        projectId={selectedProjectId}
                        refreshTrigger={canvasRefreshNonce}
                    />
                </div>
            </div>
        </div>
    );
};

export default ProjectDashboard;