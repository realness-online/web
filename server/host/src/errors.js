// The failures the HTTP layer turns into status codes.

export class HostError extends Error {} // the host is not ready; the message says what to run
export class FirecrackerError extends Error {}
export class VsockError extends Error {}
export class NotFound extends Error {}
export class Busy extends Error {}
export class BadRequest extends Error {}

/** 500s: a failure below the API, whose message is where the fix is. */
export const HOST_FAILURES = [HostError, FirecrackerError, VsockError, Busy]
