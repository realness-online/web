/** Time and size units shared by the services, so arithmetic reads as units. */
export const MS_PER_SECOND = 1000
export const SECONDS_PER_MINUTE = 60
export const SECONDS_PER_HOUR = 3600
export const HOURS_PER_DAY = 24
export const MS_PER_MINUTE = 60_000
export const MS_PER_HOUR = 3_600_000
export const MS_PER_DAY = 86_400_000
export const KIB = 1024
export const MIB = 1_048_576
export const GIB = 1_073_741_824
export const PERCENT = 100

/** Lengths and offsets inside an ISO 8601 timestamp, `YYYY-MM-DDTHH:MM:SS.sssZ`. */
export const ISO_MONTH = 7
export const ISO_DATE = 10
export const ISO_TIME_START = 11
export const ISO_MINUTE = 16
export const ISO_SECOND = 19

/** Bytes in a random id suffix; 6 bytes give 12 hex characters. */
export const ID_BYTES = 6
