import React from 'react';
import { cn } from '../utils/cn';

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical';
  variant?: 'subtle' | 'bold' | 'craft';
}

export const Divider: React.FC<DividerProps> = ({
  className,
  orientation = 'horizontal',
  variant = 'subtle',
  ...props
}) => {
  const variantStyles = {
    subtle: 'border-stone-200',
    bold: 'border-stone-300',
    craft: 'border-amber-300',
  }[variant];

  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn('inline-block h-full border-r', variantStyles, className)}
      />
    );
  }

  return (
    <hr
      role="separator"
      aria-orientation="horizontal"
      className={cn('w-full border-t my-4', variantStyles, className)}
      {...props}
    />
  );
};
