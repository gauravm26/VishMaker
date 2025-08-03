import React from 'react';
import CanvasViewer from '../canvas/CanvasViewer';

interface RequirementsTabProps {
    projectId: number | null;
    refreshTrigger: number;
    onToggleSidebar?: () => void;
}

const RequirementsTab: React.FC<RequirementsTabProps> = ({ projectId, refreshTrigger, onToggleSidebar }) => {
    return (
        <div className="h-full w-full">
            <CanvasViewer
                projectId={projectId}
                refreshTrigger={refreshTrigger}
                onToggleSidebar={onToggleSidebar}
            />
        </div>
    );
};

export default RequirementsTab; 