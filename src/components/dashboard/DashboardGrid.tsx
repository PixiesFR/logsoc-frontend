import { useState, type ReactNode } from 'react'

interface DashboardGridProps {
  widgetIds: string[]
  onReorder: (ids: string[]) => void
  renderWidget: (id: string) => ReactNode
}

export function DashboardGrid({ widgetIds, onReorder, renderWidget }: DashboardGridProps) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)

  function handleDragStart(idx: number) {
    setDragIdx(idx)
  }

  function handleDragEnter(idx: number) {
    if (dragIdx === null || dragIdx === idx) return
    const newIds = [...widgetIds]
    const [moved] = newIds.splice(dragIdx, 1)
    newIds.splice(idx, 0, moved)
    onReorder(newIds)
    setDragIdx(idx)
  }

  function handleDragEnd() {
    setDragIdx(null)
    setOverIdx(null)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '16px',
      }}
    >
      {widgetIds.map((id, idx) => (
        <div
          key={id}
          draggable
          onDragStart={() => handleDragStart(idx)}
          onDragEnter={() => handleDragEnter(idx)}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          style={{
            cursor: 'grab',
            opacity: dragIdx === idx ? 0.5 : 1,
            border: overIdx === idx ? '2px solid var(--color-accent)' : '2px solid transparent',
            borderRadius: '12px',
            transition: 'opacity 0.2s, border-color 0.2s',
          }}
        >
          {renderWidget(id)}
        </div>
      ))}
    </div>
  )
}