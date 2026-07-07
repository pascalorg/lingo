---
name: Bug report
about: A parse, conversion, format, or validation result that is wrong
labels: bug
---

## Input and options

```ts
import { lingo } from '@pascal-app/lingo'
lingo('...', { /* options */ })
```

## Expected

What you expected the result (or issue codes) to be.

## Actual

The actual result. `JSON.stringify(result)` output is ideal — it carries the
schema version, spans, and issue codes.

## Environment

- `@pascal-app/lingo` version:
- Runtime (Node/bun/browser + version):
