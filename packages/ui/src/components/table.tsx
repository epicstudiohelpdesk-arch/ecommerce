import React from 'react';
import { cn } from '../utils/cn';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  dense?: boolean;
}

export const Table: React.FC<TableProps> = ({ className, dense = false, children, ...props }) => {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm">
      <table
        className={cn('w-full text-left text-sm text-stone-700', dense && 'text-xs', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
};

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export const TableHeader: React.FC<TableHeaderProps> = ({ className, children, ...props }) => {
  return (
    <thead
      className={cn(
        'bg-stone-50 border-b border-stone-200 text-stone-600 font-semibold',
        className,
      )}
      {...props}
    >
      {children}
    </thead>
  );
};

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export const TableBody: React.FC<TableBodyProps> = ({ className, children, ...props }) => {
  return (
    <tbody className={cn('divide-y divide-stone-100 bg-white', className)} {...props}>
      {children}
    </tbody>
  );
};

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  isClickable?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  className,
  isClickable = false,
  children,
  ...props
}) => {
  return (
    <tr
      className={cn(
        'transition-colors',
        isClickable ? 'hover:bg-amber-50/50 cursor-pointer' : 'hover:bg-stone-50/80',
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
};

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {}

export const TableHead: React.FC<TableHeadProps> = ({ className, children, ...props }) => {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-3 text-xs uppercase tracking-wider font-semibold text-stone-600',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
};

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {}

export const TableCell: React.FC<TableCellProps> = ({ className, children, ...props }) => {
  return (
    <td className={cn('px-4 py-3.5 align-middle', className)} {...props}>
      {children}
    </td>
  );
};
