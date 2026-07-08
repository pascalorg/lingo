# Changelog

All notable changes to lingo are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com); versioning follows SemVer with one
sharpening: **changing the interpretation of previously-valid input is a breaking
change**, even if the API is untouched.

## [Unreleased]

## [0.1.0] - 2026-07-08

### Positioning

- **"Make forms easier, LLM tools safer."** is the tagline and the product
  thesis: one parser powers forgiving human fields and safe-by-default tool
  schemas, serving humans, LLMs, API developers, and MCP integrations.

### Added

- Core engine: offset-mapped unicode normalization, tokenizer, numeric-literal
  parsing (separator policy, fractions incl. unicode, scientific notation, number
  words, fuzzy amounts), unit registry with longest-prefix alias matching,
  case-exact rules, kind-context ranking and did-you-mean suggestions.
- Thirty-three built-in kinds with exact legal conversion factors — length,
  mass, temperature, duration, volume, area, speed, data, pressure, energy,
  angle, percent, currency, and the scientific set (frequency, power, force,
  and friends).
- Quantity grammar: compounds (5'11", 1m80, 1h30, 2 lb 3 oz), ranges (5–10 kg,
  between/±/open bounds), qualifiers, conversion requests (72 in to cm),
  confidence + alternatives, structured issues with input spans.
- Fuzzy temperature vocabulary (weather/water/oven profiles), two-way via
  `describeTemperature`.
- Formatting: compound output with rounding carry (6′7″), best-fit unit selection,
  Intl-backed locale number formatting; format→parse round-trip invariants.
- Date & duration module (`@pascal-app/lingo/date`): natural-language dates, reversible
  humanization, ISO-8601 durations.
- Headless DOM controller (`@pascal-app/lingo/dom`) and React hook (`@pascal-app/lingo/react`).
- llms.txt, demo playground, size budgets, CI.
- Strictness & escalation: `strictness: 'forgiving' | 'confirm' | 'strict'`,
  `accept` switches (ranges/conversions/compounds/fuzzy/numberWords/
  approximations/bareNumbers), `tolerance` (typos fix/suggest/off), per-code
  `escalate` severity map, and `candidate` on failed results (did-you-mean UX).
  New codes: APPROX_NOT_ALLOWED, UNIT_REQUIRED, CONVERSION_NOT_ALLOWED.
- Mixed-unit additive chains: "20in and 10cm", "1 m + 3 ft", "2 m minus 10 cm",
  humanize-duration lists ("1 day, 3 hours, 2 minutes") — any order, delta-safe,
  faithful re-formatting.
