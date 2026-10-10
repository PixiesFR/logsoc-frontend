import type { EventItem } from '../api/types'

/**
 * Clean a filename that may contain technical prefixes like `<no_fd_resolved:file.dat>`.
 * In expert mode, returns the raw value as-is.
 * In normal mode, extracts just the filename after the colon, or a friendly fallback.
 */
export function cleanFilename(raw: string, expertMode: boolean): string {
  if (expertMode) return raw

  // Pattern: <no_fd_resolved:filename.ext> or <unknown:filename.ext>
  const fdMatch = raw.match(/^<[^:]+:(.+)>$/)
  if (fdMatch) return fdMatch[1]

  // Pattern: <unknown>
  if (raw === '<unknown>') return '(fichier inconnu)'

  return raw
}

/**
 * Format an event message for human-readable display.
 * In expert mode, returns raw message.
 * In normal mode, parses JSON and produces a human-friendly French description.
 */
export function formatEventMessage(event: EventItem, expertMode: boolean): string {
  if (expertMode) {
    return event.message || ''
  }

  const msg = event.message || ''
  const eventType = event.event || ''

  // Handle "eBPF event: <type> {...}" pattern — extract the JSON payload after the prefix
  let jsonPayload = msg
  const ebpfMatch = msg.match(/^eBPF event:\s*\w+\s*(\{.*\})\s*$/s)
  if (ebpfMatch) {
    jsonPayload = ebpfMatch[1]
  }

  // Try to parse JSON message for structured data
  let parsed: Record<string, unknown> | null = null
  try {
    if (jsonPayload.startsWith('{')) {
      parsed = JSON.parse(jsonPayload)
    }
  } catch {
    // Not JSON, use as-is
  }

  const comm = event.comm || (parsed?.comm as string) || ''
  const pid = event.pid || (parsed?.pid as number)
  const username = event.username || (parsed?.username as string) || ''
  const rawFilename = event.filename || (parsed?.filename as string) || (parsed?.path as string) || ''
  const filename = rawFilename ? cleanFilename(rawFilename, expertMode) : ''
  const dstIp = event.dst_ip || (parsed?.dst_ip as string) || ''
  const dstPort = event.dst_port || (parsed?.dst_port as number)

  switch (eventType) {
    case 'vfs_open':
      return `Ouverture du fichier ${filename} par ${comm}${pid ? ` (PID ${pid}` : ''}${username ? `, ${username}` : ''}${pid ? ')' : ''}`

    case 'commit_creds':
      return `Changement de privilèges par ${comm}${pid ? ` (PID ${pid}` : ''}${username ? `, ${username}` : ''}${pid ? ')' : ''}`

    case 'fork':
      return `Création de processus : parent a lancé ${comm}${pid ? ` (PID ${pid})` : ''}`

    case 'FIM write':
    case 'fim_v4_8':
    case 'fim':
      return `Modification du fichier ${filename || cleanFilename(msg, expertMode)}`

    case 'connect':
      return `Connexion réseau vers ${dstIp}${dstPort ? `:${dstPort}` : ''} par ${comm}`

    case 'accept':
      return `Connexion acceptée par ${comm}${pid ? ` (PID ${pid}` : ''}${username ? `, ${username}` : ''}${pid ? ')' : ''}`

    case 'execve':
      return `Programme lancé : ${comm || msg}`

    case 'unlink':
      return `Fichier supprimé : ${filename || cleanFilename(msg, expertMode)}`

    case 'open':
      return `Fichier ouvert : ${filename || cleanFilename(msg, expertMode)}`

    case 'auth':
      return `Authentification : ${username || comm || msg}`

    default:
      // If parsed JSON, try to extract a meaningful line
      if (parsed) {
        const p = parsed
        const rawPath = (p.path as string) || (p.filename as string) || ''
        const path = rawPath ? cleanFilename(rawPath, expertMode) : ''
        const pComm = (p.comm as string) || comm
        const pPid = (p.pid as number) || pid
        const _pUser = (p.username as string) || username; void _pUser
        if (path) return `Événement sur ${path}${pComm ? ` par ${pComm}` : ''}${pPid ? ` (PID ${pPid})` : ''}`
        if (pComm) return `Événement par ${pComm}${pPid ? ` (PID ${pPid})` : ''}`
      }
      // If message still contains "eBPF event:" prefix, strip it for readability
      if (!expertMode && msg.startsWith('eBPF event:')) {
        const stripped = msg.replace(/^eBPF event:\s*/, '')
        // If what remains is JSON, try to extract comm/pid
        try {
          const remaining = JSON.parse(stripped)
          const rComm = remaining.comm || comm
          const rPid = remaining.pid || pid
          if (rComm) return `Événement noyau par ${rComm}${rPid ? ` (PID ${rPid})` : ''}`
        } catch {
          // Not JSON, return stripped text
          return stripped
        }
      }
      return cleanFilename(msg, expertMode)
  }
}

/**
 * Translate alert titles from technical jargon to human-friendly French.
 * In expert mode, returns the original title.
 */
export function translateAlertTitle(title: string, expertMode: boolean): string {
  if (expertMode) return title

  let result = title

  // Replace multi-word phrases first (before single-word replacements mangle them)
  result = result.replace(/journald entries/gi, 'entrées de journaux système')
  result = result.replace(/eBPF correlate/gi, 'corrélation eBPF')
  result = result.replace(/eBPF correlation/gi, 'corrélation eBPF')

  // Replace standalone words using word boundaries to avoid partial matches
  result = result.replace(/\bcorrelate\b/gi, 'corrélation')
  result = result.replace(/\bcorrelation\b/gi, 'corrélation')
  result = result.replace(/\bwithout\b/gi, 'sans')

  // Replace "on" only when it's a standalone word preceded by a space (preposition)
  // NOT when it's part of a word like "correlation" -> would become "correlatisur"
  result = result.replace(/\s+on\s+/gi, ' sur ')

  return result
}

/**
 * Translate alert descriptions from English to human-friendly French.
 * Parses common alert patterns and translates them.
 * In expert mode, returns the original description.
 */
export function translateAlertDescription(description: string, expertMode: boolean): string {
  if (expertMode) return description

  let result = description

  // Common alert description patterns
  result = result.replace(/Over the last (\d+) minutes,?\s*/gi, 'Au cours des $1 dernières minutes, ')
  result = result.replace(/had (\d+) journald entries?\s*/gi, 'a eu $1 entrées de journaux système ')
  result = result.replace(/with a valid PID but no matching eBPF event\.?/gi, 'avec un PID valide mais aucun événement eBPF correspondant.')
  result = result.replace(/This STRONGLY suggests a rootkit or process hiding that bypasses the BPF tracepoints\.?/gi, 'Cela suggère fortement un rootkit ou un processus caché qui contourne les tracepoints BPF.')
  result = result.replace(/Investigate immediately\.?/gi, 'À investiguer immédiatement.')
  result = result.replace(/journald entries/gi, 'entrées de journaux système')
  result = result.replace(/eBPF event/gi, 'événement eBPF')
  result = result.replace(/eBPF correlate/gi, 'corrélation eBPF')
  result = result.replace(/eBPF correlation/gi, 'corrélation eBPF')
  result = result.replace(/\bcorrelate\b/gi, 'corrélation')
  result = result.replace(/\bcorrelation\b/gi, 'corrélation')
  result = result.replace(/\bwithout\b/gi, 'sans')
  result = result.replace(/\brootkit\b/gi, 'rootkit')
  result = result.replace(/\btracepoints\b/gi, 'tracepoints')
  result = result.replace(/\binvestigate\b/gi, 'investiguer')
  result = result.replace(/\bimmediately\b/gi, 'immédiatement')
  result = result.replace(/\bprocess hiding\b/gi, 'processus caché')
  result = result.replace(/\bbypasses\b/gi, 'contourne')
  result = result.replace(/\bsuggests\b/gi, 'suggère')
  result = result.replace(/\bstrongly\b/gi, 'fortement')

  return result
}

/**
 * Format a UTC timestamp for display in the user's local timezone.
 * In expert mode: full local datetime string.
 * In normal mode: short format "DD/MM HH:MM" in local time.
 */
export function formatTimestamp(ts: string, expertMode: boolean): string {
  if (!ts) return ''
  try {
    // Handle both ISO format (with T) and space-separated format
    const normalized = ts.includes('T') ? ts : ts.replace(' ', 'T')
    const d = new Date(normalized)
    if (isNaN(d.getTime())) return ts
    if (expertMode) {
      return d.toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
    }
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${day}/${month} ${hours}:${minutes}`
  } catch {
    return ts
  }
}

/**
 * Convert a UTC timestamp string to a local time string.
 * Used for direct display of timestamps that don't go through formatTimestamp.
 */
export function formatLocalTime(ts: string | undefined): string {
  if (!ts) return '—'
  try {
    const normalized = ts.includes('T') ? ts : ts.replace(' ', 'T')
    const d = new Date(normalized)
    if (isNaN(d.getTime())) return ts
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch {
    return ts
  }
}