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
  let best: { locale: string; score: number } = {
    locale: 'en',
    score: scoreProfile(englishLanguageProfile, input),
  }
  for (let i = 0; i < packs.length; i++) {
    if (normalizeLocale(packs[i]!.locale) === 'en') {
      continue
    }
    const profile = resolveLanguageProfile(packs, packs[i]!.locale)
    const score = scoreProfile(profile, input)
    if (score > best.score) {
      best = { locale: profile.locale, score }
    }
  }
  return best.score > 0 ? best.locale : undefined
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
