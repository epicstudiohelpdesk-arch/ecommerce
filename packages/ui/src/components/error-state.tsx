import React from 'react';
import { cn } from '../utils/cn';
import { Button } from './button';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  className,
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  ...props
}) => {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 rounded-xl border border-rose-200 bg-rose-50/40',
        className,
      )}
      {...props}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 text-xl font-bold">
        !
      </div>
      <h3 className="text-lg font-semibold text-rose-950 tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-rose-800 max-w-md leading-relaxed">{message}</p>
      {onRetry && (
        <div className="mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-rose-300 hover:bg-rose-100 text-rose-900"
          >
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
