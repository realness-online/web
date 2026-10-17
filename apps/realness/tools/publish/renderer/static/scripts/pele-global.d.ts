/**
 * `pele.global.js` sets this global when the page loads it. The bundle is
 * served from `/scripts/`, so only the shape `draw_diagrams` needs is declared.
 */
declare global {
  interface Window {
    pele: { mount: Function }
  }
}

export {}
