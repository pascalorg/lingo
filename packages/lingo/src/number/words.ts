import { EN_NUMBER_WORDS } from '../locale/en-core'
import type { NumberWordTables } from '../locale/types'
import type { Token } from '../parse/tokenize'

/**
 * English number words (plan 002). All vocabulary lives in data so locale
 * packs can swap it (plan 013). The parser walks the token stream directly —
 * hyphenated compounds arrive as word/sym/word triples.
 */

export const ONES: Record<string, number> = EN_NUMBER_WORDS.ones
export const TENS: Record<string, number> = EN_NUMBER_WORDS.tens
export const SCALES: Record<string, number> = EN_NUMBER_WORDS.scales
/** value + spread for approximate amount words. */
export const FUZZY_AMOUNTS: Record<string, { value: number; spread: [number, number] }> =
  EN_NUMBER_WORDS.fuzzyAmounts

export interface WordNumberResult {
  approximate?: boolean
  /**
   * 'a'/'an' alone ("an hour") — callers must require a following unit.
   * 'half a'/'half an' sets this too ("half an hour").
   */
  needsUnit?: boolean
  /** Token index just past the consumed words. */
  next: number
  spread?: [number, number]
  value: number
}

const word = (t: Token | undefined): string | null =>
  t && t.type === 'word' ? t.text.toLowerCase() : null

/**
 * Parse a number-word expression starting at token `i`.
 * Handles: one…nineteen, tens (+ hyphen/space ones), scales with optional
 * 'and', 'a'/'an' (needsUnit), 'a hundred', minus/negative, half/quarter
 * forms, 'X and a half', dozen forms, fuzzy amounts ('a few').
 */
export function parseNumberWords(
  tokens: Token[],
  i: number,
  tables: NumberWordTables = EN_NUMBER_WORDS,
): WordNumberResult | null {
  let pos = i
  let negative = false
  const w0 = word(tokens[pos])
  if (w0 && tables.negativeWords.has(w0)) {
    negative = true
    pos++
  }

  const result = parseCore(tokens, pos, tables)
  if (!result) {
    return null
  }
  if (negative) {
    result.value = -result.value
    if (result.spread) {
      result.spread = [-result.spread[1], -result.spread[0]]
    }
  }
  return result
}

function parseCore(tokens: Token[], i: number, tables: NumberWordTables): WordNumberResult | null {
  let pos = i
  const w = word(tokens[pos])
  if (w === null) {
    return null
  }

  // "a"/"an" — one, but only meaningful before a scale, dozen/fraction, or unit.
  if (tables.articles.has(w)) {
    const nextW = word(tokens[pos + 1])
    if (nextW && tables.scales[nextW] !== undefined) {
      return finishScaled(tokens, pos + 1, 1, tables)
    }
    if (nextW && tables.dozenWords.has(nextW)) {
      return withHalfDozenTail(tokens, pos + 2, 12, tables)
    }
    if (nextW && tables.fuzzyAmounts[nextW]) {
      const fuzz = tables.fuzzyAmounts[nextW]!
      let next = pos + 2
      const ofWord = word(tokens[next])
      if (ofWord && tables.ofWords.has(ofWord)) {
        next++
      }
      return { value: fuzz.value, next, approximate: true, spread: fuzz.spread }
    }
    if (nextW && tables.fractionWords[nextW] !== undefined) {
      // "a half", "a quarter", "a quarter of a mile", "a third of an hour"
      return fractionOfTail(tokens, tables.fractionWords[nextW]!, pos + 2, tables)
    }
    return { value: 1, next: pos + 1, needsUnit: true }
  }

  // "half" / "half a(n)" / "half a dozen"
  if (tables.fractionWords[w] === 1 / 2) {
    const nextW = word(tokens[pos + 1])
    if (nextW && tables.articles.has(nextW)) {
      const afterArticle = word(tokens[pos + 2])
      if (afterArticle && tables.dozenWords.has(afterArticle)) {
        return withHalfDozenTail(tokens, pos + 3, 6, tables)
      }
      return { value: 0.5, next: pos + 2, needsUnit: true }
    }
    return { value: tables.fractionWords[w]!, next: pos + 1 }
  }

  // "dozens of"
  if (tables.fuzzyAmounts[w]) {
    let next = pos + 1
    const ofWord = word(tokens[next])
    if (ofWord && tables.ofWords.has(ofWord)) {
      next++
    }
    const fuzz = tables.fuzzyAmounts[w]!
    return { value: fuzz.value, next, approximate: true, spread: fuzz.spread }
  }

  // Fraction lead: "three quarters (of)"
  const lead = tables.ones[w] ?? tables.tens[w]
  if (lead !== undefined) {
    const nextW = word(tokens[pos + 1])
    if (nextW && tables.fractionWords[nextW] !== undefined && lead >= 1 && lead <= 99) {
      // "two thirds", "three quarters", "two thirds of a meter"
      return fractionOfTail(tokens, lead * tables.fractionWords[nextW]!, pos + 2, tables)
    }
  }

  // Standard cardinal grammar.
  let total = 0
  let current = 0
  let consumedAny = false
  let sawDozen = false
  while (pos < tokens.length) {
    const t = tokens[pos]!
    const tw = word(t)
    if (tw === null) {
      break
    }
    if (tables.ones[tw] !== undefined) {
      current += tables.ones[tw]!
      pos++
      consumedAny = true
      // hyphenated tens handled below via TENS branch; ones ends a group
      continue
    }
    if (tables.tens[tw] !== undefined) {
      current += tables.tens[tw]!
      pos++
      consumedAny = true
      // optional hyphen + ones ("twenty-five" / "twenty five")
      const hyphen = tokens[pos]
      if (hyphen && hyphen.type === 'sym' && hyphen.text === '-') {
        const onesW = word(tokens[pos + 1])
        if (onesW && tables.ones[onesW] !== undefined && tables.ones[onesW]! < 10) {
          current += tables.ones[onesW]!
          pos += 2
        }
      }
      continue
    }
    if (tables.dozenWords.has(tw) && consumedAny) {
      current *= 12
      sawDozen = true
      pos++
      continue
    }
    if (tables.scales[tw] !== undefined && consumedAny) {
      if (tables.scales[tw] === 100) {
        current = (current === 0 ? 1 : current) * 100
      } else {
        total += (current === 0 ? 1 : current) * tables.scales[tw]!
        current = 0
      }
      pos++
      // optional "and" ("one hundred and five")
      const join = word(tokens[pos])
      if (join && tables.andWords.has(join)) {
        const after = word(tokens[pos + 1])
        if (after && (tables.ones[after] !== undefined || tables.tens[after] !== undefined)) {
          pos++
        }
      }
      continue
    }
    break
  }
  if (!consumedAny) {
    return null
  }
  let value = total + current
  if (sawDozen) {
    return withHalfDozenTail(tokens, pos, value, tables)
  }
  // "two and a half"
  const tail = parseAndFractionTail(tokens, pos, tables)
  if (tail) {
    value += tail.add
    pos = tail.next
  }
  return { value, next: pos }
}

