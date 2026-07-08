---
id: 031
title: Locale packs
status: in-progress
created: 2026-07-08
updated: 2026-07-08
goal: "Ship Phase 0 multi-language infrastructure: loaded locale packs, resolved language profiles, and parser plumbing with zero English corpus drift."
success_criteria:
  - "English parsing is unchanged -> packages/lingo/src/parse/corpus.test.ts and corpus-diff gate"
  - "Locale profile resolution and detection are covered -> packages/lingo/tests/locale.test.ts"
  - "Published locale subpaths build -> packages/lingo/tsup.config.ts and package exports"
---

# Locale packs

Driver: plan 013 reserved additive locale packs after 0.1. Phase 0 makes the
parser data-driven for grammar and number words without translating unit alias
tables or bundling every language into the main path.

## Design principle

**Locale packs are additive data, language profiles are resolved runtime state.**
Parser code reads a fully merged `LanguageProfile`; pack files stay tree-shakeable
modules that callers opt into with `createLingo({ locales })`.

## Design (locked-in 2026-07-08)

New infrastructure under `packages/lingo/src/locale/`:

```ts
export interface LocalePack {
  locale: string
  aliases?: readonly string[]
  extends?: string
  defaults?: LocaleDefaults
  grammar?: Partial<GrammarWordsInput>
  numberWords?: Partial<NumberWordTablesInput>
  date?: Partial<DateVocabPack>
  numerals?: Record<string, number>
}

export interface LanguageProfile {
  locale: string
  aliases: readonly string[]
  defaults: LocaleDefaults
  grammar: GrammarWords
  numberWords: NumberWordTables
  date?: DateVocabPack
  numerals?: Record<string, number>
}
```

`resolveLanguageProfile(packs, locale?)` includes English as the base profile,
matches BCP-47 aliases case-insensitively, and merges overlays such as `en-gb`
onto `en`. Non-English Phase 0 packs extend English so untranslated grammar
remains usable until each language graduates to a complete pack.

`detectLocale(packs, input)` and `detectLanguageProfile(packs, input)` score only
the packs already loaded by the instance. Scoring is deterministic: number words,
grammar words, date vocabulary, and future CJK `numerals` all add fixed weights;
ties keep pack order; no signal falls back to English.

Parser integration:

1. `ParseOptions.locale?: string` chooses a loaded profile.
2. `CreateLingoOptions.locales?: readonly LocalePack[]` installs opt-in packs on
   an isolated instance.
3. `ParserState.profile` is the single parser-facing locale object.
4. Grammar reads from `p.profile.grammar`, not module-level English constants.
5. `ValueCtx.profile` supplies number-word tables to `number/words.ts`.
6. Successful `LingoResult`s carry `locale?: string` at runtime; serialized v3
   JSON stays stable for Phase 0.

Published packs:

- `@pascal-app/lingo/locales/en`
- `@pascal-app/lingo/locales/en-gb`
- `@pascal-app/lingo/locales/es`
- `@pascal-app/lingo/locales/fr`
- `@pascal-app/lingo/locales/pt`
- `@pascal-app/lingo/locales/zh`
- `@pascal-app/lingo/locales/ja`

## Changes

1. Locale infrastructure: types, English pack, resolver, detector, index exports.
2. Parser plumbing: `ParseOptions.locale`, `ParserState.profile`, grammar lookup
   via profile, number-word tables via `ValueCtx.profile`, locale on successes.
3. Factory plumbing: `createLingo({ locales })` stores packs on instance defaults.
4. Tokenizer groundwork: Han, Hiragana, and Katakana runs emit word tokens;
   `LocalePack.numerals` reserves future CJK numeric parsing.
5. Packaging: tree-shakeable locale entry points and exports.
6. Tests: profile resolution, overlay merge, detector basics, parser locale
   selection, CJK tokenization.

## Non-goals

- Translating built-in unit aliases.
- Shipping all locale packs through the default `.` entry.
- Rewriting the date parser to consume `LanguageProfile.date` in Phase 0.
- Full CJK segmentation or compound numeral grammar.
- Changing serialized result JSON in the v3 contract.

## Acceptance

Run from `packages/lingo/`:

```sh
bun run typecheck
bun run test
```

English corpus output must remain unchanged. Any future translated unit aliases
or non-English date parsing need additive corpus rows and a follow-up plan update.
