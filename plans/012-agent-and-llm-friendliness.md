---
id: 012
title: Agent & LLM friendliness
status: done
created: 2026-07-03
updated: 2026-07-07
---

# Agent & LLM friendliness

Agents are first-class consumers: an LLM filling a form should be able to write
natural language into any lingo field and read back canonical values — and a
coding agent should be able to learn the whole API from one file.

## Library affordances

- **Deterministic**: explicit `now`, no locale sniffing, stable JSON output
  (`toJSON()` documented, flat versioned v3 shape
  `{ schemaVersion: 3, type, kind, value, unit, base, baseUnit, ... }` with
  self-describing `{ start, end, text }` spans — plan 025/D57; `fromJSON`
  accepts it). Same input+options = same output, forever within a major.
- **Machine-readable results**: discriminated unions; `issues[].code` stable;
  `confidence` numeric; `alternatives` enumerable — an agent can act on ambiguity
  instead of guessing.
- **Imperative DOM API**: `field.set('5\'11"')` + `field.value` — automation never
  needs to simulate keystrokes; hidden canonical input means scraping a form gives
  clean data.
- **`data-lingo` attributes** advertise fields to agents ("this input accepts natural
  language of kind length, canonical unit m") — browser agents can discover
  capabilities from the DOM alone.

## llms.txt

Ship `llms.txt` at repo root (and referenced from README): compressed API reference —
all functions with signatures, option tables, issue codes, 30 canonical examples of
input → JSON output, designed to fit in one model context comfortably (< 4k tokens).
Generated from TSDoc + corpus at release time (script), never hand-drifted.

## Docs for agent builders

README section "For agents": recipe for form-filling (set → commit → read
canonical), recipe for parsing user free text server-side (lingo() with kind
whitelist), recipe for validating LLM tool-call arguments (schema: pass strings
through parseQuantity instead of asking the model for floats — models are better at
"2 ft" than at 0.6096).
