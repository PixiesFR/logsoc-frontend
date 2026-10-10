/**
 * ContactsCategoryTabs — filter tabs for crisis contacts by category.
 * Ticket #46 — Annuaire de crise (zone droite partie contacts).
 *
 * Tabs: Tous / Interne / Juridique / Assurance / Autorités
 * Clicking a category filters the contact list.
 */
import { useTranslation } from '../../i18n/useTranslation'
import type { ContactCategory } from '../../types/crisis'

export type CategoryFilter = 'all' | ContactCategory

interface ContactsCategoryTabsProps {
  activeFilter: CategoryFilter
  onFilterChange: (filter: CategoryFilter) => void
  /** Available categories (only show tabs that have contacts). */
  availableCategories: ContactCategory[]
}

export function ContactsCategoryTabs({
  activeFilter,
  onFilterChange,
  availableCategories,
}: ContactsCategoryTabsProps) {
  const { t } = useTranslation()

  const tabs: { key: CategoryFilter; label: string }[] = [
    { key: 'all', label: t('crisis.contacts.filterAll') },
    ...availableCategories.map((cat) => ({
      key: cat as CategoryFilter,
      label: t(`crisis.contacts.category.${cat}`),
    })),
  ]

  return (
    <div className="warroom-contacts-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={activeFilter === tab.key}
          className={`warroom-contacts-tab ${activeFilter === tab.key ? 'warroom-contacts-tab-active' : ''}`}
          onClick={() => onFilterChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}