export type TranslationKey = string

export interface TranslationDict {
  [key: string]: string | TranslationDict
}

export type Lang = 'fr' | 'en' | 'de' | 'es'

export interface I18nConfig {
  defaultLang: Lang
  supportedLangs: Lang[]
}