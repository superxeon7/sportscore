export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

const TOKEN_KEY = 'sportscore_access_token';
const REFRESH_TOKEN_KEY = 'sportscore_refresh_token';

// SSR-safe localStorage helpers
function getFromStorage(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setInStorage(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage might be full or disabled
  }
}

function removeFromStorage(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore
  }
}

// Token management
export function getAccessToken(): string | null {
  return getFromStorage(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return getFromStorage(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string): void {
  setInStorage(TOKEN_KEY, accessToken);
  setInStorage(REFRESH_TOKEN_KEY, refreshToken);
  // Also set cookies so middleware can read them for route protection
  if (typeof document !== 'undefined') {
    document.cookie = `${TOKEN_KEY}=${accessToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
    document.cookie = `${REFRESH_TOKEN_KEY}=${refreshToken}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
  }
}

export function clearTokens(): void {
  removeFromStorage(TOKEN_KEY);
  removeFromStorage(REFRESH_TOKEN_KEY);
  // Also clear cookies
  if (typeof document !== 'undefined') {
    document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
    document.cookie = `${REFRESH_TOKEN_KEY}=; path=/; max-age=0`;
  }
}

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      isRefreshing = false;
      refreshPromise = null;
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`,
        },
      });

      if (!response.ok) {
        clearTokens();
        isRefreshing = false;
        refreshPromise = null;
        return false;
      }

      const json = await response.json();
      const data = json?.data ?? json;
      setTokens(data.accessToken, data.refreshToken);
      isRefreshing = false;
      refreshPromise = null;
      return true;
    } catch {
      clearTokens();
      isRefreshing = false;
      refreshPromise = null;
      return false;
    }
  })();

  return refreshPromise;
}

function getDefaultErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Permintaan tidak valid.';
    case 401:
      return 'Sesi Anda telah berakhir. Silakan login kembali.';
    case 403:
      return 'Anda tidak memiliki izin untuk mengakses ini.';
    case 404:
      return 'Data tidak ditemukan.';
    case 409:
      return 'Data sudah ada atau terjadi konflik.';
    case 500:
      return 'Terjadi kesalahan server.';
    default:
      return 'Terjadi kesalahan.';
  }
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { skipAuth, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const url = `${API_BASE_URL}${path}`;

  let response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  // On 401, attempt to refresh the token and retry once
  if (response.status === 401 && !skipAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
      }
      response = await fetch(url, {
        ...fetchOptions,
        headers,
      });
    } else {
      // Refresh failed - clear tokens and throw
      clearTokens();
      throw new ApiError('Sesi Anda telah berakhir. Silakan login kembali.', 401);
    }
  }

  if (!response.ok) {
    let errorMessage = getDefaultErrorMessage(response.status);
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // Response body wasn't JSON
    }
    throw new ApiError(errorMessage, response.status);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  const json = await response.json();

  // Unwrap the { success, data, meta } envelope from the backend
  // When meta is present (paginated responses), preserve { data, meta } structure
  // When meta is absent (single-entity responses), return data directly
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    if ('meta' in json && json.meta) {
      return { data: json.data, meta: json.meta } as T;
    }
    return json.data as T;
  }

  return json as T;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Convenience methods
export function apiGet<T>(path: string, options?: FetchOptions): Promise<T> {
  return apiFetch<T>(path, { ...options, method: 'GET' });
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  options?: FetchOptions,
): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(
  path: string,
  body?: unknown,
  options?: FetchOptions,
): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T>(
  path: string,
  body?: unknown,
  options?: FetchOptions,
): Promise<T> {
  return apiFetch<T>(path, {
    ...options,
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T>(
  path: string,
  options?: FetchOptions,
): Promise<T> {
  return apiFetch<T>(path, { ...options, method: 'DELETE' });
}

/**
 * Upload a file via multipart/form-data.
 * Do NOT set Content-Type manually — the browser sets it with the correct boundary.
 */
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = getDefaultErrorMessage(response.status);
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // ignore
    }
    throw new ApiError(errorMessage, response.status);
  }

  const json = await response.json();
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}
