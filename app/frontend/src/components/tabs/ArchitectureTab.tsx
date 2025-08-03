import React from 'react';

interface ArchitectureTabProps {
    projectId: number | null;
}

const ArchitectureTab: React.FC<ArchitectureTabProps> = ({ projectId }) => {
    return (
        <div className="h-full w-full flex items-center justify-center p-8">
            <div className="text-center max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-full flex items-center justify-center border border-white/10 backdrop-blur-lg">
                    <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-4">Architecture View</h3>
                <p className="text-gray-300 mb-8 leading-relaxed">
                    Architecture diagrams and system design will be displayed here.
                    This view will show the technical architecture, infrastructure, and system components.
                </p>
                <div className="bg-white/5 backdrop-blur-lg rounded-xl p-4 border border-white/10">
                    <p className="text-sm text-gray-400">
                        Coming soon: Interactive architecture diagrams, system design tools, and infrastructure visualization.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ArchitectureTab; 