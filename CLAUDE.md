# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

- **Development**: `npm run dev` (starts Vite dev server on https://127.0.0.1:8080)
- **Build**: `npm run build` (production build with Vite)
- **Testing**: `npm test` (run all tests), `npm run test:watch` (watch mode), `npm run test:ui` (test UI)
- **Linting**: `npm run lint` (ESLint with auto-fix)
- **Type Checking**: `npm run type` (TypeScript compiler check)
- **Format**: `npm run format` (Prettier formatting)
- **Workers**: `npm run dev:workers` (watch worker builds), `npm run build:workers` (build workers)
- **Deploy**: `npm run deploy` (full deployment to Firebase)

## Architecture Overview

Realness is a client-first social network application that prioritizes privacy and user control:

### Core Philosophy

- **Client-only data processing**: Full functionality without server-side tracking
- **HTML as database**: Uses semantic HTML with microdata for structured content
- **Edge-first approach**: localStorage for small data, IndexedDB for large data
- **No backend processes**: Server provides only auth and storage

### Key Technical Patterns

**Data Layer**:

- Uses `src/types.js` for comprehensive type definitions via JSDoc
- Item IDs follow pattern: `/${Author}/${Type}/${Created}` (see `src/utils/itemid.js`)
- Persistence layer in `src/persistance/` handles localStorage, IndexedDB, and Cloud storage
- Data synchronization through `src/use/sync.js`

**UI Architecture**:

- Vue 3 SPA with Vue Router
- Component-based architecture with semantic HTML elements
- Stylus for CSS preprocessing with element-based inheritance over classes
- PWA with service workers for offline functionality

**Image Processing**:

- Custom potrace implementation in `src/potrace/` for vector tracing
- WASM module for performance-critical operations
- Five-layer poster generation system (background, light, regular, medium, bold)
- Color extraction and gradient generation

**Workers**:

- Service worker for PWA functionality
- Web workers for image processing (`src/workers/`)
- Compression/decompression utilities

### Code Style Requirements

- Use snake_case for variables and functions (per `.cursorrules`)
- No semicolons
- Modern JavaScript features preferred
- JSDoc types at file top, type imports from `src/types.js`
- Semantic HTML with element-based CSS inheritance
- Single-line `if` statements when possible
- Let errors propagate (minimal try/catch usage)
- Brief, direct code without unnecessary explanations

### Testing

- Vitest for unit testing with happy-dom environment
- Coverage targets: 80% lines, branches, statements, functions
- Comprehensive mocks in `tests/mocks/` for browser APIs
- Test files follow `*.spec.js` pattern

### Firebase Integration

- Authentication via phone numbers only
- Cloud Storage for user-generated content
- Client-side compression before upload
- No analytics or tracking

This codebase prioritizes readability, user privacy, and client-side performance while maintaining a social networking experience without traditional tracking mechanisms.
