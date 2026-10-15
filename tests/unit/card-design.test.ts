import { describe, expect, it } from 'vitest'
import { makeUser, fields } from './helpers'
import { createCapsule, getCapsule, updateCapsule } from '@/lib/server/services/capsules'
import { startShare, resolveShare } from '@/lib/server/services/sharing'
import { designVars, normalizeDesign, DEFAULT_DESIGN } from '@/lib/card-design'

describe('card design', () => {
  it('is saved per capsule and reaches the recipient, without exposing private data', async () => {
    const u = await makeUser('free', 'Noa Adler')
    const design = { material: 'pearl', foil: 'rosegold', finish: 'holo', font: 'editorial', layout: 'signature', base: '#123456', back: 'brand' }
    const id = await createCapsule(u.id, { name: 'C', mode: 'professional', display_name: 'Noa Adler', fields: fields(), private_note: 'SECRET', design })
    const { capsule } = await getCapsule(u.id, id)
    expect(capsule.design).toEqual(design)
    const share = await startShare(u.id, { capsuleId: id })
    const r = await resolveShare(share.token)
    if (r.status !== 'ok') throw new Error('ok expected')
    expect(r.view.design).toEqual(design)
    expect(JSON.stringify(r.view)).not.toContain('SECRET')
    expect(JSON.stringify(r.view)).not.toContain('555 010 9999')
    // Editing the design applies to links already shared.
    await updateCapsule(u.id, id, { ...capsule, accent: 'blue', design: { ...design, material: 'obsidian' } })
    const again = await resolveShare(share.token)
    expect(again.status === 'ok' && again.view.design.material).toBe('obsidian')
  })

  it('defaults sensibly and refuses unknown values', async () => {
    const u = await makeUser('free', 'Default')
    const id = await createCapsule(u.id, { name: 'D', mode: 'professional', display_name: 'D' })
    expect((await getCapsule(u.id, id)).capsule.design).toEqual(DEFAULT_DESIGN)
    const u2 = await makeUser('pro', 'Bad')
    await expect(createCapsule(u2.id, { name: 'X', mode: 'custom', display_name: 'X', design: { ...DEFAULT_DESIGN, material: 'gold-plated-unicorn' } })).rejects.toThrow('card design')
    await expect(createCapsule(u2.id, { name: 'Y', mode: 'custom', display_name: 'Y', design: { ...DEFAULT_DESIGN, base: 'red;background:url(https://evil.example/x)' } })).rejects.toThrow('card design')
  })

  it('never lets stored data inject CSS: values come only from fixed tables or a strict hex colour', () => {
    const d = normalizeDesign({ material: 'custom', base: '#fff;}body{display:none', foil: '</style>', layout: 'x' })
    expect(d.base).toBe(DEFAULT_DESIGN.base)
    expect(d.foil).toBe(DEFAULT_DESIGN.foil)
    const css = Object.values(designVars({ ...d, base: '#abcdef' })).join(' ')
    expect(css).not.toMatch(/<|;\s*}|javascript:|https?:/i)
  })
})

describe('collections and card lifecycle', () => {
  it('every collection resolves to a valid design and a wallet colour set', async () => {
    const { PRESETS, MATERIALS, normalizeDesign: norm, designVars: vars } = await import('@/lib/card-design')
    const { walletColors } = await import('@/lib/server/wallet')
    expect(PRESETS.map((p) => p.id)).toEqual(['obsidian', 'platinum', 'titanium', 'midnight', 'gold', 'white', 'custom'])
    for (const p of PRESETS) {
      const d = norm({ ...p.design, base: '#112233', back: 'qr' })
      expect(d.material).toBe(p.design.material)
      expect(vars(d)['--mat']).toBeTruthy()
      expect(walletColors(d).background).toMatch(/^#[0-9a-f]{6}$/i)
    }
    for (const m of MATERIALS) expect(walletColors(norm({ material: m, base: '#445566' })).foreground).toMatch(/^#/)
  })

  it('duplicate makes an independent copy (design, fields, policy, private note), never the active card', async () => {
    const { duplicateCapsule, listCapsules, setDefaultCapsule } = await import('@/lib/server/services/capsules')
    const u = await makeUser('pro', 'Dup Person')
    const id = await createCapsule(u.id, { name: 'Original', mode: 'professional', display_name: 'Dup Person', fields: fields(), private_note: 'keep', design: { ...DEFAULT_DESIGN, material: 'gold' } })
    const copy = await duplicateCapsule(u.id, id)
    const { capsule: c } = await getCapsule(u.id, copy)
    expect(c.name).toBe('Original copy'); expect(c.is_default).toBe(false); expect(c.design.material).toBe('gold'); expect(c.fields).toHaveLength(4); expect(c.private_note).toBe('keep')
    await updateCapsule(u.id, copy, { ...c, name: 'Changed', design: { ...c.design, material: 'white' } })
    expect((await getCapsule(u.id, id)).capsule.design.material).toBe('gold')
    await setDefaultCapsule(u.id, copy)
    expect((await listCapsules(u.id)).find((x) => x.id === copy)!.is_default).toBe(true)
    const stranger = await makeUser('pro', 'Stranger')
    await expect(duplicateCapsule(stranger.id, id)).rejects.toThrow()
  })
})
