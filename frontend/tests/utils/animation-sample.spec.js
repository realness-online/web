import {
  sample_smil,
  resting_value,
  spline_ease
} from '@/utils/animation-sample'

const as_leaf = attributes => {
  const leaf = document.createElementNS('http://www.w3.org/2000/svg', 'animate')
  Object.entries(attributes).forEach(([name, value]) =>
    leaf.setAttribute(name, value)
  )
  return leaf
}

describe('@/utils/animation-sample', () => {
  describe('#spline_ease', () => {
    it('holds the ends still', () => {
      expect(spline_ease(0, '0.42 0 1 1')).toBeCloseTo(0)
      expect(spline_ease(1, '0.42 0 1 1')).toBeCloseTo(1)
    })

    it('reads linear when the spline is the diagonal', () => {
      expect(spline_ease(0.25, '0.25 0.25 0.75 0.75')).toBeCloseTo(0.25, 3)
    })

    it('lags behind linear on an ease-in', () => {
      expect(spline_ease(0.5, '0.42 0 1 1')).toBeLessThan(0.5)
    })
  })

  describe('#resting_value', () => {
    it('reads the value every cycle opens and closes on', () => {
      expect(resting_value(as_leaf({ values: '0.5;0.1;0.5;' }))).toBe('0.5')
    })
  })

  describe('#sample_smil', () => {
    it('sits on the resting value at the top of a cycle', () => {
      const leaf = as_leaf({ dur: '18s', values: '0;-24;0' })
      expect(sample_smil(leaf, 0)).toBe('0')
      expect(sample_smil(leaf, 18)).toBe('0')
    })

    it('reads the far value halfway through', () => {
      const leaf = as_leaf({ dur: '18s', values: '0;-24;0' })
      expect(parseFloat(sample_smil(leaf, 9))).toBeCloseTo(-24)
    })

    it('lands between the keyframes it is between', () => {
      const leaf = as_leaf({ dur: '18s', values: '0;-24;0' })
      const quarter = parseFloat(sample_smil(leaf, 4.5))
      expect(quarter).toBeLessThan(0)
      expect(quarter).toBeGreaterThan(-24)
    })

    it('keeps the unit a percentage value carries', () => {
      const leaf = as_leaf({ dur: '68s', values: '0%;150%;0%' })
      expect(sample_smil(leaf, 17)).toMatch(/%$/)
    })

    it('honors keyTimes rather than assuming even spacing', () => {
      const leaf = as_leaf({
        dur: '10s',
        values: '0;10;0',
        keyTimes: '0;0.9;1'
      })
      // 4.5s is halfway to the 9s peak, not past it
      expect(parseFloat(sample_smil(leaf, 4.5))).toBeCloseTo(5)
    })

    it('eases with the keySplines the running animation uses', () => {
      const eased = as_leaf({
        dur: '10s',
        values: '0;10',
        keyTimes: '0;1',
        keySplines: '0.42 0 1 1'
      })
      const linear = as_leaf({ dur: '10s', values: '0;10', keyTimes: '0;1' })
      expect(parseFloat(sample_smil(eased, 5))).toBeLessThan(
        parseFloat(sample_smil(linear, 5))
      )
    })
  })
})
