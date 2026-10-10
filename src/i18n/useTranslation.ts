import { useSyncExternalStore, useCallback } from 'react'
import { t, setLang, getLang } from './index'
import type { Lang } from './types'

let listeners: (() => void)[] = []

function subscribe(listener: () => void): () => void {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot(): Lang {
  return getLang()
}

const origSetLang = setLang

function notifySetLang(lang: Lang): void {
  origSetLang(lang)
  for (const l of listeners) l()
}

export function useTranslation() {
  const lang = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let result = t(key, lang)
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          result = result.replace(`{${k}}`, String(v))
        }
      }
      return result
    },
    [lang],
  )

  return { t: translate, lang, setLang: notifySetLang }
}