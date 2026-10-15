import type { MetadataRoute } from 'next'
import { BRAND, BRAND_TAGLINE } from '@/lib/brand'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND, short_name: BRAND, description: BRAND_TAGLINE, start_url: '/welcome', display: 'standalone',
    background_color: '#07132B', theme_color: '#07132B',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/brand/oryn-mark.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    shortcuts: [
      { name: 'Present my card', short_name: 'Present', description: 'Show your card full screen — works offline once opened', url: '/share/quick?then=present' },
      { name: 'Nearby', url: '/share/nearby' },
      { name: 'Share now', short_name: 'Share', url: '/share/quick?via=shortcut' },
      { name: 'Today', url: '/today' },
    ],
  }
}
