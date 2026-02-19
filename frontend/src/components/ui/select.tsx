'use client';

import React, { forwardRef } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, children, className = '', id, ...props }, ref) => {
    const selectId = id || props.name || undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="mb-1 block text-sm font-medium text-slate-200"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`block w-full appearance-none rounded-lg border bg-slate-800/80 text-slate-100 px-3 py-2 pr-10 text-sm shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 ${error
                ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-600/60 focus:border-emerald-500 focus:ring-emerald-500/30'
              } disabled:cursor-not-allowed disabled:bg-slate-700/50 disabled:text-slate-500 ${className}`}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options
              ? options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))
              : children}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
