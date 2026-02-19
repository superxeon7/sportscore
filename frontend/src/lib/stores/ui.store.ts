'use client';

import { create } from 'zustand';
import type { Toast } from '@/lib/types';

interface UIState {
  sidebarOpen: boolean;
  toasts: Toast[];
}

interface UIActions {
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

type UIStore = UIState & UIActions;

let toastCounter = 0;

export const useUIStore = create<UIStore>((set) => ({
  // State
  sidebarOpen: true,
  toasts: [],

  // Actions
  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open });
  },

  addToast: (toast: Omit<Toast, 'id'>) => {
    const id = `toast-${++toastCounter}-${Date.now()}`;
    const newToast: Toast = { ...toast, id };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    // Auto-dismiss after duration
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));
