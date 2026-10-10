import re

with open('src/pages/governance/GovernanceActionPlanFiltered.tsx', 'r') as f:
    content = f.read()

old_select = """                          <td style={{ padding: '0.5rem' }}>
                            <select
                              value={action.status}
                              onChange={(e) => updateStatusMutation.mutate({ actionId: action.id, status: e.target.value })}
                              style={{ padding: '0.25rem', background: 'var(--color-input)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.8rem' }}
                            >
                              {ACTION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                            </select>
                          </td>"""

new_select = """                          <td style={{ padding: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <button
                                onClick={() => {
                                  const idx = ACTION_STATUSES.indexOf(action.status)
                                  if (idx > 0) updateStatusMutation.mutate({ actionId: action.id, status: ACTION_STATUSES[idx - 1] })
                                }}
                                disabled={action.status === ACTION_STATUSES[0]}
                                style={{ background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: action.status === ACTION_STATUSES[0] ? 'not-allowed' : 'pointer', padding: '2px 4px', opacity: action.status === ACTION_STATUSES[0] ? 0.4 : 1, color: 'var(--color-text)' }}
                                title="Statut precedent"
                              >
                                <ArrowLeft size={14} />
                              </button>
                              <select
                                value={action.status}
                                onChange={(e) => updateStatusMutation.mutate({ actionId: action.id, status: e.target.value })}
                                style={{ padding: '0.25rem', background: 'var(--color-input)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.8rem' }}
                              >
                                {ACTION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                              </select>
                              <button
                                onClick={() => {
                                  const idx = ACTION_STATUSES.indexOf(action.status)
                                  if (idx < ACTION_STATUSES.length - 1) updateStatusMutation.mutate({ actionId: action.id, status: ACTION_STATUSES[idx + 1] })
                                }}
                                disabled={action.status === ACTION_STATUSES[ACTION_STATUSES.length - 1]}
                                style={{ background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: action.status === ACTION_STATUSES[ACTION_STATUSES.length - 1] ? 'not-allowed' : 'pointer', padding: '2px 4px', opacity: action.status === ACTION_STATUSES[ACTION_STATUSES.length - 1] ? 0.4 : 1, color: 'var(--color-text)' }}
                                title="Statut suivant"
                              >
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          </td>"""

if old_select in content:
    content = content.replace(old_select, new_select)
    with open('src/pages/governance/GovernanceActionPlanFiltered.tsx', 'w') as f:
        f.write(content)
    print('Patch applied successfully')
else:
    print('ERROR: old_select not found in file')