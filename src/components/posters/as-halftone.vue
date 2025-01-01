
<style>
  svg[itemtype='/posters'] halftone {
    font-size: 17px;
    --s: 2em 2em;
    --c: 21;
    --dot: radial-gradient(closest-side, #777, #fff calc(100% / sqrt(2)));
    --pattern: var(--dot) 0 0 / var(--s), var(--dot) 1em 1em / var(--s);

    --map: linear-gradient(90deg, #888, #fff);

    filter: contrast(var(--c));
    background-blend-mode: multiply;
    background: var(--pattern), var(--map);
  }
</style>
