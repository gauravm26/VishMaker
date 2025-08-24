// GitHub API Service for fetching repository content
interface GitHubFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir';
  content?: string;
  encoding?: string;
}

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
  branches_url: string;
}

interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

// New interfaces for Pull Request functionality
interface GitHubPullRequest {
  id: number;
  number: number;
  state: 'open' | 'closed' | 'merged';
  title: string;
  body: string;
  html_url: string;
  diff_url: string;
  patch_url: string;
  issue_url: string;
  commits_url: string;
  review_comments_url: string;
  review_comment_url: string;
  comments_url: string;
  statuses_url: string;
  head: {
    label: string;
    ref: string;
    sha: string;
    user: {
      login: string;
      id: number;
      avatar_url: string;
      html_url: string;
    };
    repo: {
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      html_url: string;
    };
  };
  base: {
    label: string;
    ref: string;
    sha: string;
    user: {
      login: string;
      id: number;
      avatar_url: string;
      html_url: string;
    };
    repo: {
      id: number;
      name: string;
      full_name: string;
      private: boolean;
      html_url: string;
    };
  };
  user: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  };
  assignees: Array<{
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  }>;
  requested_reviewers: Array<{
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  }>;
  labels: Array<{
    id: number;
    name: string;
    color: string;
    description: string;
  }>;
  draft: boolean;
  merged: boolean;
  mergeable: boolean;
  mergeable_state: 'clean' | 'dirty' | 'unstable' | 'blocked';
  merged_by: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  } | null;
  merge_commit_sha: string | null;
  comments: number;
  review_comments: number;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
}

interface GitHubPRStatus {
  state: 'pending' | 'success' | 'failure' | 'error';
  target_url: string;
  description: string;
  context: string;
  created_at: string;
  updated_at: string;
}

interface GitHubPRReview {
  id: number;
  user: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  };
  body: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
  html_url: string;
  pull_request_url: string;
  submitted_at: string;
}

class GitHubService {
  private static readonly GITHUB_API_BASE = 'https://api.github.com';
  private static readonly GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';

  /**
   * Get GitHub token from localStorage
   */
  private static getGitHubToken(): string | null {
    const settings = localStorage.getItem('appSettings');
    console.log('Reading settings from localStorage:', settings ? 'Settings found' : 'No settings');
    
    if (settings) {
      try {
        const parsed = JSON.parse(settings);
        console.log('Parsed settings:', parsed);
        const token = parsed.github?.token || null;
        console.log('GitHub token found:', token ? 'Token present' : 'No token');
        return token;
      } catch (error) {
        console.error('Failed to parse app settings:', error);
        return null;
      }
    }
    return null;
  }

  /**
   * Get headers for GitHub API requests
   */
  private static getHeaders(): HeadersInit {
    const token = this.getGitHubToken();
    const headers: HeadersInit = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'VishMaker-App'
    };
    
    if (token) {
      headers['Authorization'] = `token ${token}`;
      console.log('Adding Authorization header with token');
    } else {
      console.log('No token found, making unauthenticated request');
    }
    
