// Configuration file for the application

// Get API base URL from environment variables or use defaults
export const getApiBaseUrl = () => {
  // Check for explicit API URL first
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Fallback to environment-based logic
  if (import.meta.env.MODE === 'production') {
    // In production, try to use the current origin or fallback
    return window.location.origin + '/api';
  }
  
  // Development: use relative URL so Vite proxy handles it from any device/IP
  return '/api';
};

// Export the base URL
export const API_BASE_URL = getApiBaseUrl();

// Get base URL for assets and files (without /api)
export const getBaseUrl = () => {
  // Check for explicit base URL first
  if (import.meta.env.VITE_BASE_URL) {
    return import.meta.env.VITE_BASE_URL;
  }
  
  // Fallback to environment-based logic
  if (import.meta.env.MODE === 'production') {
    // In production, use the current origin
    return window.location.origin;
  }
  
  // Development: use current hostname so it works from any device on the network
  return `http://${window.location.hostname}:3000`;
};

// Export the base URL for assets
export const BASE_URL = getBaseUrl();

// Get WebSocket base URL (ws:// or wss://)
export const getWebSocketBaseUrl = () => {
  // Check for explicit WebSocket URL first
  if (import.meta.env.VITE_WEBSOCKET_URL) {
    return import.meta.env.VITE_WEBSOCKET_URL;
  }

  const backendUrlFromEnv = import.meta.env.VITE_BACKEND_URL as string | undefined;
  const toWebSocketOrigin = (inputUrl: string) => {
    const u = new URL(inputUrl);
    if (u.protocol === 'https:') u.protocol = 'wss:';
    else if (u.protocol === 'http:') u.protocol = 'ws:';
    // Drop any path/query/hash; WS server is mounted at origin with path routing
    u.pathname = '';
    u.search = '';
    u.hash = '';
    return u.toString().replace(/\/$/, '');
  };
  
  // Fallback to environment-based logic
  if (import.meta.env.MODE === 'production') {
    // In production, prefer backend URL (WebSocket server lives there)
    if (backendUrlFromEnv) {
      try {
        return toWebSocketOrigin(backendUrlFromEnv);
      } catch (e) {
        console.warn('Invalid VITE_BACKEND_URL for WebSocket derivation:', backendUrlFromEnv, e);
      }
    }

    // Last resort: use current origin host (only works if frontend host also serves WS)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
  
  // Development: use current hostname so it works from any device on the network
  return `ws://${window.location.hostname}:3000`;
};

// Export the WebSocket base URL
export const WEBSOCKET_BASE_URL = getWebSocketBaseUrl();

// Environment configuration
export const config = {
  isDevelopment: import.meta.env.MODE === 'development',
  isProduction: import.meta.env.MODE === 'production',
  apiBaseUrl: API_BASE_URL,
  baseUrl: BASE_URL,
  websocketBaseUrl: WEBSOCKET_BASE_URL,
  frontendUrl: import.meta.env.VITE_FRONTEND_URL || 'http://localhost:8080',
  backendUrl: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000',
};

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Helper function to build full asset URLs
export const buildAssetUrl = (path: string) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${BASE_URL}/${cleanPath}`;
};

// Helper function to build backend asset URLs (for files served from backend)
export const buildBackendAssetUrl = (path: string) => {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // In production, use the backend URL from environment or construct it
  if (import.meta.env.MODE === 'production') {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://vehicle-management-backend-ypsa.onrender.com';
    return `${backendUrl}/${cleanPath}`;
  }
  
  // Development: same-origin via Vite /uploads proxy (avoids CORP cross-origin blocks)
  return `/${cleanPath}`;
};

/** Download a backend-hosted file (works cross-origin; avoids <a download> opening a new tab). */
export const downloadBackendAsset = async (path: string, filename: string): Promise<void> => {
  const url = buildBackendAssetUrl(path);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('File not found on server');
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

// Helper function to build WebSocket URLs
export const buildWebSocketUrl = (endpoint: string) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  if (!cleanEndpoint) return WEBSOCKET_BASE_URL;
  return `${WEBSOCKET_BASE_URL}/${cleanEndpoint}`;
};

export default config;
