import React from 'react';
import { cn } from '../utils/cn';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  'aria-label': string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant = 'ghost', size = 'md', children, disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center rounded-md transition-colors select-none ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 ' +
      'disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed';

    const sizeStyles = {
      sm: 'h-8 w-8 text-xs',
      md: 'h-10 w-10 text-sm',
      lg: 'h-12 w-12 text-base',
    }[size];

    const variantStyles = {
      primary: 'bg-stone-900 text-stone-50 hover:bg-stone-800',
      secondary: 'bg-stone-100 text-stone-900 hover:bg-stone-200',
      outline: 'border border-stone-300 bg-transparent hover:bg-stone-100 text-stone-900',
      ghost: 'hover:bg-stone-100 text-stone-700',
      destructive: 'hover:bg-rose-50 text-rose-600',
    }[variant];

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, sizeStyles, variantStyles, className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
