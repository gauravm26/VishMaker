import React from 'react';
import Modal from '../shared/Modal';

interface BuildSummaryData {
    lowLevelRequirementId: string;
    status: string;
    branchLink: string;
    prLink: string;
    documentLinks: string[];
    keyMetrics: string;
    dashboardLinks: string[];
    alerts: string;
    logs: string;
    productManager: string;
    devManager: string;
}

interface BuildSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    buildSummaryData: BuildSummaryData | null;
    setBuildSummaryData: React.Dispatch<React.SetStateAction<BuildSummaryData | null>>;
    editingField: string | null;
    editValue: string;
    startEditing: (field: string, value: string) => void;
    saveEdit: () => void;
    cancelEdit: () => void;
}

const BuildSummaryModal: React.FC<BuildSummaryModalProps> = ({
    isOpen,
    onClose,
    buildSummaryData,
    setBuildSummaryData,
    editingField,
    editValue,
    startEditing,
    saveEdit,
    cancelEdit
}) => {
    if (!buildSummaryData) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Build Summary"
            size="xl"
        >
            <div className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-white/90 mb-2">
                            Low Level Requirement ID
                        </label>
                        <div className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-mono text-sm">
                            {buildSummaryData.lowLevelRequirementId}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white/90 mb-2">
                            Status
                        </label>
                        <div className="relative">
                            <select
                                value={buildSummaryData.status}
                                onChange={(e) => setBuildSummaryData(prev => prev ? {...prev, status: e.target.value} : null)}
                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                            >
                                <option value="Build In Progress" className="bg-gray-800">Build In Progress</option>
                                <option value="Build Complete" className="bg-gray-800">Build Complete</option>
                                <option value="PR" className="bg-gray-800">PR</option>
                                <option value="Merged" className="bg-gray-800">Merged</option>
                                <option value="Deployed Dev" className="bg-gray-800">Deployed Dev</option>
                                <option value="Deployed Test" className="bg-gray-800">Deployed Test</option>
                                <option value="Deployed Prod" className="bg-gray-800">Deployed Prod</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Build and Deploy */}
                <div className="border-t border-white/10 pt-4">
                    <h3 className="text-lg font-medium text-white flex items-center mb-3">
                        <svg className="w-5 h-5 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        Build and Deploy
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-white/90 mb-2">
                                Branch Link
                            </label>
                            <div className="relative group">
                                {editingField === 'branchLink' ? (
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setBuildSummaryData(prev => prev ? {...prev, branchLink: e.target.value} : null)}
                                            className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveEdit();
                                                if (e.key === 'Escape') cancelEdit();
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            onClick={saveEdit}
                                            className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded transition-colors"
                                            title="Save"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={cancelEdit}
                                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                                            title="Cancel"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white break-all text-sm">
                                            {buildSummaryData.branchLink}
                                        </div>
                                        <button
                                            onClick={() => startEditing('branchLink', buildSummaryData.branchLink)}
                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 text-white/40 hover:text-white/90 hover:bg-white/20 rounded transition-all duration-200 opacity-0 group-hover:opacity-100"
                                            title="Edit branch link"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-white/90 mb-2">
                                PR Link
                            </label>
                            <div className="relative group">
                                {editingField === 'prLink' ? (
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setBuildSummaryData(prev => prev ? {...prev, prLink: e.target.value} : null)}
                                            className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveEdit();
                                                if (e.key === 'Escape') cancelEdit();
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            onClick={saveEdit}
                                            className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded transition-colors"
                                            title="Save"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={cancelEdit}
                                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                                            title="Cancel"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white break-all text-sm">
                                            {buildSummaryData.prLink}
                                        </div>
                                        <button
                                            onClick={() => startEditing('prLink', buildSummaryData.prLink)}
                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 text-white/40 hover:text-white/90 hover:bg-white/20 rounded transition-all duration-200 opacity-0 group-hover:opacity-100"
                                            title="Edit PR link"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Documents */}
                <div className="border-t border-white/10 pt-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-semibold text-white flex items-center">
                            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            Project Documentation
                        </h3>
                        <button
                            onClick={() => {
                                const newLinks = [...buildSummaryData.documentLinks, ''];
                                setBuildSummaryData(prev => prev ? {...prev, documentLinks: newLinks} : null);
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl transition-all duration-300 flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            <span>Add Document</span>
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        {buildSummaryData.documentLinks.map((link, index) => (
                            <div key={index} className="group">
                                {editingField === `doc_${index}` ? (
                                    <div className="flex items-center space-x-3">
                                        <div className="flex-1">
                                            <input
                                                type="text"
                                                value={editValue}
                                                onChange={(e) => {
                                                    const newLinks = [...buildSummaryData.documentLinks];
                                                    newLinks[index] = e.target.value;
                                                    setBuildSummaryData(prev => prev ? {...prev, documentLinks: newLinks} : null);
                                                }}
                                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-400/50 transition-all duration-300 backdrop-blur-sm"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveEdit();
                                                    if (e.key === 'Escape') cancelEdit();
                                                }}
                                                autoFocus
                                                placeholder="Enter document URL..."
                                            />
                                        </div>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={saveEdit}
                                                className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center space-x-1"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                <span>Save</span>
                                            </button>
                                            <button
                                                onClick={cancelEdit}
                                                className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center space-x-1"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                <span>Cancel</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-gradient-to-r from-white/5 to-white/10 border border-white/20 rounded-xl p-4 hover:from-white/10 hover:to-white/15 transition-all duration-300 group-hover:shadow-lg">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                    </svg>
                                                </div>
                                                <div className="text-white text-sm font-medium break-all">
                                                    {link}
                                                </div>
                                            </div>
                                            <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                <button
                                                    onClick={() => startEditing(`doc_${index}`, link)}
                                                    className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded-lg transition-colors"
                                                    title="Edit document link"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const newLinks = buildSummaryData.documentLinks.filter((_, i) => i !== index);
                                                        setBuildSummaryData(prev => prev ? {...prev, documentLinks: newLinks} : null);
                                                    }}
                                                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                                                    title="Remove document link"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Monitoring */}
                <div className="border-t border-white/10 pt-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-semibold text-white flex items-center">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            System Monitoring & Analytics
                        </h3>
                    </div>
                    <div className="space-y-4">
                        <div className="bg-gradient-to-r from-white/5 to-white/10 border border-white/20 rounded-xl p-6 group">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-medium text-white flex items-center">
                                    <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center mr-3">
                                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                    </div>
                                    Key Performance Indicators
                                </h4>
                                <button
                                    onClick={() => startEditing('keyMetrics', buildSummaryData.keyMetrics)}
                                    className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    title="Edit key metrics"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                            </div>
                            
                            {editingField === 'keyMetrics' ? (
                                <div className="space-y-3">
                                    <textarea
                                        value={editValue}
                                        onChange={(e) => setBuildSummaryData(prev => prev ? {...prev, keyMetrics: e.target.value} : null)}
                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50 transition-all duration-300 backdrop-blur-sm min-h-[100px] resize-none"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && e.ctrlKey) saveEdit();
                                            if (e.key === 'Escape') cancelEdit();
                                        }}
                                        autoFocus
                                        placeholder="Describe your key performance indicators..."
                                    />
                                    <div className="flex justify-end space-x-2">
                                        <button
                                            onClick={saveEdit}
                                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center space-x-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>Save (Ctrl+Enter)</span>
                                        </button>
                                        <button
                                            onClick={cancelEdit}
                                            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center space-x-1"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            <span>Cancel (Esc)</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">
                                    {buildSummaryData.keyMetrics}
                                </div>
                            )}
                        </div>
                        
                        <div className="bg-gradient-to-r from-white/5 to-white/10 border border-white/20 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-lg font-medium text-white flex items-center">
                                    <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center mr-3">
                                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                    </div>
                                    Monitoring Dashboards
                                </h4>
                                <button
                                    onClick={() => {
                                        const newLinks = [...buildSummaryData.dashboardLinks, ''];
                                        setBuildSummaryData(prev => prev ? {...prev, dashboardLinks: newLinks} : null);
                                    }}
                                    className="px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors flex items-center space-x-1"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    <span>Add Dashboard</span>
                                </button>
                            </div>
                            
                            <div className="space-y-3">
                                {buildSummaryData.dashboardLinks.map((link, index) => (
                                    <div key={index} className="group">
                                        {editingField === `dashboard_${index}` ? (
                                            <div className="flex items-center space-x-3">
                                                <div className="flex-1">
                                                    <input
                                                        type="text"
                                                        value={editValue}
                                                        onChange={(e) => {
                                                            const newLinks = [...buildSummaryData.dashboardLinks];
                                                            newLinks[index] = e.target.value;
                                                            setBuildSummaryData(prev => prev ? {...prev, dashboardLinks: newLinks} : null);
                                                        }}
                                                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') saveEdit();
                                                            if (e.key === 'Escape') cancelEdit();
                                                        }}
                                                        autoFocus
                                                        placeholder="Enter dashboard URL..."
                                                    />
                                                </div>
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={saveEdit}
                                                        className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center space-x-1"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                        <span>Save</span>
                                                    </button>
                                                    <button
                                                        onClick={cancelEdit}
                                                        className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center space-x-1"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                        <span>Cancel</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-white/5 border border-white/20 rounded-lg p-3 hover:bg-white/10 transition-all duration-300 group-hover:shadow-md">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="w-6 h-6 bg-purple-500/20 rounded-md flex items-center justify-center">
                                                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                            </svg>
                                                        </div>
                                                        <div className="text-white text-sm font-medium break-all">
                                                            {link}
                                                        </div>
                                                    </div>
                                                    <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                        <button
                                                            onClick={() => startEditing(`dashboard_${index}`, link)}
                                                            className="p-1.5 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 rounded transition-colors"
                                                            title="Edit dashboard link"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const newLinks = buildSummaryData.dashboardLinks.filter((_, i) => i !== index);
                                                                setBuildSummaryData(prev => prev ? {...prev, dashboardLinks: newLinks} : null);
                                                            }}
                                                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                                                            title="Remove dashboard link"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-white/90 mb-2">
                                    Alerts
                                </label>
                                <div className="relative group">
                                    {editingField === 'alerts' ? (
                                        <div className="space-y-2">
                                            <textarea
                                                value={editValue}
                                                onChange={(e) => setBuildSummaryData(prev => prev ? {...prev, alerts: e.target.value} : null)}
                                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm min-h-[80px] resize-none"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && e.ctrlKey) saveEdit();
                                                    if (e.key === 'Escape') cancelEdit();
                                                }}
                                                autoFocus
                                            />
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={saveEdit}
                                                    className="px-3 py-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded transition-colors text-sm"
                                                >
                                                    Save (Ctrl+Enter)
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors text-sm"
                                                >
                                                    Cancel (Esc)
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white min-h-[80px] whitespace-pre-wrap text-sm">
                                                {buildSummaryData.alerts}
                                            </div>
                                            <button
                                                onClick={() => startEditing('alerts', buildSummaryData.alerts)}
                                                className="absolute right-2 top-2 p-1.5 text-white/40 hover:text-white/90 hover:bg-white/20 rounded transition-all duration-200 opacity-0 group-hover:opacity-100"
                                                title="Edit alerts"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-white/90 mb-2">
                                    Logs
                                </label>
                                <div className="relative group">
                                    {editingField === 'logs' ? (
                                        <div className="space-y-2">
                                            <textarea
                                                value={editValue}
                                                onChange={(e) => setBuildSummaryData(prev => prev ? {...prev, logs: e.target.value} : null)}
                                                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm min-h-[80px] resize-none"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && e.ctrlKey) saveEdit();
                                                    if (e.key === 'Escape') cancelEdit();
                                                }}
                                                autoFocus
                                            />
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={saveEdit}
                                                    className="px-3 py-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded transition-colors text-sm"
                                                >
                                                    Save (Ctrl+Enter)
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors text-sm"
                                                >
                                                    Cancel (Esc)
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white min-h-[80px] whitespace-pre-wrap text-sm">
                                                {buildSummaryData.logs}
                                            </div>
                                            <button
                                                onClick={() => startEditing('logs', buildSummaryData.logs)}
                                                className="absolute right-2 top-2 p-1.5 text-white/40 hover:text-white/90 hover:bg-white/20 rounded transition-all duration-200 opacity-0 group-hover:opacity-100"
                                                title="Edit logs"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Performance Metrics Charts */}
                        <div className="mt-6">
                            <h4 className="text-md font-medium text-white/90 mb-4">Performance Metrics (Last 7 Days)</h4>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Response Time Chart */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <h5 className="text-sm font-medium text-white/80 mb-3">Response Time (ms)</h5>
                                    <div className="h-32 relative">
                                        <svg className="w-full h-full" viewBox="0 0 300 120" preserveAspectRatio="none">
                                            {/* Grid lines */}
                                            <defs>
                                                <pattern id="grid" width="50" height="20" patternUnits="userSpaceOnUse">
                                                    <path d="M 50 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
                                                </pattern>
                                            </defs>
                                            <rect width="100%" height="100%" fill="url(#grid)" />
                                            
                                            {/* Y-axis labels */}
                                            <text x="5" y="15" fill="rgba(255,255,255,0.6)" fontSize="12">200</text>
                                            <text x="5" y="35" fill="rgba(255,255,255,0.6)" fontSize="12">150</text>
                                            <text x="5" y="55" fill="rgba(255,255,255,0.6)" fontSize="12">100</text>
                                            <text x="5" y="75" fill="rgba(255,255,255,0.6)" fontSize="12">50</text>
                                            <text x="5" y="95" fill="rgba(255,255,255,0.6)" fontSize="12">0</text>
                                            
                                            {/* X-axis labels */}
                                            <text x="50" y="115" fill="rgba(255,255,255,0.6)" fontSize="12">Mon</text>
                                            <text x="100" y="115" fill="rgba(255,255,255,0.6)" fontSize="12">Tue</text>
                                            <text x="150" y="115" fill="rgba(255,255,255,0.6)" fontSize="12">Wed</text>
                                            <text x="200" y="115" fill="rgba(255,255,255,0.6)" fontSize="12">Thu</text>
                                            <text x="250" y="115" fill="rgba(255,255,255,0.6)" fontSize="12">Fri</text>
                                            <text x="300" y="115" fill="rgba(255,255,255,0.6)" fontSize="12">Sat</text>
                                            
                                            {/* Response Time Line */}
                                            <path
                                                d="M 0 60 L 50 45 L 100 35 L 150 55 L 200 25 L 250 40 L 300 30"
                                                fill="none"
                                                stroke="#60A5FA"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                            
                                            {/* Data points */}
                                            <circle cx="0" cy="60" r="3" fill="#60A5FA" />
                                            <circle cx="50" cy="45" r="3" fill="#60A5FA" />
                                            <circle cx="100" cy="35" r="3" fill="#60A5FA" />
                                            <circle cx="150" cy="55" r="3" fill="#60A5FA" />
                                            <circle cx="200" cy="25" r="3" fill="#60A5FA" />
                                            <circle cx="250" cy="40" r="3" fill="#60A5FA" />
                                            <circle cx="300" cy="30" r="3" fill="#60A5FA" />
                                        </svg>
                                    </div>
                                    <div className="mt-2 text-xs text-white/60">
                                        <span className="text-green-400">↓ 12%</span> from last week
                                    </div>
                                </div>
                                
                                {/* Error Rate Chart */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <h5 className="text-sm font-medium text-white/80 mb-3">Error Rate (%)</h5>
                                    <div className="h-32 relative">
                                        <svg className="w-full h-full" viewBox="0 0 300 120" preserveAspectRatio="none">
                                            {/* Grid lines */}
                                            <defs>
                                                <pattern id="grid2" width="50" height="20" patternUnits="userSpaceOnUse">
                                                    <path d="M 50 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"/>
                                                </pattern>
                                            </defs>
                                            <rect width="100%" height="100%" fill="url(#grid2)" />
                                            
                                            {/* Y-axis labels */}
                                            <text x="5" y="15" fill="rgba(255,255,255,0.6)" fontSize="12">5.0</text>
                                            <text x="5" y="35" fill="rgba(255,255,255,0.6)" fontSize="12">4.0</text>
                                            <text x="5" y="55" fill="rgba(255,255,255,0.6)" fontSize="12">3.0</text>
                                            <text x="5" y="75" fill="rgba(255,255,255,0.6)" fontSize="12">2.0</text>
                                            <text x="5" y="95" fill="rgba(255,255,255,0.6)" fontSize="12">1.0</text>
                                            
                                            {/* X-axis labels */}
                                            <text x="50" y="115" fill="rgba(255,255,255,0.6)" fontSize="12">Mon</text>
                                            <text x="100" y="115" fill="rgba(255,255,255,0.6)" fontSize="12">Tue</text>
                                            <text x="150" y="115" fill="rgba(255,255,255,0.6)" fontSize="12">Wed</text>
                                            <text x="200" y="115" fill="rgba(255,255,255,0.6)" fontSize="12">Thu</text>
                                            <text x="250" y="115" fill="rgba(255,255,255,0.6)" fontSize="12">Fri</text>
                                            <text x="300" y="115" fill="rgba(255,255,255,0.6)" fontSize="12">Sat</text>
                                            
                                            {/* Error Rate Line */}
                                            <path
                                                d="M 0 80 L 50 70 L 100 85 L 150 65 L 200 90 L 250 75 L 300 60"
                                                fill="none"
                                                stroke="#F87171"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                            
                                            {/* Data points */}
                                            <circle cx="0" cy="80" r="3" fill="#F87171" />
                                            <circle cx="50" cy="70" r="3" fill="#F87171" />
                                            <circle cx="100" cy="85" r="3" fill="#F87171" />
                                            <circle cx="150" cy="65" r="3" fill="#F87171" />
                                            <circle cx="200" cy="90" r="3" fill="#F87171" />
                                            <circle cx="250" cy="75" r="3" fill="#F87171" />
                                            <circle cx="300" cy="60" r="3" fill="#F87171" />
                                        </svg>
                                    </div>
                                    <div className="mt-2 text-xs text-white/60">
                                        <span className="text-green-400">↓ 8%</span> from last week
                                    </div>
                                </div>
                            </div>
                            
                            {/* Additional Metrics Summary */}
                            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                                    <div className="text-lg font-semibold text-green-400">99.2%</div>
                                    <div className="text-xs text-white/60">Uptime</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                                    <div className="text-lg font-semibold text-blue-400">245ms</div>
                                    <div className="text-xs text-white/60">Avg Response</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                                    <div className="text-lg font-semibold text-yellow-400">2.1%</div>
                                    <div className="text-xs text-white/60">Error Rate</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                                    <div className="text-lg font-semibold text-purple-400">1.2K</div>
                                    <div className="text-xs text-white/60">Requests/min</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Owners */}
                <div className="border-t border-white/10 pt-4">
                    <h3 className="text-lg font-medium text-white flex items-center mb-3">
                        <svg className="w-5 h-5 mr-2 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                        </svg>
                        Owners
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-white/90 mb-2">
                                Product Manager
                            </label>
                            <div className="relative group">
                                {editingField === 'productManager' ? (
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setBuildSummaryData(prev => prev ? {...prev, productManager: e.target.value} : null)}
                                            className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveEdit();
                                                if (e.key === 'Escape') cancelEdit();
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            onClick={saveEdit}
                                            className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded transition-colors"
                                            title="Save"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={cancelEdit}
                                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                                            title="Cancel"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm">
                                            {buildSummaryData.productManager}
                                        </div>
                                        <button
                                            onClick={() => startEditing('productManager', buildSummaryData.productManager)}
                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 text-white/40 hover:text-white/90 hover:bg-white/20 rounded transition-all duration-200 opacity-0 group-hover:opacity-100"
                                            title="Edit product manager"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-white/90 mb-2">
                                Dev Manager
                            </label>
                            <div className="relative group">
                                {editingField === 'devManager' ? (
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setBuildSummaryData(prev => prev ? {...prev, devManager: e.target.value} : null)}
                                            className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-400/50 transition-all duration-300 backdrop-blur-sm"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveEdit();
                                                if (e.key === 'Escape') cancelEdit();
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            onClick={saveEdit}
                                            className="p-1.5 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded transition-colors"
                                            title="Save"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={cancelEdit}
                                            className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors"
                                            title="Cancel"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white text-sm">
                                            {buildSummaryData.devManager}
                                        </div>
                                        <button
                                            onClick={() => startEditing('devManager', buildSummaryData.devManager)}
                                            className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1.5 text-white/40 hover:text-white/90 hover:bg-white/20 rounded transition-all duration-200 opacity-0 group-hover:opacity-100"
                                            title="Edit dev manager"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="border-t border-white/10 pt-4 flex justify-end space-x-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 text-sm font-medium text-white/70 hover:text-white border border-white/20 rounded-lg hover:bg-white/5 transition-all duration-300"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            // Here you can add logic to save the build summary data
                            console.log('Build Summary Data:', buildSummaryData);
                            onClose();
                        }}
                        className="px-6 py-2 text-sm font-semibold bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white shadow-lg hover:shadow-purple-500/25 rounded-lg transition-all duration-300"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default BuildSummaryModal;
