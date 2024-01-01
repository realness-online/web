import { to_hex } from '@/use/colors'
describe('#to_hex', () => {
  it('converts rgb to a hex', () => {
    expect(to_hex('rgb(199,223,14)')).toBe('#c7df0e')
    expect(to_hex('199,223,14')).toBe('#c7df0e')
    expect(to_hex(199, 223, 14)).toBe('#c7df0e')
    expect(() => to_hex(256, 223, 14)).toThrow(TypeError)
  })
})
