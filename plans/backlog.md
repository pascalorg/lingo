# Backlog — parking lot

Tangential ideas and deferred follow-ups land here so active work stays scoped.
Promote to a numbered plan when one is actually scheduled. Agents: when an idea
surfaces mid-task, add it here and keep going — don't act on it.

## Parsing & units

- **Suffix multipliers `M` (1e6) and bare `b` (1e9)** — plan 002 originally
  spec'd them; v0.1 shipped `k`/`K` and `bn` only (plan amended to match).
  Implementing them needs hazard analysis (`M` vs mega/meters, `b` vs bit) and
  corpus gating. Untyped glued `1M` is currently rejected so the concentration
  kind (D47) does not silently consume a future million suffix; use `1 M` or
  `kind: 'concentration'` for molar fields. (`packages/lingo/src/number/value.ts`)
- **Megaliter needs a disambiguation before it can ship** — `ML` is both the
  megaliter symbol and the common casual milliliter spelling ("250 ML"), so it
  currently reads as milliliter (deferred by D53). Registering megaliter safely
  needs an `AMBIGUOUS_UNIT` path (milliliter default + megaliter alternative),
  like the `oz`/byteish pattern.
- **`psig`/`psia` gauge vs absolute pressure** — deferred by D51; the symbols
  need gauge/absolute semantics, not a plain psi alias. `kg/cm2` stays deferred
  for the same review reason (`kg` is kilogram mass; `kgf/cm2` is the declared
  pressure unit).
- **Nautical-mile and ounce ambiguity** — `NM` vs nanometer and bare `oz`
  mass-vs-volume should get an explicit ambiguity policy before changing
  default parse behavior.
- **Dimensional expressions** — arbitrary unit algebra (beyond the declared
  flow_rate/concentration/torque/… kinds) needs a separate kind/model decision
  rather than ad hoc aliases (algebra deferred per D2).
- **Range span excludes the frame word** — `from 5 to 10 kg` and
  `between 5 and 10 kg` spans start at the first value, not at `from`/`between`.
  `buildRange` (`range.ts`) could extend the span to cover the leading frame.
- **`withFractionTail` spaced-vulgar question** — the guard was simplified to
  the provably-equivalent `t?.type === 'vulgar'`; open question whether the
  original intent was `joiner || !t.spaceBefore` (reject spaced "2 ½").
  Changing that would alter corpus-locked behavior — needs an owner decision.
  (`packages/lingo/src/number/value.ts`)

## Currency

- **Async/historical FX rate providers** — deferred from plan 026; only
  injected static snapshots/providers ship.
- **Currency bundle placement** — currency ships in the default bundle (D28).
  If the default entry must shrink, trim the curated set or move it to an
  opt-in entry.
- **Minor-currency range distribution bug** — `5 or 6 cents` (also
  `5 to 6 cents`, `5-6 cents`, `between 5 and 6 cents`) yields `$0.06–$5.00`:
  the bare side inherits the major unit while the other is minor. Fix in
  `buildRange`, independent of the range separator.

## Dates & times

- **Approximate time forms (`~5pm`, `5ish`, `around 5pm`)** — deferred from
  plan 030 (D58). Needs an `approximate` flag on `DateResult` (and the range
  endpoints), which touches the whole date result shape and its serialization.
  Fold in with a broader "approximate/uncertain date" pass; `humanizeDate`
  would need to emit the marker back for two-way.

## Wire schema & types

- **`./schema` does not yet cover date-module wire shapes** — `parseDate`/
  `parseDateRange`/`parseDuration` serialize v3 (flat, ISO dates,
  self-describing spans) but the machine-readable JSON Schema in
  `src/schema/index.ts` only describes the main-entry result union. Extend it
  (and the generated site artifacts) when the date wire shape is next touched.
- **v3 wire: conversion `source` omits `parts`/`fuzzy`/`approximate` (minor)** —
  a conversion source is a deliberately minimal `{type,value,unit,base,baseUnit}`
  (or range bounds), so `5 ft 11 in to cm` loses the compound `parts` in the
  serialized `source`, and fuzzy/approximate range sources drop those flags.
  Asymmetric with standalone quantity/range serialization; add them if source
  fidelity matters.