- Colloquial idioms: "in 2d", "2w ago", "3min from tmrw" (implied-time anchors),
  "next tues", "@ 3pm", filler words (like/maybe/gimme) as approximate markers,
  duration primes (12' / 45'') under duration context.
- Message packs: English copy as swappable data (`englishMessages`,
  `setDefaultMessages`) — `/core` ships copy-free for BYO-i18n.
- Demo website (`apps/site/`): Next.js App Router + Tailwind + shadcn (Base UI),
  five interactive pages incl. a runnable server action.
- `createLingo({ registry?, kinds?, messages?, fuzzy? })` factory: isolated
  instances (own registry, messages, fuzzy vocab — inputs snapshotted, zero
  cross-instance leaks); the global `lingo()` is now a `createLingo()`
  singleton internally.
- Typed issue payloads: `IssueDataMap` + generic `LingoIssue<Code>`; result
  helpers `firstError`, `isQuantity`/`isRange`/`isConversion`, `candidateOf`,
  `formatIssue`.
- `NOW_REQUIRED` (strict mode): relative date inputs without an explicit `now`
  fail with a candidate computed from the implicit now; absolute dates are
  unaffected.
- Corpus compatibility contract: `tests/corpus/contract-v1.json` (431 entries),
  exact-replay test, and `scripts/corpus-diff.mjs` classifying drift as
  ADDITIVE vs BREAKING — a blocking gate in `bun run check` and CI.
- Recipes (README + `docs/recipes.md`), TSDoc `@example` on every public
  symbol (143 verified examples), npm provenance release workflow.
- Benchmark harness (`scripts/bench.mjs`, plan 018): backend + browser suites,
  baseline compare; first capture shows microsecond-scale interactive paths
  (simple parse 2.7 µs, mixed grammar 4.9 µs on Apple Silicon/Node 24).
- Suggestion-path pruning (D17): did-you-mean 326.9 → 28.1 µs/op (11.6×) with
  2–6× side-wins on typo-fix, strict-confirm and `partialState`; output parity
  proven over 1.97M alias/probe pairs. Size budgets 23.25/16.75 kB.
- `@pascal-app/lingo/ai` (plan 019, D18): `quantityField`/`rangeField`/
  `dateField` implementing BOTH Standard Schema halves (validate + JSON
  Schema) so they drop into AI SDK `generateObject`/tool schemas without Zod;
  `lingoObject` combinator; `repairTextWith` (`experimental_repairText`-
  compatible, client-side); `canonicalizeValues` for arbitrary payloads.
  Input JSON Schemas are `type:"string"` so strict provider modes let models
  emit natural language for lingo to canonicalize. Tree-shakeable:
  quantityField-only ≈1.2 kB marginal (CI-gated at 1.5 kB; grew from ≈0.85 kB
  with the D20 safety defaults), full entry ≤8.0 kB with the date engine.

- Tool-boundary safety defaults in `@pascal-app/lingo/ai` (plan 020, D20):
  `AMBIGUOUS_NUMBER` escalates to error with a did-you-mean candidate;
  `dateField` escalates `TZ_IGNORED` and requires an explicit `now` for
  relative dates (`requireNow: false` opts out); `min`/`max` bounds on
  quantity/range/date fields (RANGE_MIN/RANGE_MAX + JSON Schema
  `minimum`/`maximum` + input-description hints); `lingoObject` closed by
  default (`additionalProperties: false`, unknown keys fail, OpenAI-strict
  compatible; `{ passthrough: true }` opts out); success results carry
  `warnings: [{ code, severity, message }]` so absorbed forgiveness is never
  silent; `canonicalizeValues` issues gain `severity` + `code` (warnings ride
  along on applied values; `repairTextWith` only blocks on errors); canonical
  numbers are float-safe (`1.36077711`, never `1.3607771100000001`).
  Eval: lingo accepts 96.9% with 0% silent-wrong (naive: 17.5% / 6.3%);
  the 3.1% delta is honest rejection-with-candidate on genuinely ambiguous
  separators. `/ai` budget recalibrated 8.0 → 8.9 kB (D20).
- MCP integration, phase 1 (plan 021): MCP tool recipe (`docs/recipes.md`),
  README "MCP tools" section, site docs MCP snippet tab, llms.txt guidance —
  lingo fields as MCP `inputSchema` + `safeParse` in handlers with
  `[CODE]`-prefixed issues as self-correction tool errors.
- Percent vocabulary: "percentage point(s)" aliases and basis points
  (`bps`/`bp`/"basis points", 0.01%) — finance tools speak pct/pp/bps
  (owner directive; no other kind claims `bps`).
- DOM fields advertise their configured `data-kind` before any parse (plan
  012 completion) — browser agents can discover field semantics from an idle
  DOM (`data-lingo` + `data-kind` + `data-unit`).
- Site SEO/social/agent infrastructure: `metadataBase`, OpenGraph + Twitter
  cards with a generated 1200×630 image, canonical URLs, `robots.txt`,
  `sitemap.xml`, per-page metadata; docs IA moves "For AI" directly after
  Forms; `/llms.md` gains the tool-boundary defaults, the MCP pattern, and
  the missing `NOW_REQUIRED` code.
- `@pascal-app/lingo/ai` ecosystem-integration helpers (plan 024): eval
  graders `quantityMatch`/`dateMatch` (canonicalize both sides through one
  field, then compare — relative-error tolerance for quantities, grain-
  truncated ISO comparison for dates — and return `{ pass, score, reason }`,
  duck-typed to promptfoo's `GradingResult`); `repairToolCallWith(specsByTool)`
  (the AI SDK v6/v7 `experimental_repairToolCall`-shaped repair hook
  `repairTextWith` didn't have — v6/v7 deprecated `generateObject`/
  `experimental_repairText` with no tool-call-shaped successor); `optional(field)`
  (nullable tool arguments — the key stays `required`, the type admits
  `null`, matching OpenAI/Anthropic's own optionality idiom); `toJSONSchema(field,
  { io?, target? })` (a named wrapper over a field's `~standard.jsonSchema`
  half, for raw provider SDKs).
- `@pascal-app/lingo/mcp` (new entry, plan 021 phase 2 + plan 024):
  `lingoTool({ name, description, input, passthrough?, handler })` builds a
  complete MCP tool descriptor from a `lingoObject` shape — closed JSON
  Schema `inputSchema`, and a `callback` that runs `safeParse` before the
  handler, returning `[CODE]`-prefixed issue messages as an `isError` tool
  result so the model self-corrects. Zero-dep; bring your own MCP SDK.
- `@pascal-app/lingo/element` (new entry, plan 024): `defineLingoInput(tag?)`
  registers a form-associated `<lingo-input>` custom element — a light-DOM
  `<input type=text>` wired through `lingoInput()` and `ElementInternals`
  (`setFormValue`/`setValidity`, `formResetCallback`/`formDisabledCallback`)
  instead of a hidden input, so it works unmodified from Vue, Svelte,
  Angular, and plain HTML.

### Fixed

- The AI-eval gate is host-timezone-independent: the corpus's expected date
  instants are civil times recorded in Europe/Paris, so the test now pins that
  zone before the date engine loads (it previously failed on UTC CI runners).

- llms.txt drift: the entries list now includes `@pascal-app/lingo/ai`; the
  `"3min from tmrw"` canonical example now matches the implementation
  (tomorrow, same time-of-day +3 min — the corpus-locked behavior), and the
  blockquote leads with the tagline.
- Site `llms.txt`/`llms.md` links now use plain `<a>` instead of `next/link`
  (client-side navigation 404s on non-app routes — header, footer, and the
  docs For-AI tiles were all affected).
- Landing hero readout no longer claims "safe for forms/tools" for
  warning-bearing parses — it shows "review warnings" instead; the AI
  canonicalizer demo distinguishes `warn:` badges from `error:` badges.

### Changed

- Parser internals split into focused modules (`parse/config`, `unit-match`,
  `quantity`, `range`, `conversion`, `finish`) behind an unchanged facade —
  zero behavior change, corpus-locked. The same treatment later applied to the
  date parser (`date/parse` → `relative`/`time`/`range`/`absolute`/`state`),
  the DOM controller (`dom/index` → `controller`/`format`/`attributes`), and
  the main entry (`createLingo` extracted to `src/factory.ts`).
- The transitional flat `describe()` view was removed from
  `@pascal-app/lingo/describe` before first release — `describeResource()` and
  `describeResult()` are the one resource vocabulary.
- Date-module results (`parseDate`, `parseDateRange`, `parseDuration`) now
  serialize with the same v3 wire contract as `lingo()` results:
  `schemaVersion: 3`, ISO date strings, and self-describing
  `{ start, end, text }` spans. Previously `JSON.stringify` on a date result
  emitted the raw runtime shape (bare `{ start, end }` spans, `Date` objects
  via default ISO coercion, no version). The site docs' "Raw JSON" views now
  show the real wire JSON instead of a hand-built approximation.
- DOM developer errors are now actionable (name the element/option and the
  fix); React adapter uses real `@types/react` typings.
- Issue ranking: a unit-slot typo now wins over the disabled-compound shape
  error (`"5 meterz"` with `accept.compounds:false` reports `UNKNOWN_UNIT`,
  not `SINGLE_VALUE_EXPECTED`).
- `StandardSchemaV1Options` narrowed to exactly `{ readonly libraryOptions?:
  Record<string, unknown> | undefined }` to match the ratified
  `@standard-schema/spec@1.1.0` (added as a types-only devDependency, zero
  runtime cost — its published `dist/index.js` is a 0-byte file); new
  spec-conformance and JSON-Schema-portability tests guard against drift from
  the published spec (plan 024).
- `./ai` marginal budget recalibrated 8.9 → 9.9 kB for the plan-024 DX
  helpers (grade, repair-tool-call, optional, toJSONSchema) — product, not
  bloat (D14/D17 pattern, D24); `./element` and `./mcp` ship as new
  tree-shakeable entries with their own line in `bun run size`.

### Docs

- Ecosystem integration recipes (plan 024): verified, cited recipes for AI
  SDK (v6/v7 direct + the v5 wrapper + `repairToolCall`), OpenAI, Anthropic,
  Gemini, the OpenAI-compatible tier (Grok/Mistral/Cohere v2/Groq/Ollama/
  Hugging Face), LangChain, MCP, evals, form libraries (React Hook Form,
  TanStack Form, Formik, Vue, Angular, shadcn, vanilla), database input, and
  a per-vertical form-UX gallery with real unit-error citations — landed in
  `docs/recipes.md`, README, and llms.txt.
