import React from 'react';
import { cn } from '../utils/cn';

export interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  className,
  size = 'md',
  label = 'Loading...',
  ...props
}) => {
  const sizeStyles = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-3',
  }[size];

  return (
    <div
      role="status"
      className={cn('inline-flex items-center justify-center', className)}
      {...props}
    >
      <div
        className={cn('animate-spin rounded-full border-stone-200 border-t-amber-600', sizeStyles)}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
};
