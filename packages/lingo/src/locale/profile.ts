import { enCore, englishLanguageProfile } from './en-core'
import type {
  DateVocabPack,
  GrammarBoundPhrase,
  GrammarWords,
  GrammarWordsInput,
  LanguageProfile,
  LocalePack,
  NumberWordTables,
  NumberWordTablesInput,
  WordSetInput,
} from './types'

export const DEFAULT_LOCALE_PACKS: readonly LocalePack[] = [enCore]

export function resolveLanguageProfile(
  packs: readonly LocalePack[] = DEFAULT_LOCALE_PACKS,
  locale?: string,
): LanguageProfile {
  const requested = normalizeLocale(locale ?? 'en')
  if (!hasNonEnglishLocalePacks(packs) && matchesLocale(enCore, requested)) {
    return englishLanguageProfile
  }
  const all = uniquePacks([...DEFAULT_LOCALE_PACKS, ...packs])
  const pack = findPack(all, locale) ?? findPack(all, 'en')!
  return buildProfile(pack, all, new Set())
}

export function hasNonEnglishLocalePacks(packs?: readonly LocalePack[]): boolean {
  return packs?.some((pack) => normalizeLocale(pack.locale) !== 'en') ?? false
}

export function isLocaleLoaded(packs: readonly LocalePack[] | undefined, locale: string): boolean {
  const target = normalizeLocale(locale)
  return (
    matchesLocale(enCore, target) || (packs?.some((pack) => matchesLocale(pack, target)) ?? false)
  )
}

function buildProfile(
  pack: LocalePack,
  packs: readonly LocalePack[],
  seen: Set<string>,
): LanguageProfile {
  if (pack === enCore) {
    return englishLanguageProfile
  }
  const id = normalizeLocale(pack.locale)
  if (seen.has(id)) {
    throw new Error(`lingo: circular locale pack inheritance for "${pack.locale}"`)
  }
  seen.add(id)
  const base = pack.extends
    ? buildProfile(
        findPack(packs, pack.extends) ??
          (() => {
            throw new Error(`lingo: locale pack "${pack.locale}" extends unknown "${pack.extends}"`)
          })(),
        packs,
        seen,
      )
    : emptyProfile(pack.locale)
  seen.delete(id)
  return mergeProfile(base, pack)
}

function mergeProfile(base: LanguageProfile, overlay: LocalePack): LanguageProfile {
  return {
    locale: normalizeLocale(overlay.locale),
    aliases: uniqueStrings([...base.aliases, ...(overlay.aliases ?? [])]),
    defaults: { ...base.defaults, ...overlay.defaults },
    grammar: mergeGrammar(base.grammar, overlay.grammar),
    numberWords: mergeNumberWords(base.numberWords, overlay.numberWords),
    date: mergeDate(base.date, overlay.date),
    numerals: overlay.numerals ? { ...(base.numerals ?? {}), ...overlay.numerals } : base.numerals,
  }
}

function emptyProfile(locale: string): LanguageProfile {
  return {
    locale: normalizeLocale(locale),
    aliases: [],
    defaults: {},
    grammar: emptyGrammar(),
    numberWords: emptyNumberWords(),
  }
}

function emptyGrammar(): GrammarWords {
  return {
    approximateWords: new Set(),
    boundPhrases: [],
    compoundJoinWords: new Set(),
    compoundMinusWords: new Set(),
    compoundPlusWords: new Set(),
    conversionWords: new Set(),
    exactWords: new Set(),
    globalFillers: new Set(),
    phraseWords: [],
    qualifierArticleFollowers: new Set(),
    qualifierArticleWords: new Set(),
    qualifierFillers: new Set(),
    qualifierSkipAfterApprox: new Set(),
    qualifierSoftenerPhrases: [],
    qualifierSoftenerWords: new Set(),
    rangeAlternativeWords: new Set(),
    rangeAndWords: new Set(),
    rangeBetweenWords: new Set(),
    rangeFromWords: new Set(),
    rangeSeparatorWords: new Set(),
    trailingApproxPhrases: [],
    trailingApproxWords: new Set(),
    trailingOkWords: new Set(),
  }
}

function emptyNumberWords(): NumberWordTables {
  return {
    andWords: new Set(),
    articles: new Set(),
    dozenWords: new Set(),
    fractionWords: {},
    fuzzyAmounts: {},
    negativeWords: new Set(),
    ofWords: new Set(),
    ones: {},
    scales: {},
    tens: {},
  }
}

