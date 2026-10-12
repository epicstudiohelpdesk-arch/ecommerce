import React from 'react';
import { cn } from '../utils/cn';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, hasError = false, disabled, rows = 3, ...props }, ref) => {
    const baseStyles =
      'block w-full rounded-md border bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 ' +
      'transition-colors duration-150 ' +
      'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 ' +
      'disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-500 disabled:border-stone-200';

    const borderStyles = hasError
      ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500 text-rose-900'
      : 'border-stone-300';

    return (
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        aria-invalid={hasError ? 'true' : undefined}
        className={cn(baseStyles, borderStyles, className)}
        {...props}
      />
    );
  },
);

Textarea.displayName = 'Textarea';
