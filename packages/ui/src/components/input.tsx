import React from 'react';
import { cn } from '../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, hasError = false, leftAddon, rightAddon, disabled, ...props }, ref) => {
    const baseStyles =
      'block w-full rounded-md border bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 ' +
      'transition-colors duration-150 ' +
      'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ' +
      'disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500 disabled:border-stone-200';

    const borderStyles = hasError
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500 text-rose-900'
      : 'border-stone-300';

    if (leftAddon || rightAddon) {
      return (
        <div className="relative flex items-center w-full">
          {leftAddon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-stone-400">
              {leftAddon}
            </div>
          )}
          <input
            ref={ref}
            disabled={disabled}
            aria-invalid={hasError ? 'true' : undefined}
            className={cn(
              baseStyles,
              borderStyles,
              Boolean(leftAddon) && 'pl-9',
              Boolean(rightAddon) && 'pr-9',
              className,
            )}
            {...props}
          />
          {rightAddon && (
            <div className="absolute right-3 flex items-center pointer-events-none text-stone-400">
              {rightAddon}
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={hasError ? 'true' : undefined}
        className={cn(baseStyles, borderStyles, className)}
        {...props}
      />
    );
  },
);

Input.displayName = 'Input';