function mergeGrammar(base: GrammarWords, overlay?: Partial<GrammarWordsInput>): GrammarWords {
  if (!overlay) {
    return base
  }
  return {
    approximateWords: mergeSet(base.approximateWords, overlay.approximateWords),
    boundPhrases: mergeBoundPhrases(base.boundPhrases, overlay.boundPhrases),
    compoundJoinWords: mergeSet(base.compoundJoinWords, overlay.compoundJoinWords),
    compoundMinusWords: mergeSet(base.compoundMinusWords, overlay.compoundMinusWords),
    compoundPlusWords: mergeSet(base.compoundPlusWords, overlay.compoundPlusWords),
    conversionWords: mergeSet(base.conversionWords, overlay.conversionWords),
    exactWords: mergeSet(base.exactWords, overlay.exactWords),
    globalFillers: mergeSet(base.globalFillers, overlay.globalFillers),
    phraseWords: mergeList(base.phraseWords, overlay.phraseWords),
    qualifierArticleFollowers: mergeSet(
      base.qualifierArticleFollowers,
      overlay.qualifierArticleFollowers,
    ),
    qualifierArticleWords: mergeSet(base.qualifierArticleWords, overlay.qualifierArticleWords),
    qualifierFillers: mergeSet(base.qualifierFillers, overlay.qualifierFillers),
    qualifierSkipAfterApprox: mergeSet(
      base.qualifierSkipAfterApprox,
      overlay.qualifierSkipAfterApprox,
    ),
    qualifierSoftenerPhrases: mergeList(
      base.qualifierSoftenerPhrases,
      overlay.qualifierSoftenerPhrases,
    ),
    qualifierSoftenerWords: mergeSet(base.qualifierSoftenerWords, overlay.qualifierSoftenerWords),
    rangeAlternativeWords: mergeSet(base.rangeAlternativeWords, overlay.rangeAlternativeWords),
    rangeAndWords: mergeSet(base.rangeAndWords, overlay.rangeAndWords),
    rangeBetweenWords: mergeSet(base.rangeBetweenWords, overlay.rangeBetweenWords),
    rangeFromWords: mergeSet(base.rangeFromWords, overlay.rangeFromWords),
    rangeSeparatorWords: mergeSet(base.rangeSeparatorWords, overlay.rangeSeparatorWords),
    trailingApproxPhrases: mergeList(base.trailingApproxPhrases, overlay.trailingApproxPhrases),
    trailingApproxWords: mergeSet(base.trailingApproxWords, overlay.trailingApproxWords),
    trailingOkWords: mergeSet(base.trailingOkWords, overlay.trailingOkWords),
  }
}

function mergeNumberWords(
  base: NumberWordTables,
  overlay?: Partial<NumberWordTablesInput>,
): NumberWordTables {
  if (!overlay) {
    return base
  }
  return {
    andWords: mergeSet(base.andWords, overlay.andWords),
    articles: mergeSet(base.articles, overlay.articles),
    dozenWords: mergeSet(base.dozenWords, overlay.dozenWords),
    fractionWords: { ...base.fractionWords, ...overlay.fractionWords },
    fuzzyAmounts: { ...base.fuzzyAmounts, ...overlay.fuzzyAmounts },
    negativeWords: mergeSet(base.negativeWords, overlay.negativeWords),
    ofWords: mergeSet(base.ofWords, overlay.ofWords),
    ones: { ...base.ones, ...overlay.ones },
    scales: { ...base.scales, ...overlay.scales },
    tens: { ...base.tens, ...overlay.tens },
  }
}

