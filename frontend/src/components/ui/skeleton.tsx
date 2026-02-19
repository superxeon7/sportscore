import React from 'react';

type SkeletonVariant = 'line' | 'circle' | 'rectangle';

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string;
  height?: string;
  className?: string;
}

export function Skeleton({
  variant = 'line',
  width,
  height,
  className = '',
}: SkeletonProps) {
  const baseClass = 'animate-skeleton-shimmer bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%] rounded';

  if (variant === 'circle') {
    return (
      <div
        className={`${baseClass} rounded-full ${className}`}
        style={{
          width: width || '40px',
          height: height || width || '40px',
        }}
      />
    );
  }

  if (variant === 'rectangle') {
    return (
      <div
        className={`${baseClass} ${className}`}
        style={{
          width: width || '100%',
          height: height || '100px',
        }}
      />
    );
  }

  // line
  return (
    <div
      className={`${baseClass} ${className}`}
      style={{
        width: width || '100%',
        height: height || '16px',
      }}
    />
  );
}
