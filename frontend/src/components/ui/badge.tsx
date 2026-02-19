import React from 'react';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'destructive' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  pill?: boolean;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-700/60 text-slate-300 border border-slate-600/40',
  secondary: 'bg-slate-800/60 text-slate-400 border border-slate-700/40',
  success: 'bg-emerald-900/50 text-emerald-400 border border-emerald-700/30',
  warning: 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/30',
  danger: 'bg-red-900/50 text-red-400 border border-red-700/30',
  destructive: 'bg-red-900/50 text-red-400 border border-red-700/30',
  info: 'bg-blue-900/50 text-blue-400 border border-blue-700/30',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-slate-400',
  secondary: 'bg-slate-500',
  success: 'bg-emerald-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
  destructive: 'bg-red-500',
  info: 'bg-blue-500',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
};

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  dot = false,
  pill = true,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium ${pill ? 'rounded-full' : 'rounded-md'
        } ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotColors[variant]}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColors[variant]}`} />
        </span>
      )}
      {children}
    </span>
  );
}