function mergeDate(
  base: DateVocabPack | undefined,
  overlay: Partial<DateVocabPack> | undefined,
): DateVocabPack | undefined {
  if (!(base || overlay)) {
    return
  }
  return {
    calendarPeriodPhrases: {
      ...(base?.calendarPeriodPhrases ?? {}),
      ...overlay?.calendarPeriodPhrases,
    },
    compactOffset:
      base?.compactOffset || overlay?.compactOffset
        ? {
            futureSuffixes: mergeList(
              base?.compactOffset?.futureSuffixes ?? [],
              overlay?.compactOffset?.futureSuffixes,
            ),
            pastSuffixes: mergeList(
              base?.compactOffset?.pastSuffixes ?? [],
              overlay?.compactOffset?.pastSuffixes,
            ),
            unitWords: {
              ...(base?.compactOffset?.unitWords ?? {}),
              ...overlay?.compactOffset?.unitWords,
            },
          }
        : undefined,
    dayOffsets: { ...(base?.dayOffsets ?? {}), ...overlay?.dayOffsets },
    dayTimePhrases: { ...(base?.dayTimePhrases ?? {}), ...overlay?.dayTimePhrases },
    durationUnitSeconds: { ...(base?.durationUnitSeconds ?? {}), ...overlay?.durationUnitSeconds },
    fillerWords: mergeList(base?.fillerWords ?? [], overlay?.fillerWords),
    modifiers:
      base?.modifiers || overlay?.modifiers
        ? {
            this: mergeList(base?.modifiers?.this ?? [], overlay?.modifiers?.this),
            next: mergeList(base?.modifiers?.next ?? [], overlay?.modifiers?.next),
            last: mergeList(base?.modifiers?.last ?? [], overlay?.modifiers?.last),
          }
        : undefined,
    months: { ...(base?.months ?? {}), ...overlay?.months },
    periodWords:
      base?.periodWords || overlay?.periodWords
        ? {
            week: mergeList(base?.periodWords?.week ?? [], overlay?.periodWords?.week),
            month: mergeList(base?.periodWords?.month ?? [], overlay?.periodWords?.month),
            year: mergeList(base?.periodWords?.year ?? [], overlay?.periodWords?.year),
          }
        : undefined,
    relative:
      base?.relative || overlay?.relative
        ? {
            anchorWords: mergeList(
              base?.relative?.anchorWords ?? [],
              overlay?.relative?.anchorWords,
            ),
            futurePrefixes: mergeList(
              base?.relative?.futurePrefixes ?? [],
              overlay?.relative?.futurePrefixes,
            ),
            pastPrefixes: mergeList(
              base?.relative?.pastPrefixes ?? [],
              overlay?.relative?.pastPrefixes,
            ),
            pastSuffixes: mergeList(
              base?.relative?.pastSuffixes ?? [],
              overlay?.relative?.pastSuffixes,
            ),
          }
        : undefined,
    subunit: { ...(base?.subunit ?? {}), ...overlay?.subunit },
    timeAliases: { ...(base?.timeAliases ?? {}), ...overlay?.timeAliases },
    timeCorePattern: overlay?.timeCorePattern ?? base?.timeCorePattern,
    timePattern: overlay?.timePattern ?? base?.timePattern,
    unitWords: { ...(base?.unitWords ?? {}), ...overlay?.unitWords },
    weekdayNames: overlay?.weekdayNames ?? base?.weekdayNames ?? [],
    weekdays: { ...(base?.weekdays ?? {}), ...overlay?.weekdays },
  }
}

function mergeSet(base: ReadonlySet<string>, overlay?: WordSetInput): ReadonlySet<string> {
  return new Set([...base, ...toWords(overlay)].map((word) => word.toLowerCase()))
}

function mergeList(base: readonly string[], overlay?: readonly string[]): readonly string[] {
  return uniqueStrings([...base, ...(overlay ?? [])].map((word) => word.toLowerCase()))
}

function mergeBoundPhrases(
  base: readonly GrammarBoundPhrase[],
  overlay?: readonly GrammarBoundPhrase[],
): readonly GrammarBoundPhrase[] {
  const seen = new Set<string>()
  const out: GrammarBoundPhrase[] = []
  for (const phrase of [...base, ...(overlay ?? [])]) {
    const key = phrase.phrase.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push({ ...phrase, phrase: key })
    }
  }
  return out
}

function toWords(input?: WordSetInput): readonly string[] {
  return input ? [...input] : []
}

function findPack(packs: readonly LocalePack[], locale?: string): LocalePack | undefined {
  const target = normalizeLocale(locale ?? 'en')
  const exact = packs.find((pack) => matchesLocale(pack, target))
  if (exact) {
    return exact
  }
  const base = target.split('-')[0]
  return packs.find((pack) => normalizeLocale(pack.locale) === base)
}

function matchesLocale(pack: LocalePack, locale: string): boolean {
  return (
    normalizeLocale(pack.locale) === locale ||
    (pack.aliases ?? []).some((alias) => normalizeLocale(alias) === locale)
  )
}

function uniquePacks(packs: readonly LocalePack[]): readonly LocalePack[] {
  const out = new Map<string, LocalePack>()
  for (const pack of packs) {
    out.set(normalizeLocale(pack.locale), pack)
  }
  return [...out.values()]
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}

export function normalizeLocale(locale: string): string {
  return locale.toLowerCase().replace('_', '-')
}

export { englishLanguageProfile } from './en-core'
export type { LanguageProfile, LocalePack }
