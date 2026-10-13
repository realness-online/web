import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mock_paid, mock_record, mock_log_info, mock_log_error } = vi.hoisted(
  () => ({
    mock_paid: vi.fn(),
    mock_record: vi.fn(),
    mock_log_info: vi.fn(),
    mock_log_error: vi.fn()
  })
)

vi.mock('#services/prints.js', async original => ({
  ...(await original()),
  paid_print_sessions: mock_paid
}))
vi.mock('#services/sale.js', () => ({ record_sale: mock_record }))
vi.mock('#utils/stripe.js', () => ({ stripe_secret_bindings: [] }))
vi.mock('#utils/log.js', () => ({
  log_info: mock_log_info,
  log_error: mock_log_error
}))

const { prints_reconcile_handler } = await import(
  '#handlers/scheduled/prints-reconcile.js'
)

const AUTHOR = '/+14155550142'
const sale = (created, session_id = `cs_${created}`) => ({
  poster_id: `${AUTHOR}/posters/${created}`,
  amount: 500,
  session_id,
  date: '2026-09-22T02:42:21.000Z'
})

describe('#handlers/scheduled/prints-reconcile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.PRINTS_AUTHOR = AUTHOR
  })

  it('records every paid print the posters are missing', async () => {
    mock_paid.mockResolvedValue([sale(1), sale(2)])
    mock_record.mockResolvedValueOnce(true).mockResolvedValueOnce(false)

    await prints_reconcile_handler()

    expect(mock_record).toHaveBeenCalledWith(`${AUTHOR}/posters/1`, {
      amount: 500,
      session_id: 'cs_1',
      date: '2026-09-22T02:42:21.000Z'
    })
    expect(mock_log_info).toHaveBeenCalledWith('prints reconcile', {
      paid: 2,
      recorded: 1,
      failed: 0
    })
  })

  it('skips sessions for posters that are not the prints author\'s', async () => {
    mock_paid.mockResolvedValue([
      { ...sale(1), poster_id: '/+15551234567/posters/1' }
    ])

    await prints_reconcile_handler()

    expect(mock_record).not.toHaveBeenCalled()
  })

  it('keeps going when one poster cannot be written', async () => {
    mock_paid.mockResolvedValue([sale(1), sale(2)])
    mock_record
      .mockRejectedValueOnce(new Error('No poster file'))
      .mockResolvedValueOnce(true)

    await prints_reconcile_handler()

    expect(mock_record).toHaveBeenCalledTimes(2)
    expect(mock_log_error).toHaveBeenCalledWith(
      'prints reconcile: write failed',
      expect.objectContaining({ poster_id: `${AUTHOR}/posters/1` })
    )
    expect(mock_log_info).toHaveBeenCalledWith('prints reconcile', {
      paid: 2,
      recorded: 1,
      failed: 1
    })
  })
})
