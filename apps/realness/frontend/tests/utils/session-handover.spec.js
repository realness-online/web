import { describe, expect, it, vi } from 'vite-plus/test'
import { create_handover, needs_actor } from '@/utils/session-handover'

describe('session handover', () => {
  const missing_bash = {
    kind: 'pi.toolResult',
    model: [
      {
        role: 'toolResult',
        toolName: 'bash',
        isError: true,
        content: [
          { type: 'text', text: 'No execution environment is configured' }
        ]
      }
    ]
  }

  it('detects a committed bash request after live tool slots have disappeared', () => {
    expect(
      needs_actor({
        entries: [{ kind: 'pi.user' }, missing_bash],
        docs: { 'pi.live': {} }
      })
    ).toBe(true)
  })

  it('does not repeat an earlier turn handover or treat command failure as missing compute', () => {
    expect(needs_actor({ entries: [missing_bash, { kind: 'pi.user' }] })).toBe(
      false
    )
    expect(
      needs_actor({
        entries: [
          { kind: 'pi.user' },
          {
            model: [
              {
                role: 'toolResult',
                toolName: 'bash',
                isError: true,
                content: [
                  { type: 'text', text: 'ENOENT: project file not found' }
                ]
              }
            ]
          }
        ]
      })
    ).toBe(false)
  })

  it('retains the same log after transport failure and clears it after resume', async () => {
    const deliver = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ resumed: true })
    const handover = create_handover(deliver)
    const log = { entries: [{ id: 1 }] }
    handover.hold(log)
    await expect(handover.transfer('person', 'actor')).rejects.toThrow(
      'offline'
    )
    await handover.transfer('person', 'actor')
    expect(deliver).toHaveBeenNthCalledWith(1, 'person', 'actor', log)
    expect(deliver).toHaveBeenNthCalledWith(2, 'person', 'actor', log)
    await handover.transfer('person', 'actor')
    expect(deliver).toHaveBeenCalledTimes(2)
  })

  it('does not treat a saved file as a resumed session', async () => {
    const deliver = vi
      .fn()
      .mockResolvedValueOnce({ written: true })
      .mockResolvedValueOnce({ resumed: true })
    const handover = create_handover(deliver)
    const log = { entries: [] }
    handover.hold(log)
    await expect(handover.transfer('person', 'actor')).rejects.toThrow(
      'has not resumed'
    )
    await handover.transfer('person', 'actor')
    expect(deliver).toHaveBeenLastCalledWith('person', 'actor', log)
  })

  it('refuses to overwrite a log that still needs delivery', () => {
    const handover = create_handover(vi.fn())
    handover.hold({ entries: [] })
    expect(() => handover.hold({ entries: [] })).toThrow('already waiting')
  })
})
