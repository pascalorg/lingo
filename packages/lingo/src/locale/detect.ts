import { normalizeInput } from '../parse/normalize'
import { tokenize } from '../parse/tokenize'
import { englishLanguageProfile } from './en-core'
import { normalizeLocale, resolveLanguageProfile } from './profile'
import type { LanguageProfile, LocalePack } from './types'

export function detectLanguageProfile(
  packs: readonly LocalePack[],
  input: string,
): LanguageProfile {
  const locale = detectLocale(packs, input)
  return resolveLanguageProfile(packs, locale)
}

export function detectLocale(packs: readonly LocalePack[], input: string): string | undefined {
  let best: { index: number; locale: string; score: number } | undefined
  const candidates: LanguageProfile[] = [
    englishLanguageProfile,
    ...packs
      .filter((pack) => normalizeLocale(pack.locale) !== 'en')
      .map((pack) => resolveLanguageProfile(packs, pack.locale)),
  ]
  for (let i = 0; i < candidates.length; i++) {
    const profile = candidates[i]!
    const score = scoreProfile(profile, input)
    if (!best || score > best.score || (score === best.score && i < best.index)) {
      best = { index: i, locale: profile.locale, score }
    }
  }
  return best && best.score > 0 ? best.locale : undefined
}

export function scoreProfile(profile: LanguageProfile, input: string): number {
  const n = normalizeInput(input)
  const lower = n.text.toLowerCase()
  const tokens = tokenize(n)
  let score = 0

  for (const token of tokens) {
    if (token.type !== 'word') {
      continue
    }
    const word = token.text.toLowerCase()
    if (
      profile.numberWords.ones[word] !== undefined ||
      profile.numberWords.tens[word] !== undefined ||
      profile.numberWords.scales[word] !== undefined
    ) {
      score += 4
    }
    if (
      profile.numberWords.fuzzyAmounts[word] ||
      profile.numberWords.fractionWords[word] !== undefined
    ) {
      score += 3
    }
    if (
      profile.grammar.approximateWords.has(word) ||
      profile.grammar.conversionWords.has(word) ||
      profile.grammar.rangeSeparatorWords.has(word)
    ) {
      score += 2
    }
    if (profile.date?.months[word] !== undefined || profile.date?.weekdays[word] !== undefined) {
      score += 2
    }
  }

  for (const phrase of profile.grammar.boundPhrases) {
    if (hasPhrase(lower, phrase.phrase)) {
      score += 2
    }
  }

  if (profile.numerals) {
    for (const ch of input) {
      if (profile.numerals[ch] !== undefined) {
        score += 3
      }
    }
  }

  return score
}

function hasPhrase(input: string, phrase: string): boolean {
  return new RegExp(`(?:^|\\s)${escapeRegExp(phrase)}(?:\\s|$)`, 'i').test(input)
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
