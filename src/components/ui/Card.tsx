import type { CSSProperties, ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  style?: CSSProperties
}

export function Card({ children, className = '', onClick, style }: CardProps) {
  return (
    <div
      className={className}
      onClick={onClick}
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        padding: '16px',
        background: 'var(--color-bg-secondary)',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  )
}