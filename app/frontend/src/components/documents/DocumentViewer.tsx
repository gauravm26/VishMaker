// app/frontend/src/components/documents/DocumentViewer.tsx
import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '@/utils/apiClient';
import GitHubService from '@/utils/githubService';

// Types
interface LowLevelRequirement {
  uiid: string;
  name: string;
  description: string;
  parent_uiid: string;
  id?: string;
  sno?: number;
}

interface GitHubSettings {
  repo: string;
  branch: string;
  token?: string;
}

interface MarkdownFile {
  name: string;
  path: string;
  content: string;
}

interface DocumentViewerProps {
  projectId: number | null;
  refreshTrigger?: number;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ 
  projectId, 
  refreshTrigger = 0 
}) => {
  // State management
  const [llrList, setLlrList] = useState<LowLevelRequirement[]>([]);
  const [selectedLlr, setSelectedLlr] = useState<LowLevelRequirement | null>(null);
  const [markdownFiles, setMarkdownFiles] = useState<MarkdownFile[]>([]);
  const [generatedDocument, setGeneratedDocument] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [llrLoading, setLlrLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [githubSettings, setGitHubSettings] = useState<GitHubSettings | null>(null);
  
  // Editing state
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editedDocument, setEditedDocument] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Load GitHub settings from localStorage
  const loadGitHubSettings = useCallback(() => {
    try {
      const savedSettings = localStorage.getItem('appSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.github?.repo && settings.github?.branch) {
          setGitHubSettings({
            repo: settings.github.repo,
            branch: settings.github.branch,
            token: settings.github.token
          });
          return true;
        }
      }
    } catch (error) {
      console.error('Failed to load GitHub settings:', error);
    }
    return false;
  }, []);

  // Fetch all Low Level Requirements for the project
  const fetchLowLevelRequirements = useCallback(async () => {
    if (!projectId) {
      setLlrList([]);
      return;
    }

    setLlrLoading(true);
    setError(null);

    try {
      console.log(`Fetching Low Level Requirements for project ${projectId}`);
      
      // Fetch all LLRs for the project using the existing API endpoint
      const response = await apiClient<LowLevelRequirement[]>(`/requirements/${projectId}/low-level-requirements`);
      
      console.log(`Fetched ${response.length} Low Level Requirements`);
      
      // Sort by sno or name
      const sortedLlrs = response.sort((a, b) => {
        if (a.sno && b.sno) return a.sno - b.sno;
        return a.name.localeCompare(b.name);
      });
      
      setLlrList(sortedLlrs);
      
      // Auto-select first LLR if none selected
      if (sortedLlrs.length > 0 && !selectedLlr) {
        setSelectedLlr(sortedLlrs[0]);
      }
      
    } catch (error: any) {
      console.error('Error fetching Low Level Requirements:', error);
      setError(`Failed to load Low Level Requirements: ${error.message || 'Unknown error'}`);
    } finally {
      setLlrLoading(false);
    }
  }, [projectId, selectedLlr]);

  // Fetch markdown files from GitHub repository
  const fetchMarkdownFiles = useCallback(async (llr: LowLevelRequirement) => {
    if (!githubSettings) {
      setError('GitHub settings not configured. Please configure repository settings first.');
      return;
    }

    setLoading(true);
    setError(null);
    setMarkdownFiles([]);
    setGeneratedDocument('');

    try {
      console.log(`Fetching markdown files for LLR: ${llr.name} from ${githubSettings.repo}/${githubSettings.branch}`);
      
      // Parse repo owner and name
      const repoInfo = GitHubService.parseRepoPath(githubSettings.repo);
      if (!repoInfo) {
        throw new Error('Invalid repository format. Expected format: owner/repo');
      }

      // Get repository contents recursively to find all .md files
      const allFiles = await getAllFilesRecursively(repoInfo.owner, repoInfo.repo, '', githubSettings.branch);
      
      // Filter for markdown files
      const mdFiles = allFiles.filter(file => 
        file.name.toLowerCase().endsWith('.md') && 
        file.type === 'file'
      );

      console.log(`Found ${mdFiles.length} markdown files`);

      // Fetch content for each markdown file
      const markdownContents: MarkdownFile[] = [];
      
      for (const file of mdFiles) {
        try {
          console.log(`Fetching content for: ${file.path}`);
          const content = await GitHubService.getRawFileContent(
            repoInfo.owner, 
            repoInfo.repo, 
            file.path, 
            githubSettings.branch
          );
          
          markdownContents.push({
            name: file.name,
            path: file.path,
            content: content
          });
        } catch (fileError) {
          console.warn(`Failed to fetch ${file.path}:`, fileError);
          // Continue with other files even if one fails
        }
      }

      setMarkdownFiles(markdownContents);
      
      // Generate comprehensive document
      const document = generateDetailedDocument(llr, markdownContents);
      setGeneratedDocument(document);
      
      console.log(`Successfully generated document with ${markdownContents.length} markdown files`);
      
    } catch (error: any) {
      console.error('Error fetching markdown files:', error);
      setError(`Failed to fetch documentation: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [githubSettings]);

  // Recursively get all files from GitHub repository
  const getAllFilesRecursively = async (
    owner: string, 
    repo: string, 
    path: string, 
    branch: string
  ): Promise<any[]> => {
    const contents = await GitHubService.getContents(owner, repo, path, branch);
    let allFiles: any[] = [];

    for (const item of contents) {
      if (item.type === 'file') {
        allFiles.push(item);
      } else if (item.type === 'dir') {
        // Recursively get files from subdirectories
        const subFiles = await getAllFilesRecursively(owner, repo, item.path, branch);
        allFiles = allFiles.concat(subFiles);
      }
    }

    return allFiles;
  };

  // Generate a detailed document from markdown files
  const generateDetailedDocument = (llr: LowLevelRequirement, mdFiles: MarkdownFile[]): string => {
    const sections: string[] = [];

    // Document header
    sections.push(`# Documentation for Low Level Requirement: ${llr.name}`);
    sections.push('');
    sections.push(`**Requirement ID:** ${llr.uiid}`);
    sections.push(`**Description:** ${llr.description || 'No description provided'}`);
    sections.push(`**Parent ID:** ${llr.parent_uiid}`);
    sections.push('');
    sections.push('---');
    sections.push('');

    // Table of contents
    sections.push('## Table of Contents');
    sections.push('');
    mdFiles.forEach((file, index) => {
      const title = file.name.replace('.md', '').replace(/[-_]/g, ' ');
      sections.push(`${index + 1}. [${title}](#${title.toLowerCase().replace(/\s+/g, '-')})`);
    });
    sections.push('');
    sections.push('---');
    sections.push('');

    // Document metadata
    sections.push('## Document Information');
    sections.push('');
    sections.push(`- **Generated on:** ${new Date().toLocaleString()}`);
    sections.push(`- **Repository:** ${githubSettings?.repo || 'Not specified'}`);
    sections.push(`- **Branch:** ${githubSettings?.branch || 'Not specified'}`);
    sections.push(`- **Total markdown files:** ${mdFiles.length}`);
    sections.push('');
    sections.push('---');
    sections.push('');

    // Include each markdown file as a section
    mdFiles.forEach((file, index) => {
      const title = file.name.replace('.md', '').replace(/[-_]/g, ' ');
      
      sections.push(`## ${index + 1}. ${title}`);
      sections.push('');
      sections.push(`**File:** \`${file.path}\``);
      sections.push('');
      
      // Clean up the markdown content
      let content = file.content;
      
      // Remove any existing top-level headers to avoid conflicts
      content = content.replace(/^# .+$/gm, (match) => `### ${match.substring(2)}`);
      
      sections.push(content);
      sections.push('');
      sections.push('---');
      sections.push('');
    });

    // Footer
    sections.push('## Summary');
    sections.push('');
    sections.push(`This document combines all available markdown documentation from the repository for the Low Level Requirement "${llr.name}". It includes ${mdFiles.length} documentation files providing comprehensive coverage of the implementation.`);
    sections.push('');
    sections.push('*This document was automatically generated by VishMaker.*');

    return sections.join('\n');
  };

  // Handle LLR selection
  const handleLlrSelection = useCallback((llr: LowLevelRequirement) => {
    setSelectedLlr(llr);
    setError(null);
    setIsEditMode(false);
    setHasUnsavedChanges(false);
    
    // Fetch markdown files for selected LLR
    if (githubSettings) {
      fetchMarkdownFiles(llr);
    }
  }, [githubSettings, fetchMarkdownFiles]);

  // Handle edit mode toggle
  const toggleEditMode = useCallback(() => {
    if (isEditMode) {
      // Exiting edit mode - check for unsaved changes
      if (hasUnsavedChanges) {
        const confirmExit = window.confirm(
          'You have unsaved changes. Are you sure you want to exit edit mode? Your changes will be lost.'
        );
        if (!confirmExit) return;
      }
      setIsEditMode(false);
      setEditedDocument('');
      setHasUnsavedChanges(false);
    } else {
      // Entering edit mode
      setIsEditMode(true);
      setEditedDocument(generatedDocument);
      setHasUnsavedChanges(false);
    }
  }, [isEditMode, hasUnsavedChanges, generatedDocument]);

  // Handle document content change
  const handleDocumentChange = useCallback((newContent: string) => {
    setEditedDocument(newContent);
    setHasUnsavedChanges(newContent !== generatedDocument);
  }, [generatedDocument]);

  // Save edited document
  const saveDocument = useCallback(() => {
    setGeneratedDocument(editedDocument);
    setHasUnsavedChanges(false);
    setIsEditMode(false);
    
    // Optional: Save to localStorage for persistence
    if (selectedLlr) {
      const cacheKey = `edited_document_${selectedLlr.uiid}`;
      localStorage.setItem(cacheKey, editedDocument);
      console.log(`Saved edited document for LLR ${selectedLlr.uiid}`);
    }
  }, [editedDocument, selectedLlr]);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmCancel = window.confirm(
        'Are you sure you want to cancel? Your changes will be lost.'
      );
      if (!confirmCancel) return;
    }
    
    setIsEditMode(false);
    setEditedDocument('');
    setHasUnsavedChanges(false);
  }, [hasUnsavedChanges]);

  // Load saved document from localStorage
  const loadSavedDocument = useCallback((llrUiid: string) => {
    try {
      const cacheKey = `edited_document_${llrUiid}`;
      const savedDocument = localStorage.getItem(cacheKey);
      if (savedDocument && savedDocument !== generatedDocument) {
        const useEdited = window.confirm(
          'A previously edited version of this document was found. Would you like to load it instead of the auto-generated version?'
        );
        if (useEdited) {
          setGeneratedDocument(savedDocument);
          console.log(`Loaded edited document for LLR ${llrUiid}`);
        }
      }
    } catch (error) {
      console.error('Failed to load saved document:', error);
    }
  }, [generatedDocument]);

  // Load data on component mount and when dependencies change
  useEffect(() => {
    const hasGitHubSettings = loadGitHubSettings();
    if (!hasGitHubSettings) {
      setError('GitHub repository settings not configured. Please configure your repository in Settings.');
    }
  }, [loadGitHubSettings]);

  useEffect(() => {
    fetchLowLevelRequirements();
  }, [fetchLowLevelRequirements, refreshTrigger]);

  // Auto-fetch documents when LLR or GitHub settings change
  useEffect(() => {
    if (selectedLlr && githubSettings) {
      fetchMarkdownFiles(selectedLlr);
    }
  }, [selectedLlr, githubSettings, fetchMarkdownFiles]);

  // Load saved document when generated document changes
  useEffect(() => {
    if (selectedLlr && generatedDocument) {
      loadSavedDocument(selectedLlr.uiid);
    }
  }, [selectedLlr, generatedDocument, loadSavedDocument]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditMode) {
        // Ctrl+S or Cmd+S to save
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
          event.preventDefault();
          if (hasUnsavedChanges) {
            saveDocument();
          }
        }
        // Escape to cancel
        else if (event.key === 'Escape') {
          event.preventDefault();
          cancelEdit();
        }
      }
      // Ctrl+E or Cmd+E to enter edit mode
      else if (selectedLlr && generatedDocument && (event.ctrlKey || event.metaKey) && event.key === 'e') {
        event.preventDefault();
        toggleEditMode();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditMode, hasUnsavedChanges, selectedLlr, generatedDocument, saveDocument, cancelEdit, toggleEditMode]);

  // Render configuration message
  const renderConfigMessage = () => (
    <div className="h-full flex items-center justify-center bg-[#0A071B]/90 backdrop-blur-sm">
      <div className="text-center max-w-md p-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Configure GitHub Repository</h3>
        <p className="text-gray-300 mb-4">
          To view documentation, please configure your GitHub repository settings first.
        </p>
        <button 
          onClick={() => {
            // This would typically open settings - for now just show a message
            alert('Please go to Settings to configure your GitHub repository.');
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Open Settings
        </button>
      </div>
    </div>
  );

  // Render error state
  const renderError = () => (
    <div className="h-full flex items-center justify-center bg-[#0A071B]/90 backdrop-blur-sm">
      <div className="text-center max-w-md p-8">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-red-300 mb-2">Error</h3>
        <p className="text-gray-300">{error}</p>
      </div>
    </div>
  );

  // Render loading state
  const renderLoading = () => (
    <div className="h-full flex items-center justify-center bg-[#0A071B]/90 backdrop-blur-sm">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent"></div>
        <p className="mt-2 text-white">Loading documentation...</p>
      </div>
    </div>
  );

  // Render empty state
  const renderEmptyState = () => (
    <div className="h-full flex items-center justify-center bg-[#0A071B]/90 backdrop-blur-sm">
      <div className="text-center">
        <p className="text-gray-300">
          {!projectId 
            ? 'Select a project to view documentation.' 
            : 'No Low Level Requirements found for this project.'
          }
        </p>
      </div>
    </div>
  );

  // Don't render if GitHub settings are not configured
  if (!githubSettings) {
    return renderConfigMessage();
  }

  // Show error state
  if (error && !loading) {
    return renderError();
  }

  // Show loading state
  if (loading || llrLoading) {
    return renderLoading();
  }

  // Show empty state
  if (!projectId || llrList.length === 0) {
    return renderEmptyState();
  }

  return (
    <div className="h-full flex bg-[#0A071B]">
      {/* Left Panel - LLR List */}
      <div className="w-80 min-w-80 bg-gray-900 border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-white font-semibold text-sm">Low Level Requirements</h3>
          <p className="text-xs text-gray-400 mt-1">{llrList.length} requirements found</p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {llrList.map((llr, index) => (
            <div
              key={llr.uiid || llr.id || index}
              onClick={() => handleLlrSelection(llr)}
              className={`p-4 border-b border-white/5 cursor-pointer transition-colors hover:bg-white/5 ${
                selectedLlr?.uiid === llr.uiid ? 'bg-purple-600/20 border-l-4 border-l-purple-500' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-white truncate">{llr.name}</h4>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{llr.description || 'No description'}</p>
                  <div className="flex items-center mt-2 text-xs text-gray-500">
                    <span className="bg-gray-700 px-2 py-1 rounded font-mono">{llr.uiid}</span>
                    {llr.sno && <span className="ml-2">#{llr.sno}</span>}
                  </div>
                </div>
                {selectedLlr?.uiid === llr.uiid && (
                  <div className="ml-2 flex-shrink-0">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Center Panel - Document Content */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Document Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                {selectedLlr ? `Documentation: ${selectedLlr.name}` : 'Select a requirement'}
                {isEditMode && (
                  <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">
                    Editing
                  </span>
                )}
                {hasUnsavedChanges && (
                  <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                    Unsaved Changes
                  </span>
                )}
              </h2>
              {selectedLlr && (
                <div className="flex items-center mt-1 text-sm text-gray-600">
                  <span className="bg-gray-200 px-2 py-1 rounded font-mono text-xs mr-2">
                    {selectedLlr.uiid}
                  </span>
                  <span>•</span>
                  <span className="ml-2">{markdownFiles.length} markdown files</span>
                  <span className="ml-2">•</span>
                  <span className="ml-2">{githubSettings.repo}/{githubSettings.branch}</span>
                </div>
              )}
            </div>
            {selectedLlr && (
              <div className="flex items-center space-x-2">
                {isEditMode ? (
                  <>
                    <button
                      onClick={saveDocument}
                      disabled={!hasUnsavedChanges}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save</span>
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Cancel</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={toggleEditMode}
                      disabled={!generatedDocument}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => selectedLlr && fetchMarkdownFiles(selectedLlr)}
                      disabled={loading}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50 flex items-center space-x-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Document Content */}
        <div className="flex-1 overflow-hidden">
          {selectedLlr ? (
            generatedDocument ? (
              isEditMode ? (
                /* Edit Mode - Large Textarea */
                <div className="h-full flex flex-col p-6">
                  <div className="flex-1 max-w-4xl mx-auto w-full">
                    <div className="h-full flex flex-col">
                      <div className="mb-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-medium text-gray-700">Edit Document (Markdown)</h3>
                          <div className="text-xs text-gray-500">
                            Use Markdown formatting. Changes are saved locally.
                          </div>
                        </div>
                      </div>
                      <textarea
                        value={editedDocument}
                        onChange={(e) => handleDocumentChange(e.target.value)}
                        className="flex-1 w-full p-4 border border-gray-300 rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white"
                        placeholder="Enter your document content in Markdown format..."
                        style={{ 
                          minHeight: '500px',
                          color: '#111827',
                          backgroundColor: '#ffffff'
                        }}
                      />
                      <div className="mt-4 text-xs text-gray-500">
                        💡 Keyboard shortcuts: <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl+S</kbd> to save, <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Esc</kbd> to cancel
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* View Mode - Rendered Markdown */
                <div className="h-full overflow-y-auto p-6">
                  <div className="max-w-4xl mx-auto">
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center text-sm text-blue-800">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        This document can be edited. Click the <strong>Edit</strong> button above or press <kbd className="px-1 py-0.5 bg-blue-200 rounded text-xs">Ctrl+E</kbd> to start editing.
                      </div>
                    </div>
                    <div className="prose prose-lg max-w-none">
                      {/* Simple markdown rendering - convert basic markdown to HTML */}
                      <div 
                        className="markdown-content"
                        dangerouslySetInnerHTML={{ 
                          __html: renderMarkdownToHtml(generatedDocument) 
                        }}
                      />
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent"></div>
                  <p className="mt-2 text-gray-600">Generating documentation...</p>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>Select a Low Level Requirement from the left panel to view its documentation</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom styles for markdown content */}
      <style>{`
        .markdown-content h1 { 
          font-size: 2rem; 
          font-weight: bold; 
          margin: 1.5rem 0 1rem 0; 
          color: #111827; 
          border-bottom: 2px solid #e5e7eb; 
          padding-bottom: 0.5rem;
        }
        .markdown-content h2 { 
          font-size: 1.5rem; 
          font-weight: bold; 
          margin: 1.25rem 0 0.75rem 0; 
          color: #1f2937; 
        }
        .markdown-content h3 { 
          font-size: 1.25rem; 
          font-weight: semibold; 
          margin: 1rem 0 0.5rem 0; 
          color: #374151; 
        }
        .markdown-content p { 
          margin: 0.75rem 0; 
          line-height: 1.6; 
          color: #1f2937; 
          font-size: 1rem;
        }
        .markdown-content ul, .markdown-content ol { 
          margin: 0.75rem 0; 
          padding-left: 1.5rem; 
        }
        .markdown-content li { 
          margin: 0.25rem 0; 
          color: #1f2937; 
          line-height: 1.5;
        }
        .markdown-content code { 
          background-color: #f3f4f6; 
          color: #1f2937;
          padding: 0.125rem 0.25rem; 
          border-radius: 0.25rem; 
          font-family: 'Courier New', monospace; 
          font-size: 0.875rem;
          border: 1px solid #e5e7eb;
        }
        .markdown-content pre { 
          background-color: #1f2937; 
          color: #f9fafb; 
          padding: 1rem; 
          border-radius: 0.5rem; 
          overflow-x: auto; 
          margin: 1rem 0; 
          border: 1px solid #374151;
        }
        .markdown-content pre code {
          background-color: transparent;
          color: #f9fafb;
          border: none;
          padding: 0;
        }
        .markdown-content blockquote { 
          border-left: 4px solid #8b5cf6; 
          padding-left: 1rem; 
          margin: 1rem 0; 
          font-style: italic; 
          color: #374151;
          background-color: #f8fafc;
          padding: 1rem;
          border-radius: 0.25rem;
        }
        .markdown-content hr { 
          border: none; 
          border-top: 1px solid #e5e7eb; 
          margin: 2rem 0; 
        }
        .markdown-content table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 1rem 0; 
          border: 1px solid #e5e7eb;
        }
        .markdown-content th, .markdown-content td { 
          border: 1px solid #e5e7eb; 
          padding: 0.75rem; 
          text-align: left; 
          color: #1f2937;
        }
        .markdown-content th { 
          background-color: #f9fafb; 
          font-weight: 600;
          color: #111827;
        }
        .markdown-content a {
          color: #3b82f6;
          text-decoration: underline;
          font-weight: 500;
        }
        .markdown-content a:hover {
          color: #1d4ed8;
          text-decoration: none;
        }
        .markdown-content strong {
          color: #111827;
          font-weight: 600;
        }
        .markdown-content em {
          color: #374151;
          font-style: italic;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

// Simple markdown to HTML converter
const renderMarkdownToHtml = (markdown: string): string => {
  let html = markdown;
  
  // Headers
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  
  // Bold and italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Code blocks
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const content = match.replace(/```(\w+)?\n?/, '').replace(/```$/, '');
    return `<pre><code>${content}</code></pre>`;
  });
  
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  
  // Lists
  html = html.replace(/^\* (.*$)/gm, '<li>$1</li>');
  html = html.replace(/^\d+\. (.*$)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
  
  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  
  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');
  
  // Wrap in paragraphs
  html = `<p>${html}</p>`;
  
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[1-6]>)/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
  html = html.replace(/<p>(<ul>)/g, '$1');
  html = html.replace(/(<\/ul>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre>)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  
  return html;
};

export default DocumentViewer;
