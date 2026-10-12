import React from 'react';
import { cn } from '../utils/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'craft';
  size?: 'sm' | 'md';
  withDot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  size = 'md',
  withDot = false,
  children,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center font-medium rounded-full select-none';

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[11px] gap-1',
    md: 'px-2.5 py-0.5 text-xs gap-1.5',
  }[size];

  const variantStyles = {
    default: 'bg-stone-100 text-stone-800 border border-stone-200',
    success: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200',
    destructive: 'bg-rose-50 text-rose-800 border border-rose-200',
    info: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
    craft: 'bg-amber-100 text-amber-900 border border-amber-300 font-semibold',
  }[variant];

  const dotStyles = {
    default: 'bg-stone-400',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    destructive: 'bg-rose-500',
    info: 'bg-indigo-500',
    craft: 'bg-amber-600',
  }[variant];

  return (
    <span className={cn(baseStyles, sizeStyles, variantStyles, className)} {...props}>
      {withDot && (
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dotStyles)} aria-hidden="true" />
      )}
      {children}
    </span>
  );
};
