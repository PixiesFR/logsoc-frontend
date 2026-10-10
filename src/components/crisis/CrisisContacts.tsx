/**
 * CrisisContacts — main component for the War Room right zone (contacts part).
 * Ticket #46 — Annuaire de crise (zone droite, partie contacts).
 *
 * Features:
 * - Fetches contacts via useCrisisContacts hook (5 min cache + country filter)
 * - Grouped by category (interne / juridique / assurance / autorités)
 * - Collapsible category headers (sticky)
 * - Category filter tabs
 * - Graceful fallback when no contacts or API 404
 * - Direct actions: tel: / mailto:
 */
import { useState, useMemo, useCallback } from 'react'
import { Users } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import { useCrisisContacts } from '../../hooks/useCrisisContacts'
import { ContactCard } from './ContactCard'
import { ContactsCategoryTabs, type CategoryFilter } from './ContactsCategoryTabs'
import type { ContactCategory } from '../../types/crisis'

export function CrisisContacts() {
  const { t } = useTranslation()
  const { groupedContacts, contacts, isLoading, error } = useCrisisContacts()
  const [activeFilter, setActiveFilter] = useState<CategoryFilter>('all')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  // Available categories for tabs
  const availableCategories = useMemo<ContactCategory[]>(
    () => groupedContacts.map((g) => g.category),
    [groupedContacts],
  )

  // Filtered groups based on active tab
  const filteredGroups = useMemo(() => {
    if (activeFilter === 'all') return groupedContacts
    return groupedContacts.filter((g) => g.category === activeFilter)
  }, [groupedContacts, activeFilter])

  const handleFilterChange = useCallback((filter: CategoryFilter) => {
    setActiveFilter(filter)
  }, [])

  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  const hasContacts = contacts.length > 0
  const hasError = !!error && !isLoading

  return (
    <div className="warroom-zone">
      <div className="warroom-zone-header">
        <Users size={16} style={{ color: 'var(--color-crisis-text)' }} />
        {t('crisis.contacts.title')}
      </div>

      {hasContacts && (
        <ContactsCategoryTabs
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          availableCategories={availableCategories}
        />
      )}

      <div className="warroom-zone-content" aria-live="polite" aria-label={t('crisis.contacts.title')}>
        {isLoading && (
          <div className="warroom-contacts-empty">{t('common.loading')}</div>
        )}

        {!isLoading && !hasContacts && !hasError && (
          <div className="warroom-contacts-empty">{t('crisis.contacts.noContacts')}</div>
        )}

        {!isLoading && !hasContacts && hasError && (
          <div className="warroom-contacts-empty">{t('crisis.contacts.noContacts')}</div>
        )}

        {!isLoading && hasContacts && filteredGroups.length > 0 && (
          <div className="warroom-contacts-list">
            {filteredGroups.map((group) => {
              const isCollapsed = collapsedCategories.has(group.category)
              return (
                <div key={group.category} className="warroom-contacts-group">
                  <button
                    className="warroom-contacts-group-header"
                    onClick={() => toggleCategory(group.category)}
                    aria-expanded={!isCollapsed}
                    aria-label={t(`crisis.contacts.category.${group.category}`)}
                  >
                    <span>{t(`crisis.contacts.category.${group.category}`)}</span>
                    <span className="warroom-contacts-group-count">
                      {group.contacts.length}
                    </span>
                    <span className="warroom-contacts-group-chevron">
                      {isCollapsed ? '▸' : '▾'}
                    </span>
                  </button>
                  {!isCollapsed && (
                    <div className="warroom-contacts-group-items">
                      {group.contacts.map((contact) => (
                        <ContactCard key={contact.id} contact={contact} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}