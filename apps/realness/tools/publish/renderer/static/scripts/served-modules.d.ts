/**
 * `build.js` copies the template polyfill into the built site's `scripts/`
 * folder, and `detect.js` loads it by that served URL, so there is no module
 * on disk for TypeScript to resolve. The module has no exports to read.
 */
declare module '*/template-for-polyfill.js'
