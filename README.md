# lingo

**Make forms easier, LLM tools safer.**

People type `5'11"`, `1m80`, `twenty-five kg`, `1½ cups`, `next friday`. Models
emit `"12 lbs"`, `"3pm EST"`, `"1,234 kg"`. Your database wants canonical
values: one number in one unit, one ISO date. The library is the layer in between:
natural-language quantities, units, dates, and ranges parsed into validated
values, then humanized back. Zero dependencies; English-first parsing with
locale-aware formatting (locale packs are on the roadmap, plan 013).

**For the web.** Use one text field instead of a value box plus a unit dropdown:

- Accepts how people actually write: `5'11"`, `180cm`, `2 lb 3 oz`,
  `an hour and a half`, and fuzzy words (`it's hot`) where a field opts in.
- Validation UX ships as data: fields are never yelled at mid-typing (`2 f` is
  *incomplete*, not invalid), and every issue carries a stable code, a human
  message you can override, a span into the original input, and did-you-mean
  suggestions.
- No silent guesses: ambiguous input (`1,234`: 1.234 or 1234?) returns a
  deterministic best reading plus ranked alternatives and a warning; `confirm`
  strictness turns each assumption into a one-click confirmation.
- Two-way and tested: whatever `format()`/`humanize*()` emits re-parses to the
  same value. `1.9999 m` formats as `6′7″`, never `5′12″`.
- Headless DOM controller, `<lingo-input>` element, and React hook. No styles
  shipped, no framework lock-in, and parsing is microsecond-scale, fast enough
  to run on every keystroke.

**For LLMs.** Models are better at emitting `"5'11\""` than `1.8034`; the
`/ai` fields make the string the reliable path:

- Standard Schema fields (`quantityField`, `dateField`, `lingoObject`) drop
  into AI SDK tools, OpenAI/Anthropic/Gemini strict modes, LangChain, and MCP
  (`lingoTool()`). One field definition covers the provider wiring documented
  in the recipes.
- Tool-boundary defaults reject risky values: ambiguous numbers, ignored timezones,
  and clock-drifting relative dates fail loudly with `[CODE] ... Did you mean ...?`
  messages a model can self-correct from in one round trip.
- Measured on a 160-fixture recorded canonicalization corpus (not an LLM
  benchmark): naive `Number()`/`new Date()` coercion accepts 17.5% of it and
  is silently wrong on 6.3%; lingo accepts 96.9% with zero silent-wrongs.
- Deterministic and replayable: pass an explicit `now` and results are exactly
  reproducible. The `/ai` date field requires it for relative dates, so a
  queued or retried tool call never drifts across midnight.
- `repairToolCallWith`/`canonicalizeValues` fix malformed payloads client-side,
  with no extra model call.

One parser powers both sides. The same `lingoObject` can validate a model tool
call and a human form through Standard-Schema form resolvers (React Hook Form,
TanStack Form, ...).

This is the monorepo. **The library README with install, API tour, and recipes lives
with the package: [`packages/lingo`](packages/lingo/README.md).**

## Layout

| Path | What it is |
|------|------------|
| [`packages/lingo`](packages/lingo) | `@pascal-app/lingo`, the published library (src, tests, bench, size/corpus/zero-deps gates) |
| [`apps/site`](apps/site) | Docs site with live parser demos (Next.js, port 3000 or next free) |
| [`plans/`](plans/README.md) | Forward-looking specs, one numbered living markdown file per topic |
| [`wiki/`](wiki/README.md) | As-built docs: architecture, decisions, conventions, credits, research |
| [`AGENTS.md`](AGENTS.md) | Canonical agent guide (hard rules, workflow, module map) |
| [`CONTEXT.md`](CONTEXT.md) | Vocabulary glossary with canonical names and synonyms to avoid |

## Quick start

```sh
bun install
bun run check     # typecheck + tests + build + size budgets + corpus gate + zero-deps gate
```

Develop (library + site together):

```sh
bun dev           # tsup --watch on the library + site dev (port 3000, auto-increments)
bun kill          # stop all lingo dev processes (ports 3000-3003 + this repo's watchers)
bun restart       # kill + clear .next*/.turbo caches + bun dev
```

The site consumes the library as a live workspace link, so watch rebuilds show
up in the running site. (`cd apps/site && bun dev` still works for site-only
work; `bun run site:sync` refreshes served data files like llms.txt.)

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). The short version: `bun run check` must
be green, zero runtime dependencies is non-negotiable, specs in `plans/` are
living documents, and notable changes land in the CHANGELOG under `[Unreleased]`.

## License

MIT
