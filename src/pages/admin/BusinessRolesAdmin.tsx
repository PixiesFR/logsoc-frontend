import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Badge, Button, Input, Modal, Table, EmptyState } from '../../components/ui'
import { businessRolesApi } from '../../api'
import { useToast } from '../../components/ui/Toast'
import { useTranslation } from '../../i18n/useTranslation'

// Page admin: référentiel des casquettes métier (business_roles_ref).
// Liste fermée administrable qui alimente les checkboxes Users.
// Codes seedés (rssi, dpo, dsi, gerant, president, compliance, juriste, auditeur)
// = VERROUILLÉS: utilisés en dur par les gardes signature/validation backend.
// Désactivation = soft-delete; refusée si des users actifs portent la casquette.

export function BusinessRolesAdmin() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [code, setCode] = useState('')
  const [label, setLabel] = useState('')

  const { data: roles, isLoading } = useQuery({
    queryKey: ['business-roles', 'all'],
    queryFn: () => businessRolesApi.list().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => businessRolesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-roles'] })
      setShowCreate(false); setCode(''); setLabel('')
      toast('success', t('businessRoles.created'))
    },
    onError: (e: any) => toast('error', e?.response?.data?.detail || t('businessRoles.createError')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => businessRolesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['business-roles'] }); toast('success', t('businessRoles.updated')) },
    onError: (e: any) => toast('error', e?.response?.data?.detail || t('businessRoles.updateError')),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => businessRolesApi.deactivate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['business-roles'] }); toast('success', t('businessRoles.softDeleted')) },
    onError: (e: any) => toast('error', e?.response?.data?.detail || t('businessRoles.disableError')),
  })

  const rows: Record<string, unknown>[] = (roles as any[] | undefined) ?? []

  const columns = [
    { key: 'code', label: 'Code' },
    { key: 'label', label: 'Libellé' },
    { key: 'is_seeded', label: 'Type' },
    { key: 'user_count', label: t('businessRoles.users') },
    { key: 'active', label: 'Statut' },
    { key: 'actions', label: '' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>{t('businessRoles.title')}</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
            Liste fermée des fonctions métier (Service / Direction) assignables aux utilisateurs. Un utilisateur peut cumuler
            plusieurs casquettes (ex. DSI + RSSI). Les codes canoniques sont verrouillés — seuls le libellé et le tri sont modifiables.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>{t('businessRoles.new')}</Button>
      </div>

      <Card>
        {rows.length === 0 && !isLoading && <EmptyState title="Aucune casquette" />}
        {rows.length > 0 && (
          <Table
            columns={columns}
            data={rows}
            loading={isLoading}
            renderCell={(col, row) => {
              if (col.key === 'is_seeded')
                return <Badge variant={row.is_seeded ? 'warning' : 'default'}>{row.is_seeded ? t('businessRoles.canonical') : t('businessRoles.administrable')}</Badge>
              if (col.key === 'active')
                return <Badge variant={row.active ? 'success' : 'default'}>{row.active ? 'Active' : 'Inactive'}</Badge>
              if (col.key === 'user_count')
                return <Badge variant={Number(row.user_count) > 0 ? 'info' : 'default'}>{String(row.user_count)}</Badge>
              if (col.key === 'actions') {
                const r = row as any
                return (
                  <span style={{ display: 'flex', gap: '6px' }}>
                    {!r.is_seeded && r.active && (
                      <Button size="sm" variant="secondary"
                        onClick={() => {
                          if (confirm(`Désactiver '${r.label}' ?`))
                            deactivateMutation.mutate(Number(r.id))
                        }}>
                        Désactiver
                      </Button>
                    )}
                    {!r.active && (
                      <Button size="sm" variant="secondary"
                        onClick={() => updateMutation.mutate({ id: Number(r.id), data: { active: true } })}>
                        Réactiver
                      </Button>
                    )}
                  </span>
                )
              }
              return String(row[col.key] ?? '')
            }}
          />
        )}
      </Card>

      {showCreate && (
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nouvelle casquette métier" footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>{t('businessRoles.cancel')}</Button>
            <Button
              onClick={() => createMutation.mutate({ code: code.trim().toLowerCase(), label: label.trim() })}
              disabled={!code.trim() || !label.trim()}>
              Créer
            </Button>
          </>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label="Code (minuscules, chiffres, _ — ex. 'rssi_adjoint')" value={code} onChange={setCode} />
            <Input label="Libellé affiché (ex. 'RSSI adjoint')" value={label} onChange={setLabel} />
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Le code est utilisable immédiatement dans les rôles de vérification des livrables (champ « Rôle de vérification »).
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}