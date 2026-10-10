/**
 * ContactCard — a single crisis contact in the War Room directory.
 * Ticket #46 — Annuaire de crise (zone droite partie contacts).
 * Ticket #54 — Extended fields: first_name/last_name, phone_pro/phone_astreinte, mobile, priority, available_24_7, notes, vCard export.
 *
 * Displays: first_name + last_name, role, phone_pro, phone_astreinte, mobile, email, organization
 * Actions: Call pro (tel:), Call astreinte (tel:), Email (mailto:), vCard export
 * Badges: 24/7, Prioritaire
 */
import { Phone, Mail, Star, Clock, Download, Smartphone } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'
import type { CrisisContact } from '../../types/crisis'

interface ContactCardProps {
  contact: CrisisContact
}

/** Generate a vCard (.vcf) string for the contact. */
function generateVCard(contact: CrisisContact): string {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${contact.last_name};${contact.first_name};;;`,
    `FN:${contact.name}`,
    contact.role ? `TITLE:${contact.role}` : '',
    contact.organization ? `ORG:${contact.organization}` : '',
    contact.phone_pro ? `TEL;TYPE=WORK,VOICE:${contact.phone_pro}` : '',
    contact.phone_astreinte ? `TEL;TYPE=AFTER HOURS,VOICE:${contact.phone_astreinte}` : '',
    contact.mobile ? `TEL;TYPE=CELL,VOICE:${contact.mobile}` : '',
    contact.email ? `EMAIL:${contact.email}` : '',
    contact.notes ? `NOTE:${contact.notes}` : '',
    'END:VCARD',
  ].filter(Boolean)
  return lines.join('\n')
}

/** Download a vCard file for the contact. */
function downloadVCard(contact: CrisisContact) {
  const vcard = generateVCard(contact)
  const blob = new Blob([vcard], { type: 'text/vcard' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${contact.first_name}_${contact.last_name}.vcf`.replace(/\s+/g, '_')
  a.click()
  URL.revokeObjectURL(url)
}

export function ContactCard({ contact }: ContactCardProps) {
  const { t } = useTranslation()

  const displayName = contact.name || `${contact.first_name} ${contact.last_name}`.trim() || '—'
  const callProAria = t('crisis.contacts.callProAria', { name: displayName, phone: contact.phone_pro })
  const callAstreinteAria = t('crisis.contacts.callAstreinteAria', { name: displayName, phone: contact.phone_astreinte })
  const emailAria = t('crisis.contacts.emailAria', { name: displayName, email: contact.email })
  const vcardAria = t('crisis.contacts.vcardAria', { name: displayName })

  return (
    <div className="warroom-contact-card">
      <div className="warroom-contact-card-header">
        <div className="warroom-contact-avatar">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <div className="warroom-contact-card-info">
          <div className="warroom-contact-name">
            {displayName}
            {contact.priority && (
              <span
                className="warroom-contact-priority-badge"
                title={t('crisis.contacts.priority')}
              >
                <Star size={10} fill="currentColor" />
              </span>
            )}
            {contact.available_24_7 && (
              <span
                className="warroom-contact-247-badge"
                title={t('crisis.contacts.available247')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  marginLeft: '4px',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  fontSize: '9px',
                  fontWeight: 600,
                  background: 'var(--color-crisis-accent, var(--color-accent))',
                  color: 'var(--color-crisis-text, #fff)',
                }}
              >
                <Clock size={9} />
                24/7
              </span>
            )}
          </div>
          <div className="warroom-contact-role">{contact.role}</div>
          {contact.organization && (
            <div className="warroom-contact-org">{contact.organization}</div>
          )}
          {contact.notes && (
            <div className="warroom-contact-notes" style={{
              fontSize: '11px',
              fontStyle: 'italic',
              color: 'var(--color-text-secondary)',
              marginTop: '2px',
            }}>
              {contact.notes}
            </div>
          )}
        </div>
      </div>
      <div className="warroom-contact-card-actions" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        marginTop: '8px',
      }}>
        {contact.phone_pro && (
          <a
            href={`tel:${contact.phone_pro}`}
            className="warroom-contact-btn warroom-contact-btn-call"
            aria-label={callProAria}
            title={t('crisis.contacts.callPro')}
          >
            <Phone size={13} />
            <span>{t('crisis.contacts.callPro')}</span>
          </a>
        )}
        {contact.phone_astreinte && (
          <a
            href={`tel:${contact.phone_astreinte}`}
            className="warroom-contact-btn warroom-contact-btn-call"
            aria-label={callAstreinteAria}
            title={t('crisis.contacts.callAstreinte')}
            style={{
              background: 'var(--color-crisis-accent, var(--color-accent))',
            }}
          >
            <Phone size={13} />
            <span>{t('crisis.contacts.callAstreinte')}</span>
          </a>
        )}
        {contact.mobile && (
          <a
            href={`tel:${contact.mobile}`}
            className="warroom-contact-btn warroom-contact-btn-call"
            aria-label={t('crisis.contacts.callMobile', { name: displayName, phone: contact.mobile })}
            title={t('crisis.contacts.callMobile')}
          >
            <Smartphone size={13} />
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="warroom-contact-btn warroom-contact-btn-email"
            aria-label={emailAria}
          >
            <Mail size={13} />
          </a>
        )}
        <button
          className="warroom-contact-btn"
          onClick={() => downloadVCard(contact)}
          aria-label={vcardAria}
          title={t('crisis.contacts.exportVcard')}
          style={{
            background: 'transparent',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
            padding: '4px 6px',
            borderRadius: '4px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            fontSize: '12px',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Download size={13} />
        </button>
      </div>
    </div>
  )
}