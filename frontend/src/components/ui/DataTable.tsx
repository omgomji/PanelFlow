import * as React from 'react';

export function DataTable({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-auto border-y border-ink">
      <table className={`w-full text-left text-sm ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function DataTableHeader({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={`border-b-2 border-ink font-display text-ink uppercase tracking-wider text-xs ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function DataTableBody({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={`divide-y divide-clay/30 font-mono text-ink ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function DataTableRow({ className = '', children, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={`transition-colors hover:bg-clay/5 ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function DataTableHead({ className = '', children, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={`p-4 font-bold align-middle ${className}`} {...props}>
      {children}
    </th>
  );
}

export function DataTableCell({ className = '', children, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={`p-4 align-middle ${className}`} {...props}>
      {children}
    </td>
  );
}
