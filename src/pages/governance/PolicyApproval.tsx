import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { governanceApi } from '../../api'
import { Card, Badge, Button, Modal } from '../../components/ui'
import { PolicySummaryCard } from '../../components/governance/PolicySummaryCard'
import { useToast } from '../../components/ui/Toast'
import { usePermissions } from '../../hooks/usePermissions'
import { Shield, FileText, Check, X, ArrowLeft } from 'lucide-react'

function policyStatusBadge(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (status) {
    case 'active':
    case 'approved':
    case 'published':
      return 'success'
    case 'draft':
      return 'default'
    case 'review':
      return 'info'
    case 'deprecated':
    case 'archived':
      return 'danger'
    default:
      return 'default'
  }
}

export function PolicyApproval() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()
  const { canView } = usePermissions()

  const policyId = id ? Number(id) : NaN

  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState('')
  const [showFullDoc, setShowFullDoc] = useState(false)

  const { data: policyData, isLoading } = useQuery({
    queryKey: ['governance', 'policy', policyId],
    queryFn: () => governanceApi.getPolicy(policyId).then((r) => r.data),
    enabled: !isNaN(policyId),
  })

  const policy = policyData as Record<string, unknown> | null

  const approveMutation = useMutation({
    mutationFn: () => governanceApi.approvePolicy(policyId, comment ? { comment } : {}),
    onSuccess: () => {
      toast('success', t('governance.policies.approvedSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'policies'] })
      qc.invalidateQueries({ queryKey: ['governance', 'policy'] })
      navigate('/', { replace: true })
    },
    onError: () => toast('error', t('governance.policies.approvedError')),
  })

  const rejectMutation = useMutation({
    mutationFn: () => governanceApi.rejectPolicy(policyId, { comment }),
    onSuccess: () => {
      toast('success', t('governance.policies.rejectedSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'policies'] })
      qc.invalidateQueries({ queryKey: ['governance', 'policy'] })
      navigate('/', { replace: true })
    },
    onError: () => toast('error', t('governance.policies.rejectedError')),
  })

  const summary = useMemo(() => {
    if (!policy) return null
    const s = policy.summary as string | null | undefined
    return s ?? null
  }, [policy])

  const policyTitle = policy ? String(policy.title ?? '') : ''
  const policyVersion = policy ? String(policy.version ?? '1.0') : ''
  const policyStatus = policy ? String(policy.status ?? '') : ''
  const policyContent = policy ? String(policy.content ?? '') : ''

  function handleApprove() {
    // Comment is optional for approval
    approveMutation.mutate()
  }

  function handleReject() {
    // Comment is mandatory for rejection
    if (!comment.trim()) {
      setCommentError(t('governance.policies.rejectCommentRequired'))
      return
    }
    setCommentError('')
    rejectMutation.mutate()
  }

  // Access control: viewer with approval permission can access
  // For now, any authenticated user (canView) can access — the backend enforces role-based approval
  if (!canView('viewer')) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '48px 24px',
          textAlign: 'center',
        }}
      >
        <Shield size={48} style={{ color: 'var(--color-text-secondary)' }} />
        <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', margin: 0 }}>
          {t('common.noPermission')}
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
          color: 'var(--color-text-secondary)',
        }}
      >
        <p style={{ fontSize: '16px' }}>{t('common.loading')}</p>
      </div>
    )
  }

  if (!policy) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '48px 24px',
          textAlign: 'center',
        }}
      >
        <FileText size={48} style={{ color: 'var(--color-text-secondary)' }} />
        <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', margin: 0 }}>
          {t('governance.policies.notFound')}
        </p>
        <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => navigate('/governance/policies')}>
          {t('governance.policies.backToPolicies')}
        </Button>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      {/* Title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            margin: 0,
          }}
        >
          {t('governance.policies.approvalRequired')}
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--color-text-secondary)', margin: 0 }}>
          {policyTitle} v{policyVersion}
        </p>
      </div>

      {/* Status badge */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <Badge variant={policyStatusBadge(policyStatus)}>{policyStatus}</Badge>
      </div>

      {/* AI Summary */}
      <PolicySummaryCard summary={summary} />

      {/* View full document button */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="secondary"
          icon={<FileText size={16} />}
          onClick={() => setShowFullDoc(true)}
        >
          {t('governance.policies.viewFullDocument')}
        </Button>
      </div>

      {/* Comment field */}
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label
            htmlFor="approval-comment"
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--color-text-secondary)',
            }}
          >
            {t('governance.policies.approvalComment')}
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
              ({t('governance.policies.commentOptionalApprove')})
            </span>
          </label>
          <textarea
            id="approval-comment"
            value={comment}
            onChange={(e) => {
              setComment(e.target.value)
              if (commentError) setCommentError('')
            }}
            rows={4}
            placeholder={t('governance.policies.commentPlaceholder')}
            style={{
              padding: '12px',
              fontSize: '14px',
              borderRadius: '8px',
              border: `1px solid ${commentError ? 'var(--color-danger)' : 'var(--color-border)'}`,
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
          {commentError && (
            <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{commentError}</span>
          )}
        </div>
      </Card>

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Button
              variant="danger"
              size="md"
              icon={<X size={18} />}
              onClick={handleReject}
              disabled={rejectMutation.isPending || approveMutation.isPending}
            >
              {rejectMutation.isPending
                ? t('governance.policies.rejecting')
                : t('governance.policies.reject')}
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<Check size={18} />}
              onClick={handleApprove}
              disabled={approveMutation.isPending || rejectMutation.isPending}
            >
              {approveMutation.isPending
                ? t('governance.policies.approving')
                : t('governance.policies.approve')}
            </Button>
          </div>
        </div>
      </div>

      {/* Full document modal (read-only) */}
      {showFullDoc && (
        <Modal
          open={showFullDoc}
          onClose={() => setShowFullDoc(false)}
          title={`${policyTitle} v${policyVersion}`}
          size="lg"
        >
          <div
            style={{
              fontSize: '14px',
              color: 'var(--color-text-primary)',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
              maxHeight: '60vh',
              overflowY: 'auto',
            }}
          >
            {policyContent || t('governance.policies.noContent')}
          </div>
        </Modal>
      )}
    </div>
  )
}