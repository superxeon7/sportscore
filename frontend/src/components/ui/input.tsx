'use client';

import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, className = '', id, ...props }, ref) => {
    const inputId = id || props.name || undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1 block text-sm font-medium text-slate-200"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-all duration-150 bg-slate-800/80 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-0 ${icon ? 'pl-10' : ''
              } ${error
                ? 'border-red-500/60 focus:border-red-500 focus:ring-red-500/30'
                : 'border-slate-600/60 focus:border-emerald-500 focus:ring-emerald-500/30'
              } disabled:cursor-not-allowed disabled:bg-slate-900 disabled:text-slate-600 ${className}`}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-400">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-slate-500">{helperText}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
