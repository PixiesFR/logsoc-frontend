import type { ReactNode } from 'react'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default'
type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  variant: BadgeVariant
  children: ReactNode
  size?: BadgeSize
}

const variantColors: Record<BadgeVariant, string> = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  default: 'var(--color-text-secondary)',
}

export function Badge({ variant, children, size = 'md' }: BadgeProps) {
  const color = variantColors[variant]
  const fontSize = size === 'sm' ? '11px' : '12px'
  const padding = size === 'sm' ? '2px 6px' : '4px 10px'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontSize,
        fontWeight: 600,
        padding,
        borderRadius: '9999px',
        color: color,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  )
}