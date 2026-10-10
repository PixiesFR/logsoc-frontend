/**
 * TimelineExportButton — exports the crisis timeline as a PDF.
 * Ticket #44 — GET /api/v1/incidents/:id/crisis/timeline/export
 */
import { useState } from 'react'
import { Download } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import { crisisTimelineApi } from '../../api/crisis'
import { useToast } from '../ui/Toast'

interface TimelineExportButtonProps {
  incidentId: number
}

export function TimelineExportButton({ incidentId }: TimelineExportButtonProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const res = await crisisTimelineApi.exportPdf(incidentId)
      // Create a blob URL and trigger download
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crisis-timeline-${incidentId}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast('success', t('warRoom.exportSuccess'))
    } catch {
      toast('error', t('warRoom.exportError'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <button
      className="warroom-btn warroom-timeline-export-btn"
      onClick={handleExport}
      disabled={isExporting}
      title={t('warRoom.exportTimeline')}
      aria-label={t('warRoom.exportTimeline')}
    >
      <Download size={14} />
      {isExporting ? t('common.loading') : t('warRoom.export')}
    </button>
  )
}