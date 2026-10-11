import React from 'react';
import { cn } from '../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card: React.FC<CardProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn('rounded-lg border border-stone-200 bg-white p-6 shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  );
};
