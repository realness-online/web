import { skipped } from './skip.js'

/** A relative path an actor may be limited to: no traversal, no secrets. */
export const limit_path = (path) =>
  typeof path === "string" && path.length <= 512 && !skipped(path) &&
  path.split("/").every((part) => part && part !== "." && part !== ".." && !/[\\\0]|%[0-9a-f]{2}/i.test(part))
