interface DataTableProps {
  columns: Array<{ key: string; label: string; align?: 'left' | 'right' }>;
  rows: Array<Record<string, string | number>>;
  emptyMessage?: string;
}

export function DataTable({ columns, rows, emptyMessage = 'No data' }: DataTableProps) {
  if (rows.length === 0) {
    return <div className="table-empty">{emptyMessage}</div>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.align === 'right' ? 'text-right' : undefined}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td key={col.key} className={col.align === 'right' ? 'text-right mono' : 'mono'}>
                  {typeof row[col.key] === 'number'
                    ? (row[col.key] as number).toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })
                    : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
