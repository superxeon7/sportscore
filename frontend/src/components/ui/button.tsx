'use client';

import React from 'react';
import { Spinner } from './spinner';

type ButtonVariant = 'default' | 'primary' | 'secondary' | 'danger' | 'destructive' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  default:
    'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 focus-visible:ring-emerald-500 disabled:bg-emerald-800 disabled:text-emerald-400',
  primary:
    'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 focus-visible:ring-emerald-500 disabled:bg-emerald-800 disabled:text-emerald-400',
  secondary:
    'bg-slate-700 text-slate-200 hover:bg-slate-600 active:bg-slate-500 focus-visible:ring-slate-500 disabled:bg-slate-800 disabled:text-slate-500',
  danger:
    'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-800 disabled:text-red-400',
  destructive:
    'bg-red-600 text-white hover:bg-red-500 active:bg-red-700 focus-visible:ring-red-500 disabled:bg-red-800 disabled:text-red-400',
  ghost:
    'bg-transparent text-slate-300 hover:bg-white/10 hover:text-white active:bg-white/15 focus-visible:ring-slate-500 disabled:text-slate-600',
  outline:
    'bg-transparent text-slate-200 border border-slate-600 hover:bg-white/5 hover:border-slate-500 hover:text-white active:bg-white/10 focus-visible:ring-slate-500 disabled:bg-transparent disabled:text-slate-600 disabled:border-slate-700',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
  icon: 'p-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
