import rbg_to_hex from '@/use/rgb-to-hex'

describe('#rgb_to_hex', () => {
  it('converts rgb to a hex', () => {
    expect(rbg_to_hex('rgb(199,223,14)')).toBe('#c7df0e')
    expect(rbg_to_hex('199,223,14')).toBe('#c7df0e')
    expect(rbg_to_hex(199, 223, 14)).toBe('#c7df0e')
    expect(() => rbg_to_hex(256, 223, 14)).toThrow(TypeError)
  })
})
