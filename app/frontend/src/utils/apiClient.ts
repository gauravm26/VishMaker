// API Client for making HTTP requests to the backend
// Supports authentication, token management, and typed responses

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  requireAuth?: boolean;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  message?: string;
}

// Token Manager for handling JWT tokens
export class TokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'vishmaker_access_token';
  private static readonly REFRESH_TOKEN_KEY = 'vishmaker_refresh_token';

  static setToken(token: string): void {
    localStorage.setItem(this.ACCESS_TOKEN_KEY, token);
  }

  static getToken(): string | null {
    return localStorage.getItem(this.ACCESS_TOKEN_KEY);
  }

  static setRefreshToken(token: string): void {
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static clearTokens(): void {
    localStorage.removeItem(this.ACCESS_TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
  }

  static isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch {
      return true; // If we can't parse the token, consider it expired
    }
  }
}

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Main API client function
async function apiClient<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    requireAuth = true,
    headers = {}
  } = options;

  // Prepare request headers
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers
  };

  // Add authentication header if required
  if (requireAuth) {
    const token = TokenManager.getToken();
    if (token && !TokenManager.isTokenExpired(token)) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    } else {
      throw new Error('Authentication required but no valid token found');
    }
  }

  // Prepare request options
  const requestOptions: RequestInit = {
    method,
    headers: requestHeaders,
  };

  // Add body for non-GET requests
  if (body && method !== 'GET') {
    requestOptions.body = JSON.stringify(body);
  }

  // Construct full URL
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  // Debug logging
  console.log('🌐 API Call:', {
    endpoint,
    apiBaseUrl: API_BASE_URL,
    fullUrl: url,
    method
  });

  try {
    const response = await fetch(url, requestOptions);

    // Handle non-2xx responses
    if (!response.ok) {
      if (response.status === 401) {
        // Unauthorized - clear tokens and redirect to login
        TokenManager.clearTokens();
        window.location.href = '/login';
        throw new Error('Authentication failed');
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    // Handle different response types
    if (response.status === 204) {
      // No Content (common for DELETE operations)
      return {} as T;
    }
    
    // Check if there's content to parse
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      // Parse JSON response
      const data = await response.json();
      return data;
    } else if (response.headers.get('content-length') === '0' || !response.body) {
      // Empty response
      return {} as T;
    } else {
      // Try to parse as JSON, fallback to empty object
      try {
        const data = await response.json();
        return data;
      } catch {
        // If parsing fails, return empty object
        return {} as T;
      }
    }
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Export the main function and TokenManager
export default apiClient;
