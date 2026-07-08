// Size budget enforcement (plan 001). Measures min+gzip via esbuild.
// Entry budgets are absolute; layer budgets (date/dom/react) are MARGINAL:
// size(core + layer) − size(core), since layers import the main entry.

import { existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { build } from 'esbuild'

const ROOT = new URL('..', import.meta.url).pathname

async function bundleStdin(contents, external = []) {
  const result = await build({
    stdin: { contents, resolveDir: ROOT, loader: 'ts' },
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2020',
    write: false,
    external,
    logLevel: 'silent',
  })
  const code = result.outputFiles[0].contents
  return gzipSync(code, { level: 9 }).length
}

const has = (p) => existsSync(new URL(p, new URL('..', import.meta.url)).pathname)

const rows = []
let failed = false

function check(label, size, budget) {
  const ok = budget === null || size <= budget
  if (!ok) {
    failed = true
  }
  rows.push({
    entry: label,
    'min+gz': `${(size / 1000).toFixed(2)} kB`,
    budget: budget === null ? '—' : `${(budget / 1000).toFixed(1)} kB`,
    status: budget === null ? '·' : ok ? 'ok' : 'OVER',
  })
  return size
}

// 32.9 (was 32.3): D57 — v3 compact wire schema (flat, single schemaVersion/
// type, `span:{start,end,text}`, dropped `targetUnit`/`converted.base`). The
// flat serializer (parse/serialize.ts) adds ~0.5 kB to full; the owner's
// self-evident-JSON ask. Runtime objects unchanged (serialization-only). Also
// bumps core/date/ai/describe/dom a few gzip bytes for the resumed
// correctness/DX pass (D53 hazard units, natural-phrasing grammar, D52
// describeResource guard, D56 catalog); see decisions.md D55/D56/D57.
// 32.3 (was 31.8): D55 — resumed-goal correctness/DX pass (see decisions.md).
// 31.8 (was 31.6): D51 — finite pressure coverage for water-column units and
// kgf/cm²/technical atmosphere. Core/date budgets stay unchanged; cost is
// default unit data and docs-facing examples after trimming unsafe kg/cm².
// 31.6 (was 30.6): D49 — advanced scientific kind batch: acceleration, torque,
// light units, radiation dose/activity. Core parser budget is unchanged; cost
// is default unit data plus AI example strings for tool descriptions.
// 30.6 (was 30.3): D48 — GBP pence idioms (`50p`, `3 quid 50`) are shared
// parser behavior so currency outputs stay canonical (`unit:'GBP'`, not a
// fake pence unit). Peer/adversarial review also hardened explicit pence
// tolerances (`3 quid ± 50p`) and overflow diagnostics.
// 30.3 (was 30.0): D47 — built-in concentration kind: M/mM/µM/nM/pM plus
// mol/L families, with exact-case guards so molarity shorthands do not steal
// meter/millimeter/micrometer. Trimmed duplicate long aliases first; remaining
// cost is owner-requested scientific-unit coverage in default unit data.
// 30.0 (was 29.3): D46 — built-in flow_rate kind: L/s, L/min, mL/min,
// gpm, cfm/cfs, and m³/h live in default unit data instead of pretending
// volume+duration algebra exists. Core parser budget is unchanged.
// 29.3 (was 28.9): D45 — built-in data_rate kind: Mbps/kbit/s/MB/s style
// throughput units live in default unit data, while bare `bps` stays percent
// basis points. Core parser budget is unchanged; this is coverage data.
// 28.9 (was 28.4): D44 — currency minor-unit idioms (`50 cents`,
// `five dollars and fifty cents`) live in shared parsing so outputs stay
// canonical currency quantities instead of fake cent units.
// 28.4 (was 27.6): D43 — built-in electrical + substance scientific batch:
// voltage/current/resistance/charge/substance unit tables, C/coulomb ambiguity
// warnings, exact-case charge and molarity hazards, corpus/docs sync gate.
// Product coverage requested by owner; dimensional expressions stay deferred.
// 27.6 (was 27.5): D42 — peer/adversarial hardening made the new resource view
// clearer (`resourceSchemaVersion`, `canonicalUnit`, conversion target units,
// alternatives/compound parts as resources) and guarded hazardous abbreviations:
// uppercase `NM` no longer silently means nanometers, bare `oz` warns without a
// kind context. Corpus contract stayed unchanged; remaining cost is DX/safety.
// 27.5 (was 27.3): D41 — resource-style parse-result output stays opt-in, but
// the main entry gained the first natural unit/idiom coverage slice requested
// with it: spoken quotient aliases, micro/centi/deciliter, cubic feet, sf, and
// conversational qualifiers/bounds. Trimmed broad aliases first; remaining cost
// is the user-facing grammar/coverage product.
// 27.3 (was 27.2): D40 — bare ambiguous currency symbols now surface
// AMBIGUOUS_UNIT instead of silently assuming USD/JPY, with an explicit
// `currency` parse option to disambiguate. The shared parser implementation was
// compacted before recalibration; remaining cost is honest currency semantics.
// 27.2 (was 27.0): D39 — `tryConvert()` adds a non-throwing conversion result
// for service/tool code, plus kind-aware dynamic `convert()` failures. The shape
// was trimmed to `{value,unit,kind}` success payloads and typed issue failures
// before recalibration; remaining cost is product DX, not accidental drift.
// 27.0 (was 26.9): D35 — /ai rangeField self-describing output added a public
// open-bound issue code/copy to the shared issue surface. The actual full-entry
// cost is tiny (+~0.03 kB), but strict byte budgets need recorded headroom.
// 26.9 (was 26.7): D31 — RATE_REQUIRED parse hardening for currency text:
// cross-currency conversion requests and mixed-currency ranges now return issues
// instead of throwing or comparing self-canonical amounts, and same-currency ranges
// serialize with their concrete baseUnit. +0.16 kB full; product correctness.
// 26.7 (was 25.9): D30 — scientific batch (plans 002/003): built-in force/power/
// frequency kinds (data) + scientific/engineering format notation in the shared
// renderNumber. +0.7 kB, product the owner asked for ("more scientific units").
// 25.9 (was 23.9): D28 — currency shipped in-library (plan 026, 6a+6b): a
// 25-currency `currency` kind, prefix-symbol parsing ($5/€10), Intl currency
// formatting, rate-based cross-currency guard, `convertCurrency` (injected-rate
// conversion), `toMinor`/`fromMinor` (Stripe integer-cents), and slang aliases.
// +2.0 kB — built-in currency is product the owner asked for; trimmable to a
// smaller curated set or an opt-in entry if the default bundle must shrink.
// 23.9 (was 23.6): D27 — plan 025 self-describing wire schema: value+unit+base+
// baseUnit on quantities, value+base per range bound, plusMinus mislabel fix,
// schemaVersion, fromJSON validation. +300 B — the JSON now reads on its own
// (owner's core ask), self-describing product not bloat.
// 23.6 (was 23.5): D26 — plan 025 correctness batch (contains() cross-kind
// guard, non-finite base guards, negative superscript exponent): +60 B of
// correctness product, not drift. Prior: D19 parser hot-path pass (ASCII
// identity normalization + prepared-state reuse): free-text scan 3.6x, bulk
// validation 2.5x, hostile latency 2.8x for +140 B. D17 suggestion pruning
// (+228 B for 11.6x), strictness/idioms (22→23), D14 error copy.
// 33.0 (was 32.9): D60 — `Registry.aliasCompletions()` for ranked prefix
// autocomplete (+~100 B in the shared registry). `./complete` stays a separate
// entry; the orchestrator does not ship in `.`.
// 35.7 (was 33.0): D62 — locale-pack infrastructure: resolved language
// profiles, optional auto-detection, diacritic folding, CJK token support, and
// built-in hooks for tree-shakeable es/fr/pt/zh/ja/en-gb packs. English-only
// parsing uses a prebuilt singleton, but the shared parser still carries the
// public `createLingo({ locales })` / `locale` option machinery.
// 35.8 (was 35.7): D63 — locale correctness hardening: English wins inherited
// overlay ties, explicit unloaded locales return LOCALE_NOT_LOADED, and zh/ja
// pack-owned CJK aliases/fuzzy vocab install through a tiny registry hook.
const full = await bundleStdin(`export * from './src/index.ts'`)
check('lingo (full)', full, 35_800)

if (has('src/locales/es.ts')) {
  const enLocale = await bundleStdin(`export * from './src/locales/en.ts'`)
  check('./locales/en (standalone data)', enLocale, 1800)
  const esLocale = await bundleStdin(`export * from './src/locales/es.ts'`)
  check('./locales/es (standalone data)', esLocale, 1150)
  const frLocale = await bundleStdin(`export * from './src/locales/fr.ts'`)
  check('./locales/fr (standalone data)', frLocale, 1150)
  const ptLocale = await bundleStdin(`export * from './src/locales/pt.ts'`)
  check('./locales/pt (standalone data)', ptLocale, 1150)
  const zhLocale = await bundleStdin(`export * from './src/locales/zh.ts'`)
  check('./locales/zh (standalone data)', zhLocale, 700)
  const jaLocale = await bundleStdin(`export * from './src/locales/ja.ts'`)
  check('./locales/ja (standalone data)', jaLocale, 700)
  const enGbLocale = await bundleStdin(`export * from './src/locales/en-gb.ts'`)
  check('./locales/en-gb (standalone data)', enGbLocale, 250)

  const withRomanceLocales = await bundleStdin(
    `export * from './src/index.ts'; export { es } from './src/locales/es.ts'; export { fr } from './src/locales/fr.ts'; export { pt } from './src/locales/pt.ts'`,
  )
  check('./locales es+fr+pt (marginal over full)', withRomanceLocales - full, 2200)
  const withCjkLocales = await bundleStdin(
    `export * from './src/index.ts'; export { zh } from './src/locales/zh.ts'; export { ja } from './src/locales/ja.ts'`,
  )
  check('./locales zh+ja (marginal over full)', withCjkLocales - full, 850)
  const withAllLocales = await bundleStdin(
    `export * from './src/index.ts'; export { es } from './src/locales/es.ts'; export { fr } from './src/locales/fr.ts'; export { pt } from './src/locales/pt.ts'; export { zh } from './src/locales/zh.ts'; export { ja } from './src/locales/ja.ts'; export { enGb } from './src/locales/en-gb.ts'`,
  )
  check('./locales all loaded (marginal over full)', withAllLocales - full, 2900)
}

// 19.9 (was 19.6): D48 — shared parser recognizes GBP pence idioms and
// explicit pence tolerance deltas while keeping currency JSON self-canonical
// (`unit:'GBP'`, not a registered pence unit).
// 19.6 (was 19.1): D44 — shared parser recognizes currency minor-unit idioms
// while keeping rate-based currency JSON self-canonical (`unit:'USD'`, not a
// registered `cent` unit).
// 19.1 (was 19.0): D42 — shared parser ambiguity guard for bare `oz`; keeping
// mass default compatible while surfacing the fluid-ounce hazard.
// 19.0 (was 18.9): D41 — the shared parser accepts `approx.`, polite lead-ins,
// inclusive "no greater than"/"less than or equal to" bounds, and "mark" tails.
// These improve form/tool DX for core BYO-registry callers too.
// 18.9 (was 18.8): D40 — currency symbol ambiguity detection lives in the
// shared parse path so `core` callers get the same warning/error policy.
// 18.8 (was 18.5): D31 — RATE_REQUIRED and rate-based range self-canonical JSON
// guards live in shared parse/core. +0.22 kB; user/model text must not throw.
// 18.5 (was 18.2): D30 — scientific/engineering notation in the shared
// renderNumber (new force/power/frequency DATA stays out of core). +0.22 kB.
// 18.2 (was 17.5): D28 — currency rate-based conversion machinery (plan 026):
// the generic `rateBased`-kind guard blocks factor conversion across currencies
// in convert/convertDelta/to/valueIn/range.to. +0.55 kB engine capability (data
// stays out of core).
// 17.5 (was 17.2): D27 — plan 025 self-describing wire schema (see full): the
// v2 toJSON computes value+baseUnit, ranges carry value+base per bound, and
// fromJSON validates schemaVersion/finite/bounds. +300 B of self-describing
// product — the owner's headline DX ask.
// 17.2 (was 17.0): D26 — plan 025 correctness batch: non-finite base guards
// (reject Infinity/NaN before it corrupts a value), contains() cross-kind
// throw, negative superscript exponent (1×10⁻³). +110 B of correctness
// product, not drift. Prior: D23 quality pass 2026-07-05 (plan-002 'several'
// fuzzy amount, registerUnits defensive clone, contains() actionable error);
// D19 hot-path structures, D17 perf indexes, D14 human error copy.
// 23.2 (was 20.5): D62 — shared locale resolver/detector/profile merge and
// diacritic/CJK tokenizer support live in the engine so BYO-registry users get
// the same locale semantics without importing default unit data.
const core = await bundleStdin(`export * from './src/core/index.ts'`)
check('./core (engine, no unit data)', core, 23_200)

if (has('src/date/index.ts')) {
  const dateAlone = await bundleStdin(`export * from './src/date/index.ts'`)
  // 28.2 kept: D49 — advanced scientific unit data does not change standalone
  // date size; only the marginal-over-full gzip interaction moved.
  // 28.2 (was 28.0): D48 — standalone date inherits the shared parser's GBP
  // pence tolerance and overflow-diagnostic hardening.
  // 28.0 (was 27.9): D47 — standalone date bundles the shared parser/default
  // registry path, so it inherits the concentration unit table expansion.
  // 27.9 (was 27.4): D44 — standalone date bundles the shared parser/default
  // registry path, so it inherits currency minor-unit idiom parsing.
  // 27.4 (was 27.3): D43 — standalone date bundles the shared parser/default
  // registry path, so it inherits the scientific unit table expansion.
  // 27.3 (was 27.2): D41 — inherits the shared parser's conversational
  // qualifier/bound grammar from core.
  // 27.2 (was 27.1): D40 — date standalone bundles the shared parser, including
  // the currency symbol ambiguity guard and `currency` disambiguation option.
  // 27.1 (was 27.0): D36 — hidden-clock removal makes the standalone date
  // entry carry the deterministic NOW_REQUIRED guard and humanizeDate runtime
  // now-check. +~0.02 kB after targeted cuts; correctness over byte shaving.
  // 27.0 (was 26.8): D31 — date standalone inherits shared parse/core currency
  // rate-required hardening.
  // 26.5 (was 26.0): D28 — inherits the +0.55 kB core rate-based machinery
  // (currency, plan 026); the date engine bundles core.
  // 31.6 (was 28.8): D58 — time-of-day/timezone/time-slot feature (plan 030):
  // expanded clock forms (17h, o'clock, quarter/half past/to, dot separator,
  // French midi/minuit, military), the zone module (offset/abbrev/IANA/named
  // detection + applyZone), and the parseDateRange/humanizeDateRange range pair
  // (+0.9/+0.4 kB, tree-shakeable when only parseDate is imported). Owner-
  // requested scope; the range/humanize pair is shakeable, the rest is inherent
  // to parseDate's time path. (31.6 incl. D58 adversarial-review hardening:
  // whole-range zone binding + zone-aware am/pm inference.)
  // 32.5 (was 31.6): D59 — v3 wire serialization for date/date-range/duration
  // results (date/serialize.ts): flat schemaVersion:3 shapes, ISO dates,
  // self-describing {start,end,text} spans. The date module previously had NO
  // wire serializer — JSON.stringify leaked the raw runtime shape.
  // 36.2 (was 32.7): D62 — standalone date inherits the shared locale engine
  // through parseDuration and now accepts caller-loaded locale packs for
  // Romance/CJK relative date vocabulary.
  check('./date (standalone, incl. engine)', dateAlone, 36_200)
  const withDate = await bundleStdin(
    `export * from './src/index.ts'; export * from './src/date/index.ts'`,
  )
  // 7.75 (was 7.5): flagged as razor-thin by the idioms review; the Lingo rename's
  // string-length shifts alone crossed it (+10 B gzip). Real growth still gated.
  // 7.85 (was 7.75): D30 — shared renderNumber notation nudged the marginal.
  // 7.9 (was 7.85): D49 — marginal gzip interaction after the full-entry unit
  // data batch; standalone date stayed unchanged.
  // 10.8 (was 7.9): D58 — the plan-030 time-of-day/timezone/time-slot code lands
  // entirely in the date module (absent from `full`), so the marginal carries
  // the full expanded-forms + zone + range parser growth.
  // 11.2 (was 10.8): D59 — date wire serialization (see standalone note).
  // 12.2 (was 11.2): D62 — locale-aware date options and relative-date pack
  // bridge live in `./date`, while the main entry already carries core locale
  // infrastructure.
  check('./date (marginal over full)', withDate - full, 12_200)
}

if (has('src/dom/index.ts')) {
  const withDom = await bundleStdin(
    `export * from './src/index.ts'; export * from './src/dom/index.ts'`,
  )
  // 4.0 restored (briefly 4.05 under D22's baseline artifact): the 2026-07-05
  // quality pass deleted real dom dead code (unused boundOptions/
  // resultApproximate/interpolate paths), putting the marginal back under the
  // original budget with headroom.
  check('./dom (marginal over full)', withDom - full, 4100)

  if (has('src/element/index.ts')) {
    const withElement = await bundleStdin(
      `export * from './src/index.ts'; export * from './src/dom/index.ts'; export * from './src/element/index.ts'`,
    )
    check('./element (marginal over dom)', withElement - withDom, 1200) // plan 024 review fixes
  }

  if (has('src/react/index.ts')) {
    const withReact = await bundleStdin(
      `export * from './src/index.ts'; export * from './src/dom/index.ts'; export * from './src/react/index.ts'`,
      ['react'],
    )
    check('./react (marginal over dom)', withReact - withDom, 1500)
  }
}

if (has('src/describe/index.ts')) {
  const withDescribe = await bundleStdin(
    `export * from './src/index.ts'; export * from './src/describe/index.ts'`,
  )
  // 1.4 (was 1.0): D50 — resource view now covers parseDate()/parseDuration()
  // results too: `lingo.date` exposes ISO/epoch plus local calendar fields,
  // `lingo.duration` exposes displayed and canonical amounts, and failure
  // resources emit a full-input span. This cost stays isolated to ./describe.
  // 1.0 (was 0.8): D42 — resource view clarity pass after peer/adversarial
  // review: scoped `resourceSchemaVersion`, `canonicalUnit`, conversion target
  // unit objects, alternatives, and compound part unit descriptions.
  // 0.8 (was 0.7): D41 — `describeResult()` adds resource-style parse-result
  // views with object names, grouped value/canonical amounts, issue spans with
  // text, conversion data, and recursive candidates. Default JSON stays lean.
  // 0.7: D37 — opt-in rich value description entry. The default JSON stays lean;
  // this layer adds unit labels and formatted strings only when imported.
  check('./describe (marginal over full)', withDescribe - full, 1600)
}

if (has('src/catalog/index.ts')) {
  const withCatalog = await bundleStdin(
    `export * from './src/index.ts'; export * from './src/catalog/index.ts'`,
  )
  // D56 — ./catalog: read-only query surface over built-in unit/kind/currency
  // data. Thin wrappers over the already-bundled registry + a small ISO country
  // map; marginal is the wrappers + map.
  check('./catalog (marginal over full)', withCatalog - full, 1400)
}

if (has('src/complete/index.ts')) {
  const withComplete = await bundleStdin(
    `export * from './src/index.ts'; export * from './src/complete/index.ts'`,
  )
  // 2.25 (was 2.2): D61 — everyday-first prefix tiering asks for a slightly
  // deeper alias pool so min/mi/mL beat obscure scientific shorthands.
  // D60/D61 — ./complete: ranked autocomplete fan-out (unit ambiguity, prefix,
  // range-tail implied units, curated suggest-units table). Marginal is the
  // orchestrator + aliasCompletions index walk; not re-exported from `.`.
  // 2.4 (was 2.25): D63 gzip interaction after the full-entry locale
  // correctness hardening; ./complete code itself did not grow.
  check('./complete (marginal over full)', withComplete - full, 2400)
}

if (has('src/schema/index.ts')) {
  const withSchema = await bundleStdin(
    `export * from './src/index.ts'; export * from './src/schema/index.ts'`,
  )
  // D57 — ./schema: JSON Schema (Draft 2020-12) of the v3 wire types + enum
  // reference + toOpenApi(). Pure data; framework adapters are generated in the
  // docs, not shipped. Marginal is the schema object + enums + OpenAPI helper.
  check('./schema (marginal over full)', withSchema - full, 3200)
}

// 8.9 (D20, was 8.0 under D18): the full ./ai marginal includes the date
// engine (dateField) plus the plan-020 tool-boundary safety layer (warnings
// channel, bounds, requireNow, closed object schemas) and the adversarial-
// review fixes (tz-correct local-day date bounds, artifact-only float
// cleanup, schema-consistent quantity JSON) — measured 8.78 kB. Safety at
// the tool boundary is product, not bloat (D14 pattern). Quantity-only
// consumers tree-shake to ~1.9 kB (gate below).
// D24 (2026-07-05): +grade/repairToolCall/optional/toJSONSchema — DX helpers, product not bloat (D14/D17 pattern).
if (has('src/ai/index.ts')) {
  const withAi = await bundleStdin(
    `export * from './src/index.ts'; export * from './src/ai/index.ts'`,
  )
  // 10.3 (was 10.0): D35 — `rangeField({output:'range'})` returns full
  // QuantityRangeJSON and emits a detailed output JSON Schema; numeric output
  // keeps the old `{min,max}` shape and gets structured open-bound failures.
  // 10.4 (was 10.3): D48 — quantity/range fields map same-currency parse
  // success followed by cross-currency `.to()` into structured RATE_REQUIRED
  // issues instead of plain message failures.
  // 10.6 (was 10.4): D49 — new scientific kinds get specific quantityField
  // input examples so tool schemas remain self-explanatory.
  // 13.6 (was 10.8): D58 — /ai bundles the whole date module (dateField/
  // dateRangeField import parseDate/parseDateRange), so the plan-030 growth
  // cascades here; dateRangeField itself is a thin field over parseDateRange.
  // 13.9 (was 13.6): D59 — the date wire serializer cascades through the
  // bundled date module (see the ./date standalone note).
  // 14.9 (was 13.9): D62 — dateField/dateRangeField expose the locale-aware
  // DateOptions surface, so the date locale bridge cascades through /ai.
  check('./ai (marginal over full)', withAi - full, 14_900) // D30: +notation in shared renderNumber
  if (has('src/mcp/index.ts')) {
    const withMcp = await bundleStdin(
      `export * from './src/index.ts'; export * from './src/ai/index.ts'; export * from './src/mcp/index.ts'`,
    )
    // 0.22 (was 0.20): D35 — mcp re-exports the expanded /ai surface; the
    // measured marginal moved by two gzip bytes.
    check('./mcp (marginal over ./ai)', withMcp - withAi, 220) // plan 024 (2026-07-05): new entry
  }
  const withAiQty = await bundleStdin(
    `export * from './src/index.ts'; export { quantityField } from './src/ai/index.ts'`,
  )
  // 1.60 kept: D47 — concentration added one natural example string; the
  // molarity unit data remains in the main entry.
  // 1.60 (was 1.55): D46 — flow_rate added one natural example string for
  // tool descriptions; the parsing unit data remains in the main entry.
  // 1.55 (was 1.50): D43 — quantityField-only marginal nudged by the shared
  // unit-ref/type graph for the new built-in scientific kinds.
  // 1.7 (was 1.6): D48 — quantityField-only keeps the structured RATE_REQUIRED
  // failure path for currency fields.
  // 1.75 (was 1.7): D49 — quantityField-only carries specific examples for
  // advanced scientific field descriptions.
  check('./ai quantityField only (shakeable)', withAiQty - full, 1900)
}

console.table(rows)
if (failed) {
  console.error('\nSize budget exceeded (plan 001). Make it tree-shakeable or cut it.')
  process.exit(1)
}
