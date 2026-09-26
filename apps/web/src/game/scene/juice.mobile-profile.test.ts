import { describe, expect, it } from 'vitest'
import { isMobileProfile } from './juice'

describe('mobile display profile', () => {
  it('uses narrow viewports as mobile', () => {
    expect(isMobileProfile(699, false)).toBe(true)
    expect(isMobileProfile(700, false)).toBe(false)
  })

  it('uses coarse pointers only below the desktop breakpoint', () => {
    expect(isMobileProfile(1023, true)).toBe(true)
    expect(isMobileProfile(1024, true)).toBe(false)
    expect(isMobileProfile(1280, true)).toBe(false)
  })
})
