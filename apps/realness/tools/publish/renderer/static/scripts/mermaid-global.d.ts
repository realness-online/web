/**
 * `mermaid.min.js` sets this global when the page loads it. The bundle is
 * served from `/scripts/`, so only the shape `draw_diagrams` needs is declared.
 */
declare global {
  interface Window {
    mermaid: { initialize: Function; run: Function }
  }
}

export {}