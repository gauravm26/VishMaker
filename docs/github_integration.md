# GitHub Integration

The Code tab now supports direct GitHub repository integration, allowing users to view and explore code from any public GitHub repository directly within the application.

## Features

### 🔗 Repository Connection
- Connect any public GitHub repository using the `owner/repository` format
- Support for different branches (default: `main`)
- Automatic repository validation and error handling

### 📁 File Browser
- Intuitive file tree navigation
- Breadcrumb navigation for easy directory traversal
- File type icons for quick identification
- Support for both files and directories

### 🎨 Syntax Highlighting
- Support for 30+ programming languages
- Custom dark theme optimized for the application
- Proper code formatting and indentation
- Language detection based on file extensions

### 🔄 Branch Support
- Switch between different repository branches
- View code from specific versions or feature branches
- Branch selection in settings

### 🔗 Direct GitHub Links
- "View on GitHub" button for each file
- Direct links to GitHub's web interface
- Maintains context and line numbers

## Supported Languages

The syntax highlighter supports the following programming languages:

- **JavaScript/TypeScript**: `.js`, `.jsx`, `.ts`, `.tsx`
- **Python**: `.py`
- **Java**: `.java`
- **C/C++**: `.c`, `.cpp`
- **C#**: `.cs`
- **PHP**: `.php`
- **Ruby**: `.rb`
- **Go**: `.go`
- **Rust**: `.rs`
- **Swift**: `.swift`
- **Kotlin**: `.kt`
- **Scala**: `.scala`
- **HTML/CSS**: `.html`, `.css`, `.scss`, `.sass`, `.less`
- **JSON/YAML**: `.json`, `.xml`, `.yaml`, `.yml`
- **Markdown**: `.md`
- **Shell Scripts**: `.sh`, `.bash`, `.zsh`, `.fish`
- **SQL**: `.sql`
- **Vue/Svelte**: `.vue`, `.svelte`
- **Astro**: `.astro`

## Usage

### Setting Up GitHub Integration

1. **Open Settings**: Click the settings icon in the application
2. **GitHub Section**: Navigate to the GitHub Repository section
3. **Enter Repository Path**: Fill in your GitHub repository in the format `owner/repository`
4. **Select Branch**: Choose the branch you want to view (default: `main`)
5. **Save Settings**: Click "Save Settings" to store your GitHub configuration
6. **Navigate to Code Tab**: Open any project and go to the Code tab
7. **Start Exploring**: Browse files and view code with syntax highlighting

### File Navigation

- **File Tree**: Click on files to view their content
- **Directories**: Click on folders to navigate deeper
- **Breadcrumbs**: Use breadcrumb navigation to go back to parent directories
- **File Icons**: Different icons indicate file types (code files, documents, etc.)

### Code Viewing

- **Syntax Highlighting**: Code is automatically highlighted based on file type
- **Scroll Support**: Long files can be scrolled horizontally and vertically
- **GitHub Links**: Click "View on GitHub" to open the file on GitHub
- **Language Detection**: The system automatically detects the programming language

## Technical Implementation

### Architecture

```
CodeTab
├── GitHubService (API calls)
├── CodeViewer (File browser + code display)
├── SyntaxHighlighter (Prism.js integration)
└── GitHubDemo (Feature showcase)
```

### Key Components

1. **GitHubService** (`src/lib/githubService.ts`)
   - Handles all GitHub API interactions
   - Repository validation and content fetching
   - File type detection and language mapping

2. **CodeViewer** (`src/components/code/CodeViewer.tsx`)
   - Main file browser interface
   - File tree navigation
   - Code content display

3. **SyntaxHighlighter** (`src/components/code/SyntaxHighlighter.tsx`)
   - Prism.js integration for syntax highlighting
   - Custom theme implementation
   - Language support management

4. **CodeTab** (`src/components/tabs/CodeTab.tsx`)
   - Main integration point
   - Settings management
   - User interface coordination

### API Endpoints Used

- `GET /repos/{owner}/{repo}` - Repository information
- `GET /repos/{owner}/{repo}/branches` - Branch listing
- `GET /repos/{owner}/{repo}/contents/{path}` - File/directory contents
- `GET /repos/{owner}/{repo}/contents/{path}?ref={branch}` - Branch-specific content
- Raw GitHub content via `https://raw.githubusercontent.com`

### Styling

- Custom Prism.js theme (`src/styles/prism-theme.css`)
- Dark mode optimized colors
- Consistent with application design
- Responsive layout for different screen sizes

## Error Handling

The integration includes comprehensive error handling:

- **Repository Not Found**: Clear error messages for invalid repositories
- **Network Issues**: Graceful handling of API failures
- **Invalid Format**: Validation for repository path format
- **Permission Issues**: Handling of private repository access attempts

## Future Enhancements

Potential improvements for the GitHub integration:

1. **Private Repository Support**: OAuth integration for private repos
2. **File Search**: Search functionality within repositories
3. **Code Editing**: In-place code editing capabilities
4. **Commit History**: View file change history
5. **Pull Request Integration**: View and manage PRs
6. **Multi-Repository Support**: Switch between multiple repositories
7. **Code Folding**: Collapsible code sections
8. **Line Numbers**: Optional line number display
9. **Copy to Clipboard**: Easy code copying functionality
10. **Export Options**: Export code snippets or files

## Configuration

The GitHub integration uses the same settings system as the rest of the application:

```json
{
  "github": {
    "repo": "owner/repository",
    "branch": "main"
  }
}
```

Settings are stored in localStorage and can be configured through the Settings panel or directly in the Code tab. 