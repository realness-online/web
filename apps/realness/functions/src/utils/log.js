import { logger } from 'firebase-functions'

const LEVEL_ORDER = { DEBUG: 0, INFO: 1, WARNING: 2, ERROR: 3 }
const min_level =
  LEVEL_ORDER[process.env.LOG_LEVEL?.toUpperCase()] ?? LEVEL_ORDER.INFO

const omit_undefined = obj =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))

const emit = (severity, message, context = {}) => {
  if (LEVEL_ORDER[severity] < min_level) return
  const data = omit_undefined(context)
  if (severity === 'ERROR') logger.error(message, data)
  else if (severity === 'WARNING') logger.warn(message, data)
  else if (severity === 'DEBUG') logger.debug(message, data)
  else logger.info(message, data)
}

const error_context = err =>
  err instanceof Error
    ? { error: err.message, stack: err.stack }
    : { error: err }

export const log_debug = (message, context = {}) =>
  emit('DEBUG', message, context)
export const log_info = (message, context = {}) =>
  emit('INFO', message, context)
export const log_warn = (message, context = {}) =>
  emit('WARNING', message, context)
export const log_error = (message, err_or_context) => {
  const context =
    err_or_context instanceof Error
      ? error_context(err_or_context)
      : (err_or_context ?? {})
  emit('ERROR', message, context)
}
