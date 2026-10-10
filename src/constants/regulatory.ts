/**
 * Regulatory deadline constants — NIS2, RGPD, DORA.
 * Ticket #48 — Sentinelles temporelles (War Room header countdowns).
 *
 * The RegulatoryRule type lives in types/crisis.ts for cross-module reuse.
 */
import type { RegulatoryRule } from '../types/crisis'

/**
 * The four regulatory sentinels displayed in the War Room header.
 * Order: NIS2 24h, RGPD 72h, DORA 4h, NIS2 1 month.
 */
export const REGULATORY_RULES: RegulatoryRule[] = [
  {
    key: 'nis2-24h',
    regulation: 'nis2',
    delayHours: 24,
    authority: 'ANSSI',
    legalKey: 'countdown.legal.nis2_24h',
    labelKey: 'countdown.label.nis2_24h',
    deadlineType: '24h',
  },
  {
    key: 'rgpd-72h',
    regulation: 'gdpr',
    delayHours: 72,
    authority: 'CNIL',
    legalKey: 'countdown.legal.rgpd_72h',
    labelKey: 'countdown.label.rgpd_72h',
    deadlineType: '72h',
  },
  {
    key: 'dora-4h',
    regulation: 'dora',
    delayHours: 4,
    authority: 'DORA',
    legalKey: 'countdown.legal.dora_4h',
    labelKey: 'countdown.label.dora_4h',
    deadlineType: '4h',
  },
  {
    key: 'nis2-1m',
    regulation: 'nis2',
    delayHours: 24 * 30, // ~1 month (30 days)
    authority: 'ANSSI',
    legalKey: 'countdown.legal.nis2_1m',
    labelKey: 'countdown.label.nis2_1m',
    deadlineType: '1m',
  },
]