import type { FuzzyVocab } from '../core/registry'
import type { Kind, NumberFormatPolicy, UnitSystem } from '../core/types'

export type LocaleId = string

export type WordSetInput = ReadonlySet<string> | readonly string[]

export type DateOffsetUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

export interface GrammarBoundPhrase {
  bound: 'min' | 'max'
  exclusive: boolean
  phrase: string
}

export interface GrammarWords {
  approximateWords: ReadonlySet<string>
  boundPhrases: readonly GrammarBoundPhrase[]
  compoundJoinWords: ReadonlySet<string>
  compoundMinusWords: ReadonlySet<string>
  compoundPlusWords: ReadonlySet<string>
  conversionWords: ReadonlySet<string>
  exactWords: ReadonlySet<string>
  globalFillers: ReadonlySet<string>
  phraseWords: readonly string[]
  qualifierArticleFollowers: ReadonlySet<string>
  qualifierArticleWords: ReadonlySet<string>
  qualifierFillers: ReadonlySet<string>
  qualifierSkipAfterApprox: ReadonlySet<string>
  qualifierSoftenerPhrases: readonly string[]
  qualifierSoftenerWords: ReadonlySet<string>
  rangeAlternativeWords: ReadonlySet<string>
  rangeAndWords: ReadonlySet<string>
  rangeBetweenWords: ReadonlySet<string>
  rangeFromWords: ReadonlySet<string>
  rangeSeparatorWords: ReadonlySet<string>
  trailingApproxPhrases: readonly string[]
  trailingApproxWords: ReadonlySet<string>
  trailingOkWords: ReadonlySet<string>
}

export type GrammarWordsInput = Omit<
  {
    [K in keyof GrammarWords]: GrammarWords[K] extends ReadonlySet<string>
      ? WordSetInput
      : GrammarWords[K]
  },
  never
>

export interface FuzzyAmountWord {
  spread: [number, number]
  value: number
}

export interface NumberWordTables {
  andWords: ReadonlySet<string>
  articles: ReadonlySet<string>
  dozenWords: ReadonlySet<string>
  fractionWords: Record<string, number>
  fuzzyAmounts: Record<string, FuzzyAmountWord>
  negativeWords: ReadonlySet<string>
  ofWords: ReadonlySet<string>
  ones: Record<string, number>
  scales: Record<string, number>
  tens: Record<string, number>
}

export type NumberWordTablesInput = Omit<
  {
    [K in keyof NumberWordTables]: NumberWordTables[K] extends ReadonlySet<string>
      ? WordSetInput
      : NumberWordTables[K]
  },
  never
>

export interface LocaleDefaults {
  currency?: string
  numberFormat?: NumberFormatPolicy
  system?: Exclude<UnitSystem, 'shared'>
}

export interface LocaleUnitAliases {
  aliases: readonly string[]
  kind: Kind
  unit: string
}

export interface LocaleFuzzyVocab {
  kind: Kind
  vocab: FuzzyVocab
}

export interface DateVocabPack {
  durationUnitSeconds?: Record<string, number>
  months: Record<string, number>
  subunit: Partial<Record<DateOffsetUnit, DateOffsetUnit>>
  timeCorePattern?: string
  timePattern?: string
  unitWords: Record<string, DateOffsetUnit>
  weekdayNames: readonly string[]
  weekdays: Record<string, number>
}

export interface LocalePack {
  aliases?: readonly string[]
  date?: Partial<DateVocabPack>
  defaults?: LocaleDefaults
  extends?: LocaleId
  fuzzy?: readonly LocaleFuzzyVocab[]
  grammar?: Partial<GrammarWordsInput>
  locale: LocaleId
  numberWords?: Partial<NumberWordTablesInput>
  numerals?: Record<string, number>
  unitAliases?: readonly LocaleUnitAliases[]
}

export interface LanguageProfile {
  aliases: readonly string[]
  date?: DateVocabPack
  defaults: LocaleDefaults
  grammar: GrammarWords
  locale: LocaleId
  numberWords: NumberWordTables
  numerals?: Record<string, number>
}
