import React from 'react';
import { cn } from '../utils/cn';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  description?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, description, id, disabled, ...props }, ref) => {
    return (
      <div className="flex items-start gap-2.5">
        <div className="flex h-5 items-center">
          <input
            id={id}
            ref={ref}
            type="checkbox"
            disabled={disabled}
            className={cn(
              'h-4 w-4 rounded border-stone-300 text-amber-600 ' +
                'focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 ' +
                'disabled:cursor-not-allowed disabled:opacity-50',
              className,
            )}
            {...props}
          />
        </div>
        {(label || description) && (
          <div className="flex flex-col text-xs sm:text-sm">
            {label && (
              <label
                htmlFor={id}
                className={cn(
                  'font-medium text-stone-900 select-none cursor-pointer',
                  disabled && 'cursor-not-allowed text-stone-400',
                )}
              >
                {label}
              </label>
            )}
            {description && <p className="text-stone-500 text-xs leading-normal">{description}</p>}
          </div>
        )}
      </div>
    );
  },
);

Checkbox.displayName = 'Checkbox';
