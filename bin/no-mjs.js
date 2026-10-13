#!/usr/bin/env node

import { readdirSync as readdir_sync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const skip = new Set([
  "node_modules",
  ".git",
  ...(process.argv.includes("--all") ? [] : ["artifacts"]),
]);

const mjs = [];
const cjs = [];
const walk = (dir) => {
  for (const entry of readdir_sync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skip.has(entry.name)) walk(join(dir, entry.name));
    } else if (entry.name.endsWith(".mjs")) {
      mjs.push(relative(root, join(dir, entry.name)));
    } else if (entry.name.endsWith(".cjs")) {
      cjs.push(relative(root, join(dir, entry.name)));
    }
  }
};
walk(root);

if (cjs.length) {
  console.log(`${cjs.length} .cjs file(s), correct where CommonJS is required:`);
  for (const file of cjs) console.log(`  ${file}`);
}

if (mjs.length) {
  console.log(`${mjs.length} .mjs file(s) - use .js:`);
  for (const file of mjs) console.log(`  ${file}`);
  process.exit(1);
}

console.log("no .mjs files");