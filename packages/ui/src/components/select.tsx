import React from 'react';
import { cn } from '../utils/cn';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, hasError = false, disabled, children, ...props }, ref) => {
    const baseStyles =
      'block w-full rounded-md border bg-white px-3 py-2 text-sm text-stone-900 ' +
      'transition-colors duration-150 ' +
      'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ' +
      'disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500 disabled:border-stone-200';

    const borderStyles = hasError
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500 text-rose-900'
      : 'border-stone-300';

    return (
      <div className="relative">
        <select
          ref={ref}
          disabled={disabled}
          aria-invalid={hasError ? 'true' : undefined}
          className={cn(baseStyles, borderStyles, 'appearance-none pr-8', className)}
          {...props}
        >
          {children}
        </select>
        <span
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-500 text-xs"
          aria-hidden="true"
        >
          ▼
        </span>
      </div>
    );
  },
);

Select.displayName = 'Select';