- **`LingoResult.toJSON` is typed optional** — attached at the parse boundary and
  always present at runtime (enumerable), but the interface declares it optional
  (so the parser's result literals type-check), so `lingo(x).toJSON()` needs
  `?.`/`!`. `JSON.stringify(lingo(x))` is unaffected. A finalized public return
  type could make it required.
- **Custom registry type inference** — top-level helpers and built-in
  `createLingo()` instances are typed (plan 027); deriving safe literal refs
  from arbitrary caller-owned registries remains a later
  `LingoInstanceFor<Kinds>` pass.
- **Type-level lowercase-alias collisions** — `KindOfUnit<'c'>`/`<'r'>` resolve
  to `never` (lowercase Celsius/Rankine are runtime-only case-folds, not
  declared refs), so `convert(5,'c','mAh')` compiles then throws while
  `quantity(5,'c')` over-strictly type-errors (surfaced by the D54 review).
  Closing it means case-insensitive type refs, which plan 027 rules out for
  editor perf — needs a targeted approach, not a blanket expansion.

## Testing & tooling

- **canonicalizeValues root-spec ('') ordering semantics** — the root-path
  branch now assigns the parsed root and keeps processing (order-independent,
  covered by tests). Open question: should a root spec compose with sibling
  path specs at all, or should mixing them be rejected as a configuration
  error? No plan text covers it. (`packages/lingo/src/ai/canonicalize.ts`)
- **Extract the fake-DOM harness from `dom.test.ts`** — its first ~290 lines are
  a hand-rolled fake DOM (TestElement/TestInputElement/installDom/typeInto/…)
  before the first behavior test. Moving it to `tests/fixtures/fake-dom.ts`
  (and absorbing the ~15 `el as unknown as HTMLInputElement` casts into typed
  helpers) would make the file read as pure `lingoInput` behavior and give the
  future react-hook test a host. Pure reorganization — do deliberately rather
  than rushed. (`packages/lingo/src/dom/dom.test.ts`)
- **Corpus/test sync guard** — `breadthRows`/`dateRows` in
  `tests/corpus/source.mjs` hand-mirror the inputs in `corpus.test.ts` /
  `date.test.ts`; a case added to one silently escapes the other. Add an
  assertion that every tested input+opts pair exists in the corpus rows
  (normalizing opts via `JSON.stringify` across the `.ts`/`.mjs` boundary, date
  opts through the same `FIXED_NOW` serialization). First reconcile the one
  known gap: `'this Sunday'` is tested in `date.test.ts` but absent from
  `dateRows` (append it as an ADDITIVE row). Deferred: the cross-boundary opts
  normalization needs care to avoid false positives.
  (`packages/lingo/tests/corpus/source.mjs`)
- **Supply-chain release-age gating** — minimum-release-age install protections
  were dropped with the bun switch (D22 — the bun siblings don't gate). If
  wanted back, configure bun's install security options intentionally.
- **`format.ts` Intl cache vs full-entry headroom** — needs a D-entry either
  way.

## Site & docs

- **`next.config.ts` has `ignoreBuildErrors: true`** — tsgo runs separately so
  type safety exists, but the flag deserves an intentional decision.
- **Site single-linter endgame** — the site keeps `eslint.config.mjs` alongside
  biome; decide whether eslint stays. Also: verify whether the ultracite pass
  re-sorted Tailwind classes anywhere visual (production build is green; a
  visual spot-check of the docs pages before first deploy would close this).
- **README badges** (npm version, CI, min+gz size, zero deps) — add to
  `packages/lingo/README.md` once the package is published and CI is public.

## Packaging & ecosystem

- **`packages/mcp`** — plan 021 phase 3's demo MCP server has a natural home in
  the monorepo; still pending go.
- **Locale packs as packages** (`@pascal-app/lingo-locale-*`) — plan 013 can
  target sibling packages instead of subpath data modules; decide when i18n
  work starts.
- **`plans/archive/` protocol** — adopt an `archive/YYYY-MM/` convention if the
  plans index ever outgrows one screen. Not needed at the current count.
- **CHANGELOG contributor attribution** — adopt a
  `**title** — description ([#PR](url)) by [@handle]` format once external
  contributions exist.
