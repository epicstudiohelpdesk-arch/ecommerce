import React from 'react';
import { cn } from '../utils/cn';

export type OperationalStatus =
  | 'VERIFIED'
  | 'PENDING'
  | 'DRAFT'
  | 'REJECTED'
  | 'SUSPENDED'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'LOW_STOCK'
  | 'OUT_OF_STOCK';

export interface StatusIndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: OperationalStatus | string;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  className,
  status,
  label,
  size = 'md',
  ...props
}) => {
  const normalized = status.toUpperCase();

  const config: Record<string, { dot: string; text: string; bg: string; border: string }> = {
    VERIFIED: {
      dot: 'bg-emerald-500',
      text: 'text-emerald-800',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
    ACTIVE: {
      dot: 'bg-emerald-500',
      text: 'text-emerald-800',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
    PENDING: {
      dot: 'bg-amber-500',
      text: 'text-amber-800',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    DRAFT: {
      dot: 'bg-stone-400',
      text: 'text-stone-700',
      bg: 'bg-stone-100',
      border: 'border-stone-200',
    },
    REJECTED: {
      dot: 'bg-rose-500',
      text: 'text-rose-800',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
    },
    SUSPENDED: {
      dot: 'bg-rose-500',
      text: 'text-rose-800',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
    },
    LOW_STOCK: {
      dot: 'bg-amber-500',
      text: 'text-amber-800',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    OUT_OF_STOCK: {
      dot: 'bg-rose-500',
      text: 'text-rose-800',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
    },
  };

  const style = config[normalized] || {
    dot: 'bg-stone-400',
    text: 'text-stone-700',
    bg: 'bg-stone-100',
    border: 'border-stone-200',
  };

  const displayLabel = label || normalized.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium select-none',
        style.bg,
        style.border,
        style.text,
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs',
        className,
      )}
      {...props}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full shrink-0 animate-pulse', style.dot)}
        aria-hidden="true"
      />
      <span>{displayLabel}</span>
    </span>
  );
};
