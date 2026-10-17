export class HaloError extends Error {}
export class FirecrackerError extends Error {}
export class VsockError extends Error {}
export class NotFound extends Error {}
export class Busy extends Error {}
export class BadRequest extends Error {}
/** The halo is parking; the caller retries and wakes it. */
export class Parking extends Error {}
/** hs-over: the halo cannot hold another actor; the caller goes elsewhere. */
export class Full extends Error {}

/** 500s: a failure below the API, whose message is where the fix is. */
export const HALO_FAILURES = [HaloError, FirecrackerError, VsockError, Busy]
