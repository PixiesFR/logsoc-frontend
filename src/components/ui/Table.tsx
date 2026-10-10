import { useTranslation } from '../../i18n/useTranslation'

interface TableColumn {
  key: string
  label: string
  width?: string
}

interface TableProps {
  columns: TableColumn[]
  data: Record<string, unknown>[]
  renderCell?: (column: TableColumn, row: Record<string, unknown>) => React.ReactNode
  onRowClick?: (row: Record<string, unknown>) => void
  emptyMessage?: string
  loading?: boolean
}

function SkeletonRow({ columns }: { columns: TableColumn[] }) {
  return (
    <tr>
      {columns.map((col) => (
        <td key={col.key} style={{ padding: '12px 16px' }}>
          <div
            className="skeleton"
            style={{ height: '14px', borderRadius: '4px', width: '60%' }}
          />
        </td>
      ))}
    </tr>
  )
}

export function Table({ columns, data, renderCell, onRowClick, emptyMessage, loading = false }: TableProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-border)' }} className="table-wrapper">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    background: 'var(--color-bg-secondary)',
                    color: 'var(--color-text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    textTransform: 'uppercase' as const,
                    padding: '10px 16px',
                    textAlign: 'left',
                    borderBottom: '1px solid var(--color-border)',
                    width: col.width,
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map((i) => (
              <SkeletonRow key={i} columns={columns} />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: 'var(--color-text-secondary)',
          background: 'var(--color-bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--color-border)',
        }}
      >
        {emptyMessage ?? t('common.noData')}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-border)' }} className="table-wrapper">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-secondary)',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase' as const,
                  padding: '10px 16px',
                  textAlign: 'left',
                  borderBottom: '1px solid var(--color-border)',
                  width: col.width,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={String(row.id ?? rowIdx)}
              style={{ borderBottom: '1px solid var(--color-border)', cursor: onRowClick ? 'pointer' : 'default' }}
              onClick={() => onRowClick?.(row)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-bg-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: '12px 16px',
                    fontSize: '14px',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {renderCell
                    ? renderCell(col, row)
                    : String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}