function finishScaled(
  tokens: Token[],
  scalePos: number,
  multiplier: number,
  tables: NumberWordTables,
): WordNumberResult {
  const scaleWord = word(tokens[scalePos])!
  let value = multiplier * tables.scales[scaleWord]!
  let pos = scalePos + 1
  const join = word(tokens[pos])
  if (join && tables.andWords.has(join)) {
    const after = word(tokens[pos + 1])
    if (after && (tables.ones[after] !== undefined || tables.tens[after] !== undefined)) {
      const rest = parseCore(tokens, pos + 1, tables)
      if (rest && !rest.needsUnit) {
        value += rest.value
        pos = rest.next
      }
    }
  }
  return { value, next: pos }
}

/**
 * After a fraction value, optionally consume a linking "of" and an "a"/"an"
 * article ("a quarter of a mile", "two thirds of a meter", "a third of an
 * hour"). When either is present the value points at a following unit, so
 * `needsUnit` is set — bare "a quarter"/"two thirds" stay plain numbers.
 */
function fractionOfTail(
  tokens: Token[],
  value: number,
  next: number,
  tables: NumberWordTables,
): WordNumberResult {
  let pos = next
  let pointsAtUnit = false
  const ofWord = word(tokens[pos])
  if (ofWord && tables.ofWords.has(ofWord)) {
    pos++
    pointsAtUnit = true
  }
  const article = word(tokens[pos])
  if (article && tables.articles.has(article)) {
    pos++
    pointsAtUnit = true
  }
  return pointsAtUnit ? { value, next: pos, needsUnit: true } : { value, next: pos }
}

/** "…dozen and a half" → +6. */
function withHalfDozenTail(
  tokens: Token[],
  pos: number,
  value: number,
  tables: NumberWordTables,
): WordNumberResult {
  if (
    word(tokens[pos]) &&
    tables.andWords.has(word(tokens[pos])!) &&
    word(tokens[pos + 1]) &&
    tables.articles.has(word(tokens[pos + 1])!) &&
    word(tokens[pos + 2]) &&
    tables.fractionWords[word(tokens[pos + 2])!] === 1 / 2
  ) {
    return { value: value + 6, next: pos + 3 }
  }
  return { value, next: pos }
}

/** "and a half" / "and a quarter" / "and three quarters" after a number. */
export function parseAndFractionTail(
  tokens: Token[],
  i: number,
  tables: NumberWordTables = EN_NUMBER_WORDS,
): { add: number; next: number } | null {
  const join = word(tokens[i])
  if (!(join && tables.andWords.has(join))) {
    return null
  }
  const pos = i + 1
  const a = word(tokens[pos])
  if (a && tables.articles.has(a)) {
    const frac = word(tokens[pos + 1])
    if (frac && tables.fractionWords[frac] !== undefined) {
      return { add: tables.fractionWords[frac]!, next: pos + 2 }
    }
    return null
  }
  const count = a === null ? undefined : tables.ones[a]
  if (count !== undefined && count >= 1) {
    const frac = word(tokens[pos + 1])
    if (frac && tables.fractionWords[frac] !== undefined) {
      return { add: count * tables.fractionWords[frac]!, next: pos + 2 }
    }
  }
  return null
}
