import React from 'react';
import { cn } from '../utils/cn';

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  align?: 'left' | 'center';
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  className,
  eyebrow,
  title,
  description,
  action,
  align = 'left',
  ...props
}) => {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6',
        align === 'center' && 'text-center sm:items-center sm:justify-center',
        className,
      )}
      {...props}
    >
      <div className={cn('space-y-1', align === 'center' && 'mx-auto')}>
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">{eyebrow}</p>
        )}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">{title}</h2>
        {description && (
          <p className="text-sm sm:text-base text-stone-600 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
