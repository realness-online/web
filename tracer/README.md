# Tracer WASM Module

This module provides vector tracing functionality via WebAssembly.

## Build Process

1. Build WASM:
```bash
cd web/tracer
wasm-pack build --target web
```

2. Build Workers:
```bash
cd web
npm run build:workers
```

The WASM files will be copied to `public/wasm/` during worker build.

## Development

- WASM source: `web/tracer/src/lib.rs`
- Worker: `web/src/workers/tracer.js`
- Build config: `web/workers.config.js`

## Dependencies

- `wasm-pack` for WASM compilation
- `rollup-plugin-copy` for WASM file copying
