import type { Token } from '../parse/tokenize'

/**
 * English number words (plan 002). All vocabulary lives in data so locale
 * packs can swap it (plan 013). The parser walks the token stream directly —
 * hyphenated compounds arrive as word/sym/word triples.
 */

export const ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
}

export const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fourty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
}

export const SCALES: Record<string, number> = {
  hundred: 100,
  thousand: 1000,
  million: 1_000_000,
  billion: 1_000_000_000,
  trillion: 1_000_000_000_000,
}

/** value + spread for approximate amount words. */
export const FUZZY_AMOUNTS: Record<string, { value: number; spread: [number, number] }> = {
  couple: { value: 2, spread: [2, 3] },
  few: { value: 3, spread: [2, 4] },
  several: { value: 5, spread: [4, 7] },
  handful: { value: 5, spread: [3, 6] },
  dozens: { value: 24, spread: [12, 60] },
}

const FRACTION_WORDS: Record<string, number> = {
  half: 1 / 2,
  halves: 1 / 2,
  third: 1 / 3,
  thirds: 1 / 3,
  quarter: 1 / 4,
  quarters: 1 / 4,
  fourth: 1 / 4,
  fourths: 1 / 4,
}

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
export function parseNumberWords(tokens: Token[], i: number): WordNumberResult | null {
  let pos = i
  let negative = false
  const w0 = word(tokens[pos])
  if (w0 === 'minus' || w0 === 'negative') {
    negative = true
    pos++
  }

  const result = parseCore(tokens, pos)
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

function parseCore(tokens: Token[], i: number): WordNumberResult | null {
  let pos = i
  const w = word(tokens[pos])
  if (w === null) {
    return null
  }

  // "a"/"an" — one, but only meaningful before a scale, dozen/fraction, or unit.
  if (w === 'a' || w === 'an') {
    const nextW = word(tokens[pos + 1])
    if (nextW && SCALES[nextW] !== undefined) {
      return finishScaled(tokens, pos + 1, 1)
    }
    if (nextW === 'dozen') {
      return withHalfDozenTail(tokens, pos + 2, 12)
    }
    if (nextW && FUZZY_AMOUNTS[nextW]) {
      const fuzz = FUZZY_AMOUNTS[nextW]!
      let next = pos + 2
      if (word(tokens[next]) === 'of') {
        next++
      }
      return { value: fuzz.value, next, approximate: true, spread: fuzz.spread }
    }
    if (nextW && FRACTION_WORDS[nextW] !== undefined) {
      // "a half", "a quarter", "a quarter of a mile", "a third of an hour"
      return fractionOfTail(tokens, FRACTION_WORDS[nextW]!, pos + 2)
    }
    return { value: 1, next: pos + 1, needsUnit: true }
  }

  // "half" / "half a(n)" / "half a dozen"
  if (w === 'half') {
    const nextW = word(tokens[pos + 1])
    if (nextW === 'a' || nextW === 'an') {
      if (word(tokens[pos + 2]) === 'dozen') {
        return withHalfDozenTail(tokens, pos + 3, 6)
      }
      return { value: 0.5, next: pos + 2, needsUnit: true }
    }
    return { value: 0.5, next: pos + 1 }
  }

  // "dozens of"
  if (w === 'dozens') {
    let next = pos + 1
    if (word(tokens[next]) === 'of') {
      next++
    }
    const fuzz = FUZZY_AMOUNTS['dozens']!
    return { value: fuzz.value, next, approximate: true, spread: fuzz.spread }
  }

  // "several" — the one fuzzy amount plan 002 spells without an article.
  if (w === 'several') {
    const fuzz = FUZZY_AMOUNTS['several']!
    return { value: fuzz.value, next: pos + 1, approximate: true, spread: fuzz.spread }
  }

  // Fraction lead: "three quarters (of)"
  const lead = ONES[w] ?? TENS[w]
  if (lead !== undefined) {
    const nextW = word(tokens[pos + 1])
    if (nextW && FRACTION_WORDS[nextW] !== undefined && lead >= 1 && lead <= 99) {
      // "two thirds", "three quarters", "two thirds of a meter"
      return fractionOfTail(tokens, lead * FRACTION_WORDS[nextW]!, pos + 2)
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
    if (ONES[tw] !== undefined) {
      current += ONES[tw]!
      pos++
      consumedAny = true
      // hyphenated tens handled below via TENS branch; ones ends a group
      continue
    }
    if (TENS[tw] !== undefined) {
      current += TENS[tw]!
      pos++
      consumedAny = true
      // optional hyphen + ones ("twenty-five" / "twenty five")
      const hyphen = tokens[pos]
      if (hyphen && hyphen.type === 'sym' && hyphen.text === '-') {
        const onesW = word(tokens[pos + 1])
        if (onesW && ONES[onesW] !== undefined && ONES[onesW]! < 10) {
          current += ONES[onesW]!
          pos += 2
        }
      }
      continue
    }
    if (tw === 'dozen' && consumedAny) {
      current *= 12
      sawDozen = true
      pos++
      continue
    }
    if (SCALES[tw] !== undefined && consumedAny) {
      if (tw === 'hundred') {
        current = (current === 0 ? 1 : current) * 100
      } else {
        total += (current === 0 ? 1 : current) * SCALES[tw]!
        current = 0
      }
      pos++
      // optional "and" ("one hundred and five")
      if (word(tokens[pos]) === 'and') {
        const after = word(tokens[pos + 1])
        if (after && (ONES[after] !== undefined || TENS[after] !== undefined)) {
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
    return withHalfDozenTail(tokens, pos, value)
  }
  // "two and a half"
  const tail = parseAndFractionTail(tokens, pos)
  if (tail) {
    value += tail.add
    pos = tail.next
  }
  return { value, next: pos }
}

function finishScaled(tokens: Token[], scalePos: number, multiplier: number): WordNumberResult {
  const scaleWord = word(tokens[scalePos])!
  let value = multiplier * SCALES[scaleWord]!
  let pos = scalePos + 1
  if (word(tokens[pos]) === 'and') {
    const after = word(tokens[pos + 1])
    if (after && (ONES[after] !== undefined || TENS[after] !== undefined)) {
      const rest = parseCore(tokens, pos + 1)
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
function fractionOfTail(tokens: Token[], value: number, next: number): WordNumberResult {
  let pos = next
  let pointsAtUnit = false
  if (word(tokens[pos]) === 'of') {
    pos++
    pointsAtUnit = true
  }
  const article = word(tokens[pos])
  if (article === 'a' || article === 'an') {
    pos++
    pointsAtUnit = true
  }
  return pointsAtUnit ? { value, next: pos, needsUnit: true } : { value, next: pos }
}

/** "…dozen and a half" → +6. */
function withHalfDozenTail(tokens: Token[], pos: number, value: number): WordNumberResult {
  if (
    word(tokens[pos]) === 'and' &&
    (word(tokens[pos + 1]) === 'a' || word(tokens[pos + 1]) === 'an') &&
    word(tokens[pos + 2]) === 'half'
  ) {
    return { value: value + 6, next: pos + 3 }
  }
  return { value, next: pos }
}

/** "and a half" / "and a quarter" / "and three quarters" after a number. */
export function parseAndFractionTail(
  tokens: Token[],
  i: number,
): { add: number; next: number } | null {
  if (word(tokens[i]) !== 'and') {
    return null
  }
  const pos = i + 1
  const a = word(tokens[pos])
  if (a === 'a' || a === 'an') {
    const frac = word(tokens[pos + 1])
    if (frac && FRACTION_WORDS[frac] !== undefined) {
      return { add: FRACTION_WORDS[frac]!, next: pos + 2 }
    }
    return null
  }
  const count = a === null ? undefined : ONES[a]
  if (count !== undefined && count >= 1) {
    const frac = word(tokens[pos + 1])
    if (frac && FRACTION_WORDS[frac] !== undefined) {
      return { add: count * FRACTION_WORDS[frac]!, next: pos + 2 }
    }
  }
  return null
}
