import type { Normalized } from './normalize'

export type TokenType = 'digits' | 'word' | 'vulgar' | 'sym'

export interface Token {
  den?: number
  end: number
  /** Vulgar fraction value (½ → 1/2), pre-split from same-origin expansion. */
  num?: number
  spaceBefore: boolean
  /** Offsets into normalized text. */
  start: number
  /** Slice of normalized text. */
  text: string
  type: TokenType
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

function isLetter(ch: string): boolean {
  const c = ch.charCodeAt(0)
  return (c >= 97 && c <= 122) || (c >= 65 && c <= 90)
}

/**
 * Scan normalized text into tokens. One subtlety: NFKC expands vulgar
 * fractions in place (`1½` → `11/2`), which would misread as eleven halves.
 * Expansion chars all share one original index, so a same-origin `d…/d…` run
 * becomes a dedicated 'vulgar' token instead.
 */
export function tokenize(n: Normalized): Token[] {
  const { text, start } = n
  const tokens: Token[] = []
  let i = 0
  let spaceBefore = false
  while (i < text.length) {
    const ch = text[i]!
    if (ch === ' ') {
      spaceBefore = true
      i++
      continue
    }
    const tokenStart = i
    // Same-origin vulgar fraction: digits '/' digits all mapping to one char.
    if (isDigit(ch) && sameOriginFraction(n, i)) {
      const origin = start[i]!
      let j = i
      while (j < text.length && start[j] === origin) {
        j++
      }
      const slice = text.slice(i, j)
      const slash = slice.indexOf('/')
      tokens.push({
        type: 'vulgar',
        text: slice,
        start: tokenStart,
        end: j,
        spaceBefore,
        num: Number(slice.slice(0, slash)),
        den: Number(slice.slice(slash + 1)),
      })
      i = j
    } else if (isDigit(ch)) {
      let j = i + 1
      // Digits from a vulgar expansion must not merge with typed digits.
      while (j < text.length && isDigit(text[j]!) && !sameOriginFraction(n, j)) {
        j++
      }
      tokens.push({
        type: 'digits',
        text: text.slice(i, j),
        start: tokenStart,
        end: j,
        spaceBefore,
      })
      i = j
    } else if (isLetter(ch)) {
      let j = i + 1
      while (j < text.length && isLetter(text[j]!)) {
        j++
      }
      tokens.push({ type: 'word', text: text.slice(i, j), start: tokenStart, end: j, spaceBefore })
      i = j
    } else {
      tokens.push({ type: 'sym', text: ch, start: tokenStart, end: i + 1, spaceBefore })
      i++
    }
    spaceBefore = false
  }
  return tokens
}

function sameOriginFraction(n: Normalized, i: number): boolean {
  if (n.start.length === 0) {
    return false
  }
  const { text, start } = n
  const origin = start[i]
  if (origin === undefined) {
    return false
  }
  // Walk the same-origin run and check it matches d+ '/' d+.
  let j = i
  while (j > 0 && start[j - 1] === origin) {
    j--
  }
  let end = i
  while (end < text.length && start[end] === origin) {
    end++
  }
  if (end - j < 3) {
    return false
  }
  const slice = text.slice(j, end)
  return /^[0-9]+\/[0-9]+$/.test(slice)
}
