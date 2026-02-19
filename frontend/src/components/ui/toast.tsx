'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useUIStore } from '@/lib/stores/ui.store';

const typeConfig = {
  success: {
    bg: 'bg-green-50 border-green-200 text-green-800',
    iconColor: 'text-green-500',
    progressColor: 'bg-green-500',
    Icon: CheckCircle,
  },
  error: {
    bg: 'bg-red-50 border-red-200 text-red-800',
    iconColor: 'text-red-500',
    progressColor: 'bg-red-500',
    Icon: XCircle,
  },
  warning: {
    bg: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    iconColor: 'text-yellow-500',
    progressColor: 'bg-yellow-500',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'bg-blue-50 border-blue-200 text-blue-800',
    iconColor: 'text-blue-500',
    progressColor: 'bg-blue-500',
    Icon: Info,
  },
} as const;

interface ToastItemProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onDismiss: (id: string) => void;
}

function ToastItem({ id, message, type, duration = 5000, onDismiss }: ToastItemProps) {
  const config = typeConfig[type] || typeConfig.info;
  const { Icon } = config;
  const [exiting, setExiting] = useState(false);

  const handleDismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(id), 200);
  }, [id, onDismiss]);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(handleDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, handleDismiss]);

  return (
    <div
      className={`relative flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg overflow-hidden transition-all duration-200 ${
        exiting ? 'animate-toast-out' : 'animate-toast-in'
      } ${config.bg}`}
      role="alert"
    >
      <Icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${config.iconColor}`} />
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5">
          <div
            className={`h-full ${config.progressColor} opacity-40`}
            style={{
              animation: `toast-progress ${duration}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}

export function ToastContainer() {
  const toasts = useUIStore((state) => state.toasts);
  const removeToast = useUIStore((state) => state.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-3 w-full max-w-sm">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onDismiss={removeToast}
        />
      ))}
    </div>
  );
}

// Hook for easy toast usage across the app
export function useToast() {
  const addToast = useUIStore((state) => state.addToast);

  return {
    success: (message: string, duration?: number) =>
      addToast({ message, type: 'success', duration }),
    error: (message: string, duration?: number) =>
      addToast({ message, type: 'error', duration }),
    warning: (message: string, duration?: number) =>
      addToast({ message, type: 'warning', duration }),
    info: (message: string, duration?: number) =>
      addToast({ message, type: 'info', duration }),
  };
}
