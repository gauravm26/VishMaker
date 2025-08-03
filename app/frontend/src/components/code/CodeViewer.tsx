import React, { useState, useEffect } from 'react';
import GitHubService, { GitHubFile } from '../../lib/githubService';
import SyntaxHighlighter from './SyntaxHighlighter';

interface CodeViewerProps {
  owner: string;
  repo: string;
  branch: string;
  initialPath?: string;
  onError?: (error: string) => void;
  refreshTrigger?: number;
}

interface FileTreeItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children?: FileTreeItem[];
}

const CodeViewer: React.FC<CodeViewerProps> = ({ 
  owner, 
  repo, 
  branch, 
  initialPath = '',
  onError,
  refreshTrigger = 0
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [fileTree, setFileTree] = useState<FileTreeItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Load repository contents
  useEffect(() => {
    loadContents(currentPath);
  }, [currentPath, owner, repo, branch]);

  // Handle refresh trigger
  useEffect(() => {
    if (refreshTrigger > 0) {
      loadContents(currentPath);
    }
  }, [refreshTrigger]);

  const loadContents = async (path: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const contents = await GitHubService.getContents(owner, repo, path, branch);
      
      // Convert to tree structure
      const treeItems: FileTreeItem[] = contents.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type,
        children: item.type === 'dir' ? [] : undefined
      }));
      
      setFileTree(treeItems);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load contents';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadFileContent = async (filePath: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const content = await GitHubService.getRawFileContent(owner, repo, filePath, branch);
      setFileContent(content);
      setSelectedFile(filePath);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load file content';
      setError(errorMessage);
      if (onError) {
        onError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileClick = (file: FileTreeItem) => {
    if (file.type === 'file') {
      loadFileContent(file.path);
    } else {
      // Toggle directory expansion
      const newExpanded = new Set(expandedDirs);
      if (newExpanded.has(file.path)) {
        newExpanded.delete(file.path);
      } else {
        newExpanded.add(file.path);
      }
      setExpandedDirs(newExpanded);
      
      // Navigate to directory
      setCurrentPath(file.path);
    }
  };

  const handleBreadcrumbClick = (path: string) => {
    setCurrentPath(path);
  };

  const getBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'root', path: '' }];
    
    let currentPathStr = '';
    parts.forEach(part => {
      currentPathStr += `/${part}`;
      breadcrumbs.push({ name: part, path: currentPathStr });
    });
    
    return breadcrumbs;
  };

  const getFileIcon = (file: FileTreeItem) => {
    if (file.type === 'dir') {
      return (
        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      );
    }
    
    const ext = GitHubService.getFileExtension(file.name);
    const isCode = GitHubService.isCodeFile(file.name);
    
    if (isCode) {
      return (
        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      );
    }
    
    return (
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  const renderFileTree = (items: FileTreeItem[]) => {
    return items.map((item, index) => (
      <div key={item.path} className="w-full">
        <button
          onClick={() => handleFileClick(item)}
          className={`w-full flex items-center px-3 py-2 text-sm hover:bg-white/5 rounded-lg transition-colors ${
            selectedFile === item.path ? 'bg-purple-500/20 text-purple-300' : 'text-gray-300'
          }`}
        >
          {getFileIcon(item)}
          <span className="ml-2 truncate">{item.name}</span>
        </button>
      </div>
    ));
  };

  const renderCodeContent = () => {
    if (!selectedFile) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          <div className="text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>Select a file to view its content</p>
          </div>
        </div>
      );
    }

    const language = GitHubService.getLanguageFromExtension(selectedFile);
    
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center space-x-2">
            {getFileIcon({ name: selectedFile.split('/').pop() || '', path: selectedFile, type: 'file' })}
            <span className="text-sm font-medium text-white">{selectedFile.split('/').pop()}</span>
            <span className="text-xs text-gray-400">({language})</span>
          </div>
          <a
            href={`https://github.com/${owner}/${repo}/blob/${branch}/${selectedFile}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            View on GitHub
          </a>
        </div>
        <div className="flex-1 overflow-auto">
          <SyntaxHighlighter
            code={fileContent}
            language={language}
            className="p-4 text-sm font-mono leading-relaxed"
          />
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-400 mb-2">Error loading repository</p>
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* File Tree Sidebar */}
      <div className="w-80 border-r border-white/10 flex flex-col">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-sm font-medium text-white mb-2">Repository</h3>
          <div className="text-xs text-gray-400">
            {owner}/{repo}
          </div>
          <div className="text-xs text-gray-500">
            Branch: {branch}
          </div>
        </div>
        
        {/* Breadcrumbs */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center space-x-1 text-xs">
            {getBreadcrumbs().map((crumb, index) => (
              <React.Fragment key={crumb.path}>
                {index > 0 && (
                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                <button
                  onClick={() => handleBreadcrumbClick(crumb.path)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>
        
        {/* File List */}
        <div className="flex-1 overflow-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-400"></div>
            </div>
          ) : (
            <div className="space-y-1">
              {renderFileTree(fileTree)}
            </div>
          )}
        </div>
      </div>
      
      {/* Code Content */}
      <div className="flex-1 bg-[#0A071B]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
          </div>
        ) : (
          renderCodeContent()
        )}
      </div>
    </div>
  );
};

export default CodeViewer; 