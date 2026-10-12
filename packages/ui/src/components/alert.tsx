import React from 'react';
import { cn } from '../utils/cn';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  onClose?: () => void;
}

export const Alert: React.FC<AlertProps> = ({
  className,
  variant = 'info',
  title,
  onClose,
  children,
  ...props
}) => {
  const variantStyles = {
    info: 'bg-indigo-50 border-indigo-200 text-indigo-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    error: 'bg-rose-50 border-rose-200 text-rose-900',
  }[variant];

  const iconGlyphs = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✕',
  }[variant];

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border text-sm',
        variantStyles,
        className,
      )}
      {...props}
    >
      <span className="font-bold shrink-0 text-base leading-none select-none" aria-hidden="true">
        {iconGlyphs}
      </span>
      <div className="flex-1 space-y-1">
        {title && <h5 className="font-semibold leading-tight">{title}</h5>}
        <div className="leading-relaxed text-inherit opacity-95">{children}</div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss alert"
          className="shrink-0 text-stone-500 hover:text-stone-800 transition-colors"
        >
          ✕
        </button>
      )}
    </div>
  );
};
