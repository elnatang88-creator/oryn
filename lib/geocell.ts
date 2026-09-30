/**
 * Coarse area cells (standard geohash). The phone turns its position into a 7-character cell (~153 m × 153 m)
 * BEFORE anything is sent, so ORYN's servers never receive coordinates. Two people are "nearby" when their
 * cells are the same or adjacent.
 */
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
export const CELL_PRECISION = 7
export const isCell = (v: unknown): v is string => typeof v === 'string' && new RegExp(`^[${BASE32}]{${CELL_PRECISION}}$`).test(v)

export function encodeCell(lat: number, lon: number, precision = CELL_PRECISION) {
  const latR = [-90, 90], lonR = [-180, 180]
  let out = '', bit = 0, ch = 0, even = true
  while (out.length < precision) {
    const r = even ? lonR : latR, v = even ? lon : lat, mid = (r[0] + r[1]) / 2
    if (v >= mid) { ch = (ch << 1) | 1; r[0] = mid } else { ch = ch << 1; r[1] = mid }
    even = !even
    if (++bit === 5) { out += BASE32[ch]; bit = 0; ch = 0 }
  }
  return out
}

export function decodeCell(cell: string) {
  const latR = [-90, 90], lonR = [-180, 180]
  let even = true
  for (const c of cell) {
    const n = BASE32.indexOf(c)
    for (let i = 4; i >= 0; i--) {
      const r = even ? lonR : latR, mid = (r[0] + r[1]) / 2
      if ((n >> i) & 1) r[0] = mid; else r[1] = mid
      even = !even
    }
  }
  return { lat: (latR[0] + latR[1]) / 2, lon: (lonR[0] + lonR[1]) / 2, dLat: latR[1] - latR[0], dLon: lonR[1] - lonR[0] }
}

/** The cell and its 8 neighbours. */
export function cellAndNeighbours(cell: string) {
  const { lat, lon, dLat, dLon } = decodeCell(cell)
  const out = new Set<string>()
  for (const a of [-1, 0, 1]) for (const b of [-1, 0, 1]) {
    const la = Math.max(-89.999999, Math.min(89.999999, lat + a * dLat))
    let lo = lon + b * dLon
    if (lo >= 180) lo -= 360
    if (lo < -180) lo += 360
    out.add(encodeCell(la, lo, cell.length))
  }
  return [...out]
}
