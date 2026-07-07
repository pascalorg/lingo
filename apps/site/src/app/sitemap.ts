import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://lingo.pascal.app/',
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: 'https://lingo.pascal.app/docs',
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ]
}
