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
