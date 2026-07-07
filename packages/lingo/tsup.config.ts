import { defineConfig } from 'tsup'

const shared = {
  format: ['esm', 'cjs'] as const,
  dts: true,
  treeshake: true,
  target: 'es2020',
  external: ['react'],
}

// In watch mode (bun run dev) dist/ is never cleaned: the site consumes it
// through a live workspace link, and a mid-rebuild wipe would make imports
// resolve into a half-empty directory.
export default defineConfig((options) => [
  {
    ...shared,
    entry: {
      index: 'src/index.ts',
      'core/index': 'src/core/index.ts',
      'date/index': 'src/date/index.ts',
      'dom/index': 'src/dom/index.ts',
      'element/index': 'src/element/index.ts',
      'describe/index': 'src/describe/index.ts',
      'catalog/index': 'src/catalog/index.ts',
      'schema/index': 'src/schema/index.ts',
      'ai/index': 'src/ai/index.ts',
      'mcp/index': 'src/mcp/index.ts',
    },
    clean: !options.watch,
  },
  {
    ...shared,
    entry: {
      'react/index': 'src/react/index.ts',
    },
    clean: false,
    treeshake: false,
    banner: {
      js: "'use client';",
    },
  },
])
