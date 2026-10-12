import React from 'react';
import { cn } from '../utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive' | 'elevated' | 'artisan';
}

export const Card: React.FC<CardProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-white border border-stone-200 shadow-sm',
    interactive:
      'bg-white border border-stone-200 shadow-sm hover:shadow-md hover:border-amber-300 transition-all duration-200 cursor-pointer',
    elevated: 'bg-white border border-stone-200/80 shadow-md',
    artisan:
      'bg-stone-50/50 border border-amber-200/60 shadow-sm hover:shadow-craft hover:border-amber-400 transition-all duration-200',
  }[variant];

  return (
    <div className={cn('rounded-lg p-6', variantStyles, className)} {...props}>
      {children}
    </div>
  );
};

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader: React.FC<CardHeaderProps> = ({ className, children, ...props }) => {
  return (
    <div className={cn('flex flex-col space-y-1.5 pb-4', className)} {...props}>
      {children}
    </div>
  );
};

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export const CardTitle: React.FC<CardTitleProps> = ({
  className,
  as: Component = 'h3',
  children,
  ...props
}) => {
  return (
    <Component
      className={cn('text-lg font-semibold leading-none tracking-tight text-stone-900', className)}
      {...props}
    >
      {children}
    </Component>
  );
};

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription: React.FC<CardDescriptionProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <p className={cn('text-sm text-stone-500 leading-relaxed', className)} {...props}>
      {children}
    </p>
  );
};

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent: React.FC<CardContentProps> = ({ className, children, ...props }) => {
  return (
    <div className={cn('pt-0', className)} {...props}>
      {children}
    </div>
  );
};

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter: React.FC<CardFooterProps> = ({ className, children, ...props }) => {
  return (
    <div className={cn('flex items-center pt-4 border-t border-stone-100', className)} {...props}>
      {children}
    </div>
  );
};
