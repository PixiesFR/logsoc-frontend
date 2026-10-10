import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div style={{
      fontSize: '13px',
      color: 'var(--color-text-secondary)',
      lineHeight: '1.6',
    }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              margin: '8px 0',
            }}>
              {children}
            </table>
          ),
          thead: ({ children }) => (
            <thead style={{ background: 'var(--color-bg-secondary)' }}>
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th style={{
              padding: '8px 12px',
              textAlign: 'left',
              borderBottom: '2px solid var(--color-border)',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              whiteSpace: 'nowrap',
            }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{
              padding: '6px 12px',
              borderBottom: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              verticalAlign: 'top',
            }}>
              {children}
            </td>
          ),
          p: ({ children }) => (
            <p style={{ margin: '4px 0' }}>{children}</p>
          ),
          hr: () => (
            <hr style={{
              border: 'none',
              borderTop: '1px solid var(--color-border)',
              margin: '12px 0',
            }} />
          ),
          strong: ({ children }) => (
            <strong style={{ color: 'var(--color-text-primary)' }}>{children}</strong>
          ),
          h2: ({ children }) => (
            <h2 style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              margin: '12px 0 4px',
            }}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              margin: '8px 0 4px',
            }}>{children}</h3>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}