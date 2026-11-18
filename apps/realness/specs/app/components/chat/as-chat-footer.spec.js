import { describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import AsChatFooter from '@/components/chat/as-chat-footer.vue'

const draw = (props = {}) => mount(AsChatFooter, { props })

describe('@/components/chat/as-chat-footer', () => {
  it('draws the plan and branch on the left, the parts on the right', () => {
    const footer = draw({
      plan: 'realness-one-network',
      branch: 'main',
      branch_level: 'warning',
      parts: [
        { text: 'opus', level: 'dim' },
        { text: 'wk 77%', level: 'warning' }
      ]
    })
    expect(footer.get('[data-plan]').text()).toBe('realness-one-network')
    expect(footer.get('[data-branch]').text()).toBe('(main)')
    expect(footer.get('[data-branch]').attributes('data-level')).toBe('warning')
    expect(footer.findAll('ul > li').map(part => part.text())).toEqual([
      'opus',
      'wk 77%'
    ])
    expect(footer.get('li[data-level="warning"]').text()).toBe('wk 77%')
  })

  it('draws no row with no plan, branch, or parts', () => {
    expect(draw().find('footer').exists()).toBe(false)
  })

  it('draws the branch alone when no plan is bound', () => {
    const footer = draw({ branch: 'main', branch_level: 'success' })
    expect(footer.find('[data-plan]').exists()).toBe(false)
    expect(footer.get('[data-branch]').text()).toBe('(main)')
  })
})
