---
id: 033
title: Locale idiom coverage
status: in-progress
created: 2026-07-09
updated: 2026-07-09
---

# Locale idiom coverage — parse how people actually write and speak

Plan 031 shipped the locale-pack *infrastructure*; this plan makes the packs
*comprehensive*: the everyday spoken/written idioms natives actually use for
quantities, dates, and amounts, in every shipped language. Research pass
2026-07-09 (six native-level idiom studies + prior-art + engine-gap audit;
distilled in `wiki/research/locale-idioms.md`) produced ~335 test-precise gap
idioms and identified the engine seams that block whole idiom classes
regardless of pack data.

## Strategy

1. **Idiom-first, corpus-gated.** Every idiom lands as a corpus row before or
   with its implementation: exact native input (real diacritics/script) →
   exact canonical value. Per-locale corpus files
   (`tests/corpus/locale-<id>-source.mjs` → `locale-<id>.json` contracts)
   mirror the main corpus mechanics and gate `bun run check`, so locale
   behavior can never silently regress. Frequency tags (very-common/common/
   occasional) rank what ships first.
2. **Engine stays language-neutral; packs stay data.** Idiom classes blocked
   by the engine get the *smallest data-driven extension*: a new optional
   pack field consumed by existing grammar (D5). No per-language parser
   branches (the chrono-node lesson: 14 imperative locale parsers still miss
   vigesimal French and "en huit" — imperative locale code doesn't scale).
3. **Authoritative sources over invention.** CLDR RBNF spellout rules
   (number words, vigesimal, CJK scales) and dateFields (relative-date vocab)
   are the canonical data sources — Unicode-licensed, embeddable. Duckling's
   per-language `Corpus.hs` gold sets (BSD-3) validate our corpus rows.
   Recognizers-Text YAML documents hazard patterns (CJK ambiguity filters).
4. **Two-way and ambiguity rules unchanged.** New idioms are ADDITIVE corpus
   entries. Hazards (三/多 polysemy, 斤 regional values, "half seven"
   UK-vs-de semantics) follow the D4 honest-ambiguity policy.

## Wave 1 (this pass)

Engine unlocks, each consumed through new optional pack fields:

- **Romance number composition** — tens + and-word + ones (`treinta y
  cinco`); bare scale words (`cien gramos`, `mil metros`); single-word
  hundreds via `numberWords.composed` (`quinientos`, `quatre-vingt-dix`
  exhaustive vigesimal per CLDR RBNF); spoken decimal separators
  (`dos coma cinco`) via `numberWords.decimalWords`.
- **Multi-word approximants** — leading `grammar.approximatePhrases`
  (`más o menos`, `à peu près`, `por volta de`); trailing data fixes ride the
  existing `trailingApproxPhrases` (`y pico`, `e pouco`).
- **CJK segmentation** — intra-token number sub-parser (三十五, 一百五十万,
  elliptical 一百五 = 150, mixed 3万5千), unit/particle splitting
  (三公斤, 5公斤左右), wave-dash ranges (5〜10), adjacent-number ranges
  (三四个), post-unit 半.
- **Localized date grammar** — pack-owned spoken clock vocabulary
  (`las tres menos cuarto`, `deux heures et quart`, 午後3時半, `quarter of
  five`), period-edge phrases (`a finales de mes`, `fin juillet`, 月底),
  weekday-offset phrases (`lundi en huit`, `Monday week`), after-next/
  before-last modifiers (再来週/先々週), day+day-part compounds
  (`tomorrow morning`), duration parsing honoring pack unit words
  (`2 horas`, `hora y media`).
- **Deepened packs** for es/fr/pt/zh/ja/en-GB covering every data-only gap
  idiom from the research, plus per-locale corpus gates.

Deliberately deferred to wave 2 (backlog): CLDR-generated unit-alias packs at
scale, new locales (de/it/nl/ko/ar incl. RTL + Eastern Arabic numerals),
localized humanize output (D66 deferral stands), counters/classifiers beyond
filler handling, height/weight elliptical speech ("uno ochenta"), currency
slang ("a grand", "5 lucas").

## Acceptance

- Per-locale corpus gates run in `bun run check`; every wave-1 idiom class has
  rows; existing English corpus interpretation unchanged (ADDITIVE only).
- All very-common idioms from the research parse in their language, with
  round-trip where the two-way guarantee applies.
- Size: locale-pack standalone/marginal budgets and engine entries
  recalibrate once, with a D-entry recording measured costs (D62/D64/D66
  pattern) — never silently.
