import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mock_logger } = vi.hoisted(() => ({
  mock_logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('firebase-functions', () => ({ logger: mock_logger }))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  delete process.env.LOG_LEVEL
})

describe('#utils/log', () => {
  it('sends info through logger.info; debug is below the default floor', async () => {
    const { log_debug, log_info } = await import('#utils/log.js')

    log_info('hello', { a: 1 })
    expect(mock_logger.info).toHaveBeenCalledWith('hello', { a: 1 })

    log_debug('quiet')
    expect(mock_logger.debug).not.toHaveBeenCalled()
  })

  it('sends debug through logger.debug when LOG_LEVEL=debug', async () => {
    process.env.LOG_LEVEL = 'debug'
    const { log_debug } = await import('#utils/log.js')

    log_debug('now visible', { step: 1 })
    expect(mock_logger.debug).toHaveBeenCalledWith('now visible', { step: 1 })
  })

  it('sends warnings through logger.warn', async () => {
    const { log_warn } = await import('#utils/log.js')

    log_warn('careful', { code: 42 })
    expect(mock_logger.warn).toHaveBeenCalledWith('careful', { code: 42 })
  })

  it('flattens an Error into the error context', async () => {
    const { log_error } = await import('#utils/log.js')

    log_error('broke', new Error('boom'))
    expect(mock_logger.error).toHaveBeenCalledWith('broke', {
      error: 'boom',
      stack: expect.any(String)
    })
  })

  it('passes a plain context object through as-is', async () => {
    const { log_error } = await import('#utils/log.js')

    log_error('broke', { reason: 'timeout' })
    expect(mock_logger.error).toHaveBeenCalledWith('broke', {
      reason: 'timeout'
    })
  })

  it('defaults the error context to an empty object', async () => {
    const { log_error } = await import('#utils/log.js')

    log_error('broke')
    expect(mock_logger.error).toHaveBeenCalledWith('broke', {})
  })

  it('omits undefined fields from the context', async () => {
    const { log_info } = await import('#utils/log.js')

    log_info('hello', { present: 1, absent: undefined })
    expect(mock_logger.info).toHaveBeenCalledWith('hello', { present: 1 })
  })

  it('suppresses everything below LOG_LEVEL=ERROR', async () => {
    process.env.LOG_LEVEL = 'error'
    const { log_info, log_warn, log_error } = await import('#utils/log.js')

    log_info('quiet')
    log_warn('quiet')
    expect(mock_logger.info).not.toHaveBeenCalled()
    expect(mock_logger.warn).not.toHaveBeenCalled()

    log_error('loud')
    expect(mock_logger.error).toHaveBeenCalledTimes(1)
  })
})
