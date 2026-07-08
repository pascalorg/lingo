import type { MetadataRoute } from 'next'

import { markdownSectionIds } from '@/lib/docs.md'

const SITE = 'https://lingo.pascal.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const sectionEntries = markdownSectionIds.map((id) => ({
    url: `${SITE}/docs/${id}.md`,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  return [
    {
      url: `${SITE}/`,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE}/docs`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE}/llms.txt`,
      changeFrequency: 'weekly',
      priority: 0.95,
    },
    {
      url: `${SITE}/llms-full.txt`,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${SITE}/llms.md`,
      changeFrequency: 'weekly',
      priority: 0.85,
    },
    {
      url: `${SITE}/llms-small.txt`,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...sectionEntries,
  ]
}
