import type { Lang, TranslationDict } from './types'
import fr from './locales/fr.json'
import en from './locales/en.json'
import de from './locales/de.json'
import es from './locales/es.json'

const translations: Record<Lang, TranslationDict> = { fr, en, de, es }

let currentLang: Lang = 'fr'

export function initI18n(lang: Lang): void {
  currentLang = lang
  document.documentElement.lang = lang
}

export function setLang(lang: Lang): void {
  currentLang = lang
  document.documentElement.lang = lang
}

export function getLang(): Lang {
  return currentLang
}

function resolve(obj: TranslationDict | string, keys: string[]): string {
  let current: TranslationDict | string = obj
  for (const key of keys) {
    if (typeof current === 'string') return current
    const next = current[key]
    if (next === undefined) return keys.join('.')
    current = next
  }
  return typeof current === 'string' ? current : keys.join('.')
}

export function t(key: string, lang?: Lang): string {
  const lng = lang ?? currentLang
  const dict = translations[lng]
  if (!dict) return key
  const keys = key.split('.')
  const result = resolve(dict, keys)
  return result
}

export { type Lang, type TranslationDict }