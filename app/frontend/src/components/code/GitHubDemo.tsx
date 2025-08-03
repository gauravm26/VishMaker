import React from 'react';

const GitHubDemo: React.FC = () => {
  return (
    <div className="p-6 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-xl border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">GitHub Integration Features</h3>
      
      <div className="space-y-4 text-sm text-gray-300">
        <div className="flex items-start space-x-3">
          <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
          <div>
            <strong className="text-white">Repository Connection:</strong> Configure GitHub repository in Settings → GitHub Repository section
          </div>
        </div>
        
        <div className="flex items-start space-x-3">
          <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
          <div>
            <strong className="text-white">File Browser:</strong> Navigate through repository files and directories with an intuitive tree view
          </div>
        </div>
        
        <div className="flex items-start space-x-3">
          <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
          <div>
            <strong className="text-white">Syntax Highlighting:</strong> View code with proper syntax highlighting for 30+ programming languages
          </div>
        </div>
        
        <div className="flex items-start space-x-3">
          <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
          <div>
            <strong className="text-white">Branch Support:</strong> Switch between different branches to view code from specific versions
          </div>
        </div>
        
        <div className="flex items-start space-x-3">
          <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
          <div>
            <strong className="text-white">Direct GitHub Links:</strong> Click "View on GitHub" to open files directly on GitHub
          </div>
        </div>
        
        <div className="flex items-start space-x-3">
          <div className="w-2 h-2 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
          <div>
            <strong className="text-white">Settings Integration:</strong> All GitHub configuration is managed through the Settings panel
          </div>
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
        <h4 className="text-sm font-medium text-white mb-2">Supported Languages:</h4>
        <div className="grid grid-cols-3 gap-2 text-xs text-gray-400">
          <div>JavaScript/TypeScript</div>
          <div>Python</div>
          <div>Java</div>
          <div>C/C++</div>
          <div>PHP</div>
          <div>Ruby</div>
          <div>Go</div>
          <div>Rust</div>
          <div>Swift</div>
          <div>HTML/CSS</div>
          <div>JSON/YAML</div>
          <div>SQL</div>
          <div>Vue/Svelte</div>
          <div>Markdown</div>
          <div>Bash</div>
          <div>And more...</div>
        </div>
      </div>
    </div>
  );
};

export default GitHubDemo; 