import React from 'react';
import { cn } from '../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 rounded-md';

  const variantStyles = {
    primary: 'bg-stone-900 text-stone-50 hover:bg-stone-800',
    secondary: 'bg-stone-100 text-stone-900 hover:bg-stone-200',
    outline: 'border border-stone-300 bg-transparent hover:bg-stone-100 text-stone-900',
    ghost: 'hover:bg-stone-100 text-stone-700',
  }[variant];

  const sizeStyles = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 py-2 text-sm',
    lg: 'h-12 px-6 text-base',
  }[size];

  return (
    <button className={cn(baseStyles, variantStyles, sizeStyles, className)} {...props}>
      {children}
    </button>
  );
};
