---
name: lingo
description: Parse natural-language quantities, units, dates, and ranges ("5'11\"", "1.5 cups", "72 in to cm", "three days ago", "between 5 and 10 kg", "it's hot") into canonical, validated values — and humanize them back. Use when building form inputs that accept measurements/units/dates, making LLM tool calls safe at the boundary (AI SDK / MCP), or converting and validating any human- or model-entered measurement string. Zero-dependency TypeScript, two-way (round-trips), deterministic.
metadata:
  author: pascalorg
  version: "1.0.0"
---

# lingo — natural-language quantities, units, dates & ranges

[`@pascal-app/lingo`](https://github.com/pascalorg/lingo) is a zero-dependency
TypeScript library that turns the strings people type and models emit —
`180cm`, `5ft 11`, `1.5 cups`, `90 min`, `next friday`, `1,5 kg`, `"5'11\""`,
`"twenty-five kg"`, `"3pm EST"` — into canonical, validated values (one number
in one unit, one ISO date), converts and range-checks them, then humanizes the
value back. Every result carries a stable issue code and a `[start, end)` span
into the original input. It's **two-way**: whatever `format()`/`humanize*()`
emits re-parses to the same value.

Tagline: **Make forms easier, LLM tools safer.**

## When to use this skill

Reach for lingo whenever a value arrives as free text and needs to become a
trustworthy stored value:

- **Web forms** — you're about to build a number box + unit dropdown. Use one
  text field instead: `180cm`, `2 lb 3 oz`, `an hour and a half`, typos with
  did-you-mean, fuzzy words (`it's hot`).
- **LLM tool / MCP boundaries** — a model returns `"5'11\""` or `"1,234 kg"` and
  your handler needs a safe number. Models emit strings more reliably than
  floats; lingo makes the string the safe path and rejects risky readings.
- **Data pipelines / imports** — normalizing messy measurement or date columns
  into canonical units without `Number()`/`new Date()` silently guessing wrong.
- **Anything that converts** (`72 in to cm`), **ranges** (`between 5 and 10 kg`,
  `under 10 minutes`, `10 ± 0.5 mm`), or **relative dates** (`three days ago`).

Do **not** reach for it for plain already-canonical numbers, or for currency
conversion needing live FX (lingo returns `RATE_REQUIRED` — you inject rates).

## Install & entry points

```sh
npm i @pascal-app/lingo   # or bun / pnpm / yarn — zero runtime deps
```

Import only what you need; each subpath is tree-shakeable.

| Entry | Use for |
|-------|---------|
| `@pascal-app/lingo` | core parse/convert: `lingo`, `parseQuantity`, `parseRange`, `convert` |
| `@pascal-app/lingo/date` | dates & durations: `parseDate`, `parseDuration`, `humanizeDate` |
| `@pascal-app/lingo/ai` | Standard Schema fields for LLM tools: `quantityField`, `dateField`, `lingoObject` |
| `@pascal-app/lingo/mcp` | `lingoTool()` — MCP tool with validation before the handler |
| `@pascal-app/lingo/dom` | headless `lingoInput()` controller for any `<input>` |
| `@pascal-app/lingo/react` | `useLingoInput()` hook |
| `@pascal-app/lingo/element` | `<lingo-input>` form-associated custom element |
| `@pascal-app/lingo/complete` | ranked autocomplete `completions()` |
| `@pascal-app/lingo/locales/{en,en-gb,es,fr,pt,zh,ja}` | opt-in parsing language packs |
| `@pascal-app/lingo/catalog` | query units/kinds/currencies |

## Pattern 1 — parse, validate, convert (core)

```ts
import { lingo, parseQuantity, parseRange } from "@pascal-app/lingo"

const height = parseQuantity("5'11\"", { kind: "length" })
if (height.ok) height.quantity.to("m").value // 1.8034

lingo("72 in to cm")               // { type: "conversion", converted: 182.88 cm }
parseRange("between 5 and 10 kg", { kind: "mass" }) // range 5..10 kg
```

`lingo(text, opts?)` returns a versioned union on `.type`
(`quantity | range | conversion | number | failure`), serialized as flat v3 JSON
(`{ schemaVersion: 3, ok, type, ...value, text, span, issues, confidence }`).
Always branch on `.ok` / `.type` before reading the value, and surface
`.issues[]` (each has `code`, `severity`, `message`, `span`) to the user.

Pass context to disambiguate: `{ kind, unit, currency, locale, system, strictness }`.
`strictness: "confirm"` turns each assumption (typo fix, ambiguous number) into a
failure carrying a `candidate`, so you can render a one-click confirmation.

## Pattern 2 — a natural-language form field

Headless controller — no styles shipped, canonicalizes on blur/Enter/submit,
never rewrites while the user is mid-type (`2 f` is *incomplete*, not *invalid*):

```ts
import { lingoInput } from "@pascal-app/lingo/dom"

const field = lingoInput(document.querySelector("#height"), {
  kind: "length", unit: "m", name: "height_m",
})
field.set("6ft")
field.commit() // hidden <input name="height_m"> submits the canonical value
// field.state → 'idle' | 'incomplete' | 'valid' | 'invalid'
```

React: `useLingoInput(opts)` from `@pascal-app/lingo/react`. Framework-agnostic
element: `defineLingoInput()` then `<lingo-input kind="length" unit="m" name="height_m">`.

## Pattern 3 — safe LLM tool / MCP boundary

The fields expose a **`string`** input JSON Schema (models are better at emitting
`"5'11\""` than `1.8034`) and hand your handler the **canonical** value. Risky
readings fail loudly with `[CODE] … Did you mean …?` messages a model can
self-correct from in one round trip.

```ts
import { tool, generateText } from "ai"
import { lingoObject, quantityField, dateField } from "@pascal-app/lingo/ai"

const shipment = lingoObject({
  weight: quantityField({ kind: "mass", unit: "kg", min: 0, max: 500 }),
  deliverBy: dateField({ now: new Date() }),   // relative dates REQUIRE now
})

await generateText({
  model: "claude-opus-4-8",
  tools: { create_shipment: tool({ inputSchema: shipment, execute: run }) },
})
```

MCP: wrap the same fields with `lingoTool({ name, description, input, handler })`
from `@pascal-app/lingo/mcp`; validation runs before `handler`, and failures
return `{ isError: true }` with `[CODE]`-prefixed text.

## Rules that keep you out of trouble

1. **Keep measurements as strings in tool/form schemas.** Let lingo convert,
   validate, surface spans, and handle ambiguity — don't ask the model or user
   for a float.
2. **Store the canonical value, display the humanized one.** `format()` /
   `humanizeDate()` round-trip back to the same value (`1.9999 m` → `6′7″`,
   never `5′12″`).
3. **Always pass an explicit `now`** to `parseDate`/`dateField` for relative
   dates — never rely on `Date.now()`, so a queued or retried call can't drift
   across midnight. Reference-dependent input without `now` → `NOW_REQUIRED`.
4. **No silent guesses.** Ambiguous input returns a deterministic best reading
   plus ranked `alternatives`/`candidate` and a warning code — show it, or use
   `strictness: "confirm"` / `"strict"` to force confirmation.
5. **Currency conversion needs injected rates** — `5 EUR to USD` returns
   `RATE_REQUIRED`; call `convertCurrency` with your own rates.
6. **Locale packs are opt-in.** English is built in; for other languages
   `createLingo({ locales: [es, fr, …] })` or you'll get `LOCALE_NOT_LOADED`.

Common issue codes to handle: `UNKNOWN_UNIT`, `KIND_MISMATCH`, `UNIT_REQUIRED`,
`AMBIGUOUS_NUMBER`, `AMBIGUOUS_UNIT`, `TYPO_CORRECTED`, `RANGE_MIN`/`RANGE_MAX`,
`NOW_REQUIRED`, `TZ_IGNORED`, `RATE_REQUIRED`. Override any message via the
`messages` option.

## Full reference

This skill is the on-ramp; the exhaustive API, the complete kind/unit list, all
issue codes, and per-input examples live in the agent docs:

- **Offline** (after install): `node_modules/@pascal-app/lingo/llms.txt` — a
  compressed, self-contained reference.
- **Online:** [`lingo.pascal.app/llms.txt`](https://lingo.pascal.app/llms.txt)
  (index) → [`/docs/<section>.md`](https://lingo.pascal.app/docs/parse.md)
  per-topic, or [`/llms-full.txt`](https://lingo.pascal.app/llms-full.txt) for
  the complete narrative. Human docs with live demos:
  [`lingo.pascal.app/docs`](https://lingo.pascal.app/docs).
- **Repo & README:** [github.com/pascalorg/lingo](https://github.com/pascalorg/lingo).
