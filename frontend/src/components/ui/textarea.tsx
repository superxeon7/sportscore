'use client';

import React, { forwardRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

const resizeClasses = {
  none: 'resize-none',
  vertical: 'resize-y',
  horizontal: 'resize-x',
  both: 'resize',
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, resize = 'vertical', className = '', id, ...props }, ref) => {
    const textareaId = id || props.name || undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="mb-1 block text-sm font-medium text-slate-200"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={`block w-full rounded-lg border bg-slate-800/80 text-slate-100 px-3 py-2 text-sm shadow-sm transition-all duration-150 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-0 ${error
              ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
              : 'border-slate-600/60 focus:border-emerald-500 focus:ring-emerald-500/30'
            } disabled:cursor-not-allowed disabled:bg-slate-700/50 disabled:text-slate-500 ${resizeClasses[resize]} ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-slate-500">{helperText}</p>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
