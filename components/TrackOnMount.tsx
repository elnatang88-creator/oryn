'use client'

import { useEffect } from 'react'
import { trackClient } from '@/lib/track-client'
import type { ClientEvent } from '@/lib/analytics-events'

/** Records one screen-level event when a screen opens. */
export function TrackOnMount({ name, props }: { name: ClientEvent; props?: Record<string, string | number | undefined> }) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { trackClient(name, props) }, [])
  return null
}
