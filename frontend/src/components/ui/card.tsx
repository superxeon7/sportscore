import React from 'react';

type CardVariant = 'default' | 'outlined' | 'elevated';

interface CardProps {
  header?: React.ReactNode;
  children: React.ReactNode;
  hoverable?: boolean;
  variant?: CardVariant;
  className?: string;
  noPadding?: boolean;
}

const variantClasses: Record<CardVariant, string> = {
  default: 'border border-slate-700/50 bg-slate-900/60 backdrop-blur-sm shadow-sm',
  outlined: 'border border-slate-700/50 bg-slate-900/40',
  elevated: 'bg-slate-900/80 shadow-lg shadow-black/20',
};

export function Card({
  header,
  children,
  hoverable = false,
  variant = 'default',
  className = '',
  noPadding = false,
}: CardProps) {
  return (
    <div
      className={`rounded-xl ${variantClasses[variant]} ${hoverable ? 'transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/5 hover:border-slate-600/60' : ''
        } ${className}`}
    >
      {header && (
        <div className="border-b border-white/10 px-6 py-4">{header}</div>
      )}
      <div className={noPadding ? '' : 'px-6 py-4'}>{children}</div>
    </div>
  );
}
