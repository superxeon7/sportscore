'use client';

import { create } from 'zustand';
import type {
  User,
  LoginCredentials,
  RegisterData,
  AuthResponse,
} from '@/lib/types';
import {
  apiPost,
  apiGet,
  setTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
} from '@/lib/api/client';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

interface AuthActions {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  setUser: (user: User | null) => void;
  initialize: () => Promise<void>;
  clearError: () => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set, get) => ({
  // State
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  error: null,
  isInitialized: false,

  // Actions
  login: async (credentials: LoginCredentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiPost<AuthResponse>(
        '/auth/login',
        credentials,
        { skipAuth: true },
      );
      setTokens(response.accessToken, response.refreshToken);
      set({
        user: response.user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Login failed',
      });
      throw err;
    }
  },

  register: async (data: RegisterData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiPost<AuthResponse>(
        '/auth/register',
        data,
        { skipAuth: true },
      );
      setTokens(response.accessToken, response.refreshToken);
      set({
        user: response.user,
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Registration failed',
      });
      throw err;
    }
  },

  logout: async () => {
    try {
      await apiPost('/auth/logout');
    } catch {
      // Even if API call fails, clear local state
    }
    clearTokens();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      error: null,
    });
  },

  refreshTokens: async () => {
    const currentRefreshToken = getRefreshToken();
    if (!currentRefreshToken) return;

    try {
      const response = await apiPost<AuthResponse>(
        '/auth/refresh',
        undefined,
        { skipAuth: true, headers: { 'Authorization': `Bearer ${currentRefreshToken}` } },
      );
      setTokens(response.accessToken, response.refreshToken);
      set({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
    } catch {
      clearTokens();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
      });
    }
  },

  setUser: (user: User | null) => {
    set({ user });
  },

  initialize: async () => {
    if (get().isInitialized) return;

    const token = getAccessToken();
    const refresh = getRefreshToken();

    if (!token) {
      set({ isInitialized: true });
      return;
    }

    set({ accessToken: token, refreshToken: refresh, isLoading: true });

    try {
      const user = await apiGet<User>('/users/me');
      set({
        user,
        isLoading: false,
        isInitialized: true,
      });
    } catch {
      // Token might be expired, try refresh
      if (refresh) {
        try {
          const response = await apiPost<AuthResponse>(
            '/auth/refresh',
            undefined,
            { skipAuth: true, headers: { 'Authorization': `Bearer ${refresh}` } },
          );
          setTokens(response.accessToken, response.refreshToken);
          const user = await apiGet<User>('/users/me');
          set({
            user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            isLoading: false,
            isInitialized: true,
          });
        } catch {
          clearTokens();
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isLoading: false,
            isInitialized: true,
          });
        }
      } else {
        clearTokens();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isLoading: false,
          isInitialized: true,
        });
      }
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
