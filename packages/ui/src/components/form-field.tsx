import React from 'react';
import { cn } from '../utils/cn';

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  helperText?: string;
  errorText?: string;
  id?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  className,
  label,
  htmlFor,
  required = false,
  helperText,
  errorText,
  children,
  id,
  ...props
}) => {
  const helperId = id ? `${id}-helper` : undefined;
  const errorId = id ? `${id}-error` : undefined;

  return (
    <div className={cn('space-y-1.5 w-full', className)} {...props}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-xs font-semibold uppercase tracking-wider text-stone-700 select-none"
        >
          {label}
          {required && (
            <span className="ml-1 text-rose-500 font-bold" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div>{children}</div>
      {helperText && !errorText && (
        <p id={helperId} className="text-xs text-stone-500 leading-normal">
          {helperText}
        </p>
      )}
      {errorText && (
        <p id={errorId} role="alert" className="text-xs font-medium text-rose-600 leading-normal">
          {errorText}
        </p>
      )}
    </div>
  );
};
