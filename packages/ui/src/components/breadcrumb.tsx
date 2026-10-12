import React from 'react';
import { cn } from '../utils/cn';

export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ className, children, ...props }) => {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex items-center text-xs text-stone-500', className)}
      {...props}
    >
      <ol className="flex items-center flex-wrap gap-1.5">{children}</ol>
    </nav>
  );
};

export interface BreadcrumbItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  isCurrent?: boolean;
}

export const BreadcrumbItem: React.FC<BreadcrumbItemProps> = ({
  className,
  isCurrent = false,
  children,
  ...props
}) => {
  return (
    <li
      className={cn('inline-flex items-center gap-1.5', className)}
      aria-current={isCurrent ? 'page' : undefined}
      {...props}
    >
      {children}
      {!isCurrent && (
        <span className="text-stone-300 select-none" aria-hidden="true">
          /
        </span>
      )}
    </li>
  );
};
