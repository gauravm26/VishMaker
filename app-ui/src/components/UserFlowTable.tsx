import React, { useEffect, useState } from 'react';
import apiClient from '../lib/apiClient';

export interface UserFlowStep {
    id: number;
    name: string;
    order: number;
}

export interface UserFlow {
    id: number;
    name: string;
    description: string;
    steps: UserFlowStep[];
    project_id: number;
    created_at: string;
}

interface ProjectRequirementsResponse {
    project_id: number;
    flows: UserFlow[];
}

interface UserFlowTableProps {
    projectId: number | null;
    refreshTrigger: number;
}

const UserFlowTable: React.FC<UserFlowTableProps> = ({ projectId, refreshTrigger }) => {
    const [userFlows, setUserFlows] = useState<UserFlow[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchUserFlows = async () => {
            if (!projectId) {
                // Clear the data if no project is selected
                setUserFlows([]);
                return;
            }

            setLoading(true);
            setError(null);
            
            try {
                const response = await apiClient<ProjectRequirementsResponse>(`/requirements/${projectId}`);
                setUserFlows(response.flows || []);
            } catch (err: any) {
                console.error('Error fetching user flows:', err);
                setError(err.message || 'Failed to fetch user flows');
                setUserFlows([]);
            } finally {
                setLoading(false);
            }
        };
        
        fetchUserFlows();
    }, [projectId, refreshTrigger]);

    if (loading) {
        return <div className="flex justify-center items-center p-4">Loading user flows...</div>;
    }

    if (error) {
        return <div className="text-red-500 p-4">{error}</div>;
    }

    if (!projectId) {
        return <div className="text-gray-500 p-4">Select a project to view user flows</div>;
    }

    if (userFlows.length === 0) {
        return <div className="text-gray-500 p-4">No user flows found for this project</div>;
    }

    return (
        <div className="overflow-auto">
            {userFlows.map((flow) => (
                <div key={flow.id} className="mb-6">
                    <h3 className="text-lg font-semibold mb-2">{flow.name}</h3>
                    {flow.description && <p className="text-sm text-gray-600 mb-3">{flow.description}</p>}
                    
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600">
                            <thead>
                                <tr className="bg-gray-100 dark:bg-gray-700">
                                    <th className="py-2 px-4 border-b text-left">Step</th>
                                    <th className="py-2 px-4 border-b text-left">Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {flow.steps.sort((a, b) => a.order - b.order).map((step) => (
                                    <tr key={step.id} className="border-b border-gray-200 dark:border-gray-700">
                                        <td className="py-2 px-4 font-medium">{step.name}</td>
                                        <td className="py-2 px-4">
                                            {/* We don't currently store description for steps, 
                                                this can be expanded in the future */}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default UserFlowTable; 