    return headers;
  }

  /**
   * Fetch repository information
   */
  static async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    try {
      const response = await fetch(`${this.GITHUB_API_BASE}/repos/${owner}/${repo}`, {
        headers: this.getHeaders()
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Repository '${owner}/${repo}' not found. Please check the repository name and ensure it exists.`);
        } else if (response.status === 403) {
          throw new Error(`Repository '${owner}/${repo}' is private or requires authentication. Please check repository permissions.`);
        } else {
          throw new Error(`Failed to fetch repository: ${response.statusText} (${response.status})`);
        }
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching repository:', error);
      throw error;
    }
  }

  /**
   * Fetch repository branches
   */
  static async getBranches(owner: string, repo: string): Promise<GitHubBranch[]> {
    try {
      const response = await fetch(`${this.GITHUB_API_BASE}/repos/${owner}/${repo}/branches`, {
        headers: this.getHeaders()
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Repository '${owner}/${repo}' not found.`);
        } else if (response.status === 403) {
          throw new Error(`Repository '${owner}/${repo}' is private or requires authentication. Please check repository permissions.`);
        } else {
          throw new Error(`Failed to fetch branches: ${response.statusText} (${response.status})`);
        }
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching branches:', error);
      throw error;
    }
  }

  /**
   * Fetch repository contents (files and directories)
   */
  static async getContents(owner: string, repo: string, path: string = '', branch: string = 'main'): Promise<GitHubFile[]> {
    try {
      const url = `${this.GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
      console.log(`Fetching GitHub contents from: ${url}`);
      
      const response = await fetch(url, {
        headers: this.getHeaders()
      });
      console.log(`GitHub API response status: ${response.status}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          if (path === '') {
            throw new Error(`Repository '${owner}/${repo}' not found. Please check the repository name and ensure it exists.`);
          } else {
            throw new Error(`Path '${path}' not found in repository '${owner}/${repo}'.`);
          }
        } else if (response.status === 403) {
          // Check if it's rate limiting or private repository
          const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
          const rateLimitReset = response.headers.get('x-ratelimit-reset');
          
          console.log(`Rate limit remaining: ${rateLimitRemaining}, reset at: ${rateLimitReset}`);
          
          if (rateLimitRemaining === '0') {
            throw new Error(`GitHub API rate limit exceeded. Please try again later or use a GitHub token for higher limits.`);
          } else {
            throw new Error(`Repository '${owner}/${repo}' is private or requires authentication. Please check repository permissions.`);
          }
        } else {
          throw new Error(`Failed to fetch contents: ${response.statusText} (${response.status})`);
        }
      }
      
      const data = await response.json();
      console.log(`Successfully fetched ${Array.isArray(data) ? data.length : 1} items from GitHub`);
      return Array.isArray(data) ? data : [data];
    } catch (error) {
      console.error('Error fetching contents:', error);
      throw error;
    }
  }

  /**
   * Fetch a single file's content
   */
  static async getFileContent(owner: string, repo: string, path: string, branch: string = 'main'): Promise<string> {
    try {
      const response = await fetch(`${this.GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`File '${path}' not found in repository '${owner}/${repo}'.`);
        } else if (response.status === 403) {
          throw new Error(`Repository '${owner}/${repo}' is private. Private repositories require authentication.`);
        } else {
          throw new Error(`Failed to fetch file content: ${response.statusText} (${response.status})`);
        }
      }
      
      const data = await response.json();
      
      if (data.type !== 'file') {
        throw new Error('Path does not point to a file');
      }
      
      // Decode content from base64
      const content = atob(data.content);
      return content;
    } catch (error) {
      console.error('Error fetching file content:', error);
      throw error;
    }
  }

  /**
   * Get raw file content directly from GitHub
   */
  static async getRawFileContent(owner: string, repo: string, path: string, branch: string = 'main'): Promise<string> {
    try {
      const url = `${this.GITHUB_RAW_BASE}/${owner}/${repo}/${branch}/${path}`;
      console.log(`Fetching raw file content from: ${url}`);
      
      const response = await fetch(url);
      console.log(`Raw file API response status: ${response.status}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`File '${path}' not found in repository '${owner}/${repo}'.`);
        } else if (response.status === 403) {
          throw new Error(`Repository '${owner}/${repo}' is private or requires authentication. Please check repository permissions.`);
        } else {
          throw new Error(`Failed to fetch raw file content: ${response.statusText} (${response.status})`);
        }
      }
      
      const content = await response.text();
      console.log(`Successfully fetched raw file content (${content.length} characters)`);
      return content;
    } catch (error) {
      console.error('Error fetching raw file content:', error);
      throw error;
    }
  }

  /**
   * Test GitHub connection and authentication
   */
  static async testConnection(): Promise<{ authenticated: boolean; rateLimit: number; remaining: number }> {
    try {
      const response = await fetch(`${this.GITHUB_API_BASE}/rate_limit`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to test connection: ${response.statusText} (${response.status})`);
      }
      
      const data = await response.json();
      const rateLimit = data.resources.core.limit;
      const remaining = data.resources.core.remaining;
      const authenticated = this.getGitHubToken() !== null;
      
      console.log(`GitHub connection test:`, {
        authenticated,
        rateLimit,
        remaining,
        resetTime: new Date(data.resources.core.reset * 1000).toLocaleString()
      });
      
      return { authenticated, rateLimit, remaining };
    } catch (error) {
      console.error('Error testing GitHub connection:', error);
      throw error;
    }
  }

  /**
   * Parse repository path into owner and repo
   */
  static parseRepoPath(repoPath: string): { owner: string; repo: string } | null {
    const match = repoPath.match(/^([^\/]+)\/([^\/]+)$/);
    if (!match) {
      return null;
    }
    return {
      owner: match[1],
      repo: match[2]
    };
  }

  /**
   * Get file extension for syntax highlighting
   */
  static getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Check if file is code file based on extension
   */
  static isCodeFile(filename: string): boolean {
    const codeExtensions = [
      'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs',
      'swift', 'kt', 'scala', 'html', 'css', 'scss', 'sass', 'less', 'json', 'xml', 'yaml',
      'yml', 'md', 'txt', 'sh', 'bash', 'zsh', 'fish', 'sql', 'vue', 'svelte', 'astro'
    ];
    const ext = this.getFileExtension(filename);
    return codeExtensions.includes(ext);
  }

  /**
   * Get syntax highlighting language based on file extension
   */
  static getLanguageFromExtension(filename: string): string {
    const ext = this.getFileExtension(filename);
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'txt': 'text',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'bash',
      'fish': 'bash',
      'sql': 'sql',
      'vue': 'vue',
      'svelte': 'svelte',
      'astro': 'astro'
    };
    return languageMap[ext] || 'text';
  }

  /**
   * Get suggested public repositories for testing
   */
  static getSuggestedRepositories(): Array<{ name: string; description: string }> {
    return [
      { name: 'facebook/react', description: 'React JavaScript library' },
      { name: 'microsoft/vscode', description: 'Visual Studio Code editor' },
      { name: 'vuejs/vue', description: 'Vue.js framework' },
      { name: 'angular/angular', description: 'Angular framework' },
      { name: 'nodejs/node', description: 'Node.js runtime' },
      { name: 'python/cpython', description: 'Python programming language' },
      { name: 'torvalds/linux', description: 'Linux kernel' },
      { name: 'microsoft/TypeScript', description: 'TypeScript language' }
    ];
  }

  /**
   * Extract owner, repo, and PR number from a GitHub PR URL
   */
  static parsePRUrl(prUrl: string): { owner: string; repo: string; prNumber: number } | null {
    const match = prUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/);
    if (!match) {
      return null;
    }
    return {
      owner: match[1],
      repo: match[2],
      prNumber: parseInt(match[3], 10)
    };
  }

  /**
   * Get Pull Request information
   */
  static async getPullRequest(owner: string, repo: string, prNumber: number): Promise<GitHubPullRequest> {
    try {
      const response = await fetch(`${this.GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Pull Request #${prNumber} not found in repository '${owner}/${repo}'.`);
        } else if (response.status === 403) {
          throw new Error(`Repository '${owner}/${repo}' is private or requires authentication.`);
        } else {
          throw new Error(`Failed to fetch pull request: ${response.statusText} (${response.status})`);
        }
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching pull request:', error);
      throw error;
    }
  }

  /**
   * Get Pull Request status checks
   */
  static async getPullRequestStatus(owner: string, repo: string, prNumber: number): Promise<GitHubPRStatus[]> {
    try {
      const response = await fetch(`${this.GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${prNumber}/status`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Status not found for PR #${prNumber} in repository '${owner}/${repo}'.`);
        } else if (response.status === 403) {
          throw new Error(`Repository '${owner}/${repo}' is private or requires authentication.`);
        } else {
          throw new Error(`Failed to fetch PR status: ${response.statusText} (${response.status})`);
        }
      }
      
      const data = await response.json();
      return data.statuses || [];
    } catch (error) {
      console.error('Error fetching PR status:', error);
      throw error;
    }
  }

  /**
   * Get Pull Request reviews
   */
  static async getPullRequestReviews(owner: string, repo: string, prNumber: number): Promise<GitHubPRReview[]> {
    try {
      const response = await fetch(`${this.GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Reviews not found for PR #${prNumber} in repository '${owner}/${repo}'.`);
        } else if (response.status === 403) {
          throw new Error(`Repository '${owner}/${repo}' is private or requires authentication.`);
        } else {
          throw new Error(`Failed to fetch PR reviews: ${response.statusText} (${response.status})`);
        }
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching PR reviews:', error);
      throw error;
    }
  }

  /**
   * Check if a Pull Request is approved and ready for merge
   */
  static async isPullRequestApproved(owner: string, repo: string, prNumber: number): Promise<{
    approved: boolean;
    reviewCount: number;
    approvalCount: number;
    changesRequested: boolean;
    lastReviewState: string;
    prState: string;
    mergeable: boolean;
  }> {
    try {
      const [pr, reviews] = await Promise.all([
        this.getPullRequest(owner, repo, prNumber),
        this.getPullRequestReviews(owner, repo, prNumber)
      ]);

      const approvalCount = reviews.filter(review => review.state === 'APPROVED').length;
      const changesRequested = reviews.some(review => review.state === 'CHANGES_REQUESTED');
      const lastReview = reviews.length > 0 ? reviews[reviews.length - 1] : null;

      return {
        approved: approvalCount > 0 && !changesRequested && pr.state === 'open',
        reviewCount: reviews.length,
        approvalCount,
        changesRequested,
        lastReviewState: lastReview?.state || 'NO_REVIEWS',
        prState: pr.state,
        mergeable: pr.mergeable && pr.mergeable_state === 'clean'
      };
    } catch (error) {
      console.error('Error checking PR approval status:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive PR information including status and reviews
   */
  static async getPullRequestInfo(prUrl: string): Promise<{
    pr: GitHubPullRequest;
    status: GitHubPRStatus[];
    reviews: GitHubPRReview[];
    approvalInfo: {
      approved: boolean;
      reviewCount: number;
      approvalCount: number;
      changesRequested: boolean;
      lastReviewState: string;
      prState: string;
      mergeable: boolean;
    };
  } | null> {
    try {
      const parsed = this.parsePRUrl(prUrl);
      if (!parsed) {
        throw new Error('Invalid GitHub PR URL format');
      }

      const { owner, repo, prNumber } = parsed;
      
      const [pr, status, reviews] = await Promise.all([
        this.getPullRequest(owner, repo, prNumber),
        this.getPullRequestStatus(owner, repo, prNumber),
        this.getPullRequestReviews(owner, repo, prNumber)
      ]);

      const approvalInfo = await this.isPullRequestApproved(owner, repo, prNumber);

      return {
        pr,
        status,
        reviews,
        approvalInfo
      };
    } catch (error) {
      console.error('Error getting comprehensive PR info:', error);
      return null;
    }
  }
}

export default GitHubService;
export type { GitHubFile, GitHubRepository, GitHubBranch, GitHubPullRequest, GitHubPRStatus, GitHubPRReview }; 