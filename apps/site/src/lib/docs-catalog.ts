export interface DocsNavItem {
  depth?: 2 | 3
  description: string
  href: string
  id: string
  keywords: string[]
  markdownSectionId?: string
  title: string
}

export interface DocsNavGroup {
  items: DocsNavItem[]
  label: string
  // One-line group subtitle rendered under the label. Encodes the product
  // thesis in the sidebar ("make forms easier" / "make LLM tools safer").
  subtitle?: string
}

function page(
  id: string,
  title: string,
  description: string,
  keywords: string[],
  options: {
    depth?: 2 | 3
    markdownSectionId?: string
  } = {},
): DocsNavItem {
  return {
    id,
    title,
    href: `/docs#${id}`,
    description,
    keywords,
    ...options,
  }
}

export const docsNavGroups: DocsNavGroup[] = [
  {
    label: 'Start',
    items: [
      page('introduction', 'Introduction', 'What lingo is for and where to start.', [
        'overview',
        'human input',
        'llm tools',
        'spans',
        'two-way',
      ]),
      page('installation', 'Install', 'Install the package and pick an entry.', [
        'install',
        'npm',
        'pnpm',
        'entries',
        'zero dependencies',
      ]),
      page('parse', 'Parse', 'Turn text into a canonical, validated value.', [
        'parse',
        'quantity',
        'range',
        'conversion',
        'number',
        'canonical',
        'json',
        'confidence',
        'ambiguity',
        'alternatives',
      ]),
      page(
        'parse-find',
        'Find values in text',
        'Scan free text for quantities with spans.',
        ['findQuantities', 'scan', 'extract', 'span'],
        { depth: 3, markdownSectionId: 'parse' },
      ),
      page(
        'parse-completions',
        'Autocomplete anything',
        'Ranked completions for every plausible canonical reading.',
        ['completions', 'autocomplete', 'suggestions', 'prefix', 'ranked'],
        { depth: 3, markdownSectionId: 'parse' },
      ),
      page(
        'strictness',
        'Strictness',
        'Forgiving, confirm, or strict — plus accept, tolerance, escalate.',
        ['forgiving', 'confirm', 'strict', 'candidate', 'accept', 'tolerance', 'escalate'],
      ),
    ],
  },
  {
    label: 'Forms',
    subtitle: 'Make forms easier',
    items: [
      page('forms', 'Inputs', 'Turn any input into a natural-language field.', [
        'dom',
        'react',
        'input',
        'field',
        'validation',
        'hidden input',
        'partial state',
        'lingo-input',
        'web component',
        'element',
      ]),
      page(
        'forms-element',
        'Web component',
        'The framework-free <lingo-input> custom element.',
        ['lingo-input', 'web component', 'element', 'defineLingoInput', 'vue', 'svelte', 'angular'],
        { depth: 3, markdownSectionId: 'forms' },
      ),
      page(
        'forms-range-slider',
        'Two-way slider',
        'Text parses to thumbs; thumbs humanize back to text.',
        ['slider', 'range', 'keyboard', 'mass', 'two-way'],
        { depth: 3, markdownSectionId: 'forms' },
      ),
      page(
        'integrations',
        'Frameworks',
        'One field across React Hook Form, TanStack, Vue, and more.',
        [
          'react-hook-form',
          'tanstack',
          'formik',
          'shadcn',
          'vue',
          'angular',
          'svelte',
          'vanilla',
          'next',
          'server action',
        ],
      ),
      page('forms-ux', 'Unit fields', 'Collapse one value plus one unit picker into one field.', [
        'unit dropdown',
        'form ux',
        'height',
        'weight',
        'currency',
        'recipes',
        'engineering',
        'force',
        'torque',
        'fitness',
        'medical',
      ]),
      page(
        'forms-ux-examples',
        'Before and after',
        'Finance, recipes, engineering, fitness, and medical forms.',
        ['finance', 'recipes', 'engineering', 'fitness', 'medical', 'unit dropdown'],
        { depth: 3, markdownSectionId: 'forms-ux' },
      ),
    ],
  },
  {
    label: 'AI & agents',
    subtitle: 'Make LLM tools safer',
    items: [
      page('for-ai', 'Tool fields', 'Validate model-emitted values at the tool boundary.', [
        'ai',
        'ai sdk',
        'llm',
        'openai',
        'anthropic',
        'gemini',
        'langchain',
        'structured output',
        'tool call',
        'canonicalize',
        'repair',
        'evals',
        'toJSONSchema',
        'lingoObject',
      ]),
      page(
        'for-ai-stack',
        'Providers',
        'Provider and framework surfaces that accept lingo schemas.',
        ['ai sdk', 'openai', 'anthropic', 'gemini', 'langchain', 'standard schema'],
        { depth: 3, markdownSectionId: 'for-ai' },
      ),
      page(
        'for-ai-workflows',
        'Workflows',
        'Tool calls, repair, data collection, evals, and computer use.',
        [
          'tool calls',
          'repair',
          'canonicalizeValues',
          'quantityMatch',
          'dateMatch',
          'computer use',
        ],
        { depth: 3, markdownSectionId: 'for-ai' },
      ),
      page('mcp', 'MCP tools', 'Turn a field shape into a full MCP tool descriptor.', [
        'mcp',
        'lingoTool',
        'registerTool',
        'model context protocol',
        'inputSchema',
        'isError',
      ]),
      page('one-schema', 'One schema', 'One lingoObject for a tool argument and a human form.', [
        'standard schema',
        'lingoObject',
        'forms',
        'ai',
        'react-hook-form',
        'tool',
        'bridge',
      ]),
    ],
  },
  {
    label: 'Values & units',
    subtitle: 'The engine',
    items: [
      page('convert', 'Convert & format', 'Convert between units and render values back.', [
        'convert',
        'tryConvert',
        'convertDelta',
        'format',
        'toBest',
        'compound',
        'best fit',
        'delta',
      ]),
      page('currency', 'Currency', 'Parse symbols and codes; convert with your own rates.', [
        'currency',
        'usd',
        'eur',
        'gbp',
        'fromMinor',
        'toMinor',
        'convertCurrency',
        'rates',
        'stripe',
      ]),
      page('dates', 'Dates & durations', 'Relative dates against an explicit now, two-way.', [
        'date',
        'duration',
        'relative',
        'now',
        'humanize',
        'grain',
        'parseDate',
        'parseDuration',
        'time',
        'timezone',
        'zone',
        'applyZone',
        'time slot',
        'range',
        'parseDateRange',
        'humanizeDateRange',
      ]),
      page('locales', 'Locales', 'Load tree-shakeable language packs for parsing.', [
        'locale',
        'i18n',
        'language',
        'spanish',
        'french',
        'portuguese',
        'chinese',
        'japanese',
        'en-gb',
        'createLingo',
      ]),
      page('coverage', 'Catalog', 'Browse kinds, units, aliases, and fuzzy vocab.', [
        'catalog',
        'units',
        'kinds',
        'aliases',
        'fuzzy',
        'coverage',
      ]),
      page(
        'coverage-aliases',
        'Aliases',
        'Unit aliases normalize to canonical bases.',
        ['alias', 'unicode', 'compound'],
        { depth: 3, markdownSectionId: 'coverage' },
      ),
      page(
        'coverage-fuzzy',
        'Fuzzy bands',
        'Words like hot and freezing become ranges.',
        ['fuzzy', 'temperature', 'vocabulary', 'profile'],
        { depth: 3, markdownSectionId: 'coverage' },
      ),
      page(
        'coverage-dates',
        'Date shorthand',
        'Relative dates parse against an explicit now.',
        ['date', 'relative', 'now', 'shorthand'],
        { depth: 3, markdownSectionId: 'coverage' },
      ),
      page(
        'coverage-time-slots',
        'Time slots',
        'Time ranges like 2pm to 4pm and 9-5 parse to start/end.',
        ['time', 'slot', 'range', 'timezone', 'parseDateRange'],
        { depth: 3, markdownSectionId: 'coverage' },
      ),
    ],
  },
  {
    label: 'Reference',
    items: [
      page('performance', 'Performance', 'Read local benchmark results in product terms.', [
        'benchmark',
        'speed',
        'corpus',
      ]),
      page('extend', 'Extend', 'Custom kinds and units, instances, core, and message packs.', [
        'registerKind',
        'registerUnits',
        'defineFuzzyVocab',
        'createLingo',
        'instance',
        'core',
        'message pack',
        'i18n',
      ]),
      page(
        'resource-views',
        'Resource views',
        'Self-explaining output for logs, docs, and tools.',
        ['describe', 'describeResource', 'describeResult', 'resource', 'logs', 'tool output'],
      ),
      page('api', 'API', 'Functions, options, issue codes, and type safety.', [
        'reference',
        'options',
        'issues',
        'exports',
        'entries',
        'types',
      ]),
      page(
        'api-core',
        'Core functions',
        'The public parsing and conversion exports.',
        ['lingo', 'parseQuantity', 'parseRange', 'convert'],
        { depth: 3, markdownSectionId: 'api' },
      ),
      page(
        'api-options',
        'Options',
        'Parse and field option knobs.',
        ['kind', 'unit', 'strictness', 'accept'],
        { depth: 3, markdownSectionId: 'api' },
      ),
      page(
        'api-schema',
        'Data schemas',
        'Canonical wire shapes: result, quantity, range, issue, span.',
        [
          'schema',
          'json',
          'result',
          'quantity',
          'range',
          'issue',
          'span',
          'toJSON',
          'schemaVersion',
        ],
        { depth: 3, markdownSectionId: 'api' },
      ),
      page(
        'api-issues',
        'Issue codes',
        'Machine-readable parser issue codes.',
        ['EMPTY', 'UNKNOWN_UNIT', 'AMBIGUOUS_NUMBER', 'TZ_IGNORED'],
        { depth: 3, markdownSectionId: 'api' },
      ),
      page(
        'api-types',
        'Type safety',
        'Literal-typed unit refs catch cross-kind mistakes at compile time.',
        ['typescript', 'unit ref', 'literal', 'compile', 'KindOfUnit'],
        { depth: 3, markdownSectionId: 'api' },
      ),
    ],
  },
]

export const docsPages = docsNavGroups.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.label })),
)

export const docsTopLevelPages = docsPages.filter((item) => !item.depth)

export const docsSearchIndex = docsPages.map((item) => ({
  ...item,
  searchableText: [item.title, item.description, item.group, ...item.keywords]
    .join(' ')
    .toLowerCase(),
}))

export function getDocsPage(id: string) {
  return docsPages.find((item) => item.id === id)
}

export function getMarkdownSectionId(id: string) {
  return getDocsPage(id)?.markdownSectionId ?? id
}
