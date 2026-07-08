---
id: 032
title: Input calculations (quantity arithmetic)
status: draft
created: 2026-07-08
updated: 2026-07-08
goal: "Decide whether (and how) lingo evaluates arithmetic typed into fields — '2+3 kg', '10% off 50', '2 * 1h30' — without becoming a CAS or busting budgets."
success_criteria:
  - "Go/no-go decision recorded as a D-entry -> wiki/decisions.md"
  - "If go: expression grammar spec'd here with locked node union and corpus rows -> this plan + tests/corpus"
---

# Input calculations (quantity arithmetic)

Driver: owner request 2026-07-08 — users type light math into quantity fields
("2+3 kg", "half of 10 L", "10% off $50") and expect the field (and
autocomplete) to resolve it. Prior art to evaluate:
[mathjs expression trees](https://mathjs.org/docs/expressions/expression_trees.html).

## Design principle

**Calculator, not CAS.** Evaluate a closed, tiny arithmetic surface over
already-parsed same-kind quantities. No symbols, no variables, no dimensional
algebra (D2 stands; kg·m/s² stays out of scope), no assignment, no functions.
If an expression needs a scope object, it's out of scope.

## Prior-art evaluation: mathjs expression trees (studied 2026-07-08)

What mathjs does: `math.parse(expr)` → typed node AST (`ConstantNode`,
`OperatorNode`, `SymbolNode`, `FunctionNode`, …), each node supporting
`evaluate(scope)`, `transform`, `traverse`, `toString`. Powerful and general —
and exactly the shape we must NOT ship wholesale:

- **Take:** the small typed node union as the internal representation
  (`value | quantity | op(+,-,*,/) | percent-of | paren`), the
  parse-then-evaluate split (grammar produces a tree; evaluation is a separate
  pure fold), and `toString` discipline (canonical emission that re-parses —
  maps to our two-way guarantee).
- **Reject:** symbols/scopes, function nodes, matrices/objects/ranges as
  expression citizens, `compile()` codegen, implicit multiplication. mathjs is
  ~500 kB+; our entire full bundle budget is 33 kB. Zero-deps rule means this
  is a study, never a dependency.
- **Hazards mathjs itself documents:** temperature arithmetic footguns
  (°C/°F sums are wrong under affine units — we already split
  `convert`/`convertDelta`; expression eval must refuse or delta-convert
  affine-unit arithmetic), case traps (`C`=coulomb), unit-symbol collisions
  with operator tokens (`in` reads as inches, `-` is both minus and a range
  separator).

## Candidate scope (not locked)

| Expression | Result | Notes |
|---|---|---|
| `2+3 kg` | 5 kg | bare left side inherits unit (matches range policy) |
| `2 kg + 500 g` | 2.5 kg | same-kind, unit-mixed sum |
| `2 * 1h30` | 3 h | scalar × quantity |
| `10 L / 4` | 2.5 L | quantity ÷ scalar |
| `10% off $50` | $45.00 | percent-of family, incl. `off` / `of` |
| `half of 10 L` | 5 L | word multipliers reuse the number-word lexicon |
| `5 kg + 3 m` | KIND_MISMATCH | never cross-kind |
| `20°C + 5°C` | refuse or delta (decide) | affine-unit hazard |

Grammar collision to resolve first: `-` and `to` already mean *range*
(`5-10 kg`), and `x` could mean multiplication or a typo. Proposal: ranges win
every ambiguous read; arithmetic requires an unambiguous operator context
(`+`, `*`, `/`, `% off`) — subtraction may need to be excluded or
parenthesized-only, which is fine for form inputs.

## Where it would land

- New entry (`@pascal-app/lingo/calc` or folded into `./complete` fan-out as a
  `'calc'` completion source) — NOT the main entry; main budget stays flat.
- Autocomplete integration: `completions('2+3 kg')` → `5 kg` ranked first with
  the expression tree attached for UI explanation.
- Spans: every node carries `[start, end)` offsets like every other result
  (hard rule 3); issues point at the offending operand.

## Non-goals

- Dimensional algebra / compound-dimension arithmetic (D2, vision plan).
- Variables, scopes, functions, matrices, multi-statement blocks.
- Shipping or depending on mathjs.

## Open questions

- Go/no-go at all — is a calculator inside a form field a feature or a trap?
  Needs owner call + a D-entry either way.
- Affine-unit arithmetic policy (refuse vs delta-convert).
- Subtraction vs range `-`: excluded, parenthesized-only, or space-sensitive.
- Entry placement and budget (new `./calc` vs `./complete` growth).

## Acceptance

Decision D-entry exists. If go: grammar locked here, corpus rows added
(ADDITIVE), size budget assigned in `size.mjs`, two-way tests for every
emitted result.
