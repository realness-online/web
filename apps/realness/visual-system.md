# Visual system

## Vault icon

- Tile: the six Realness tiles (`ash`, `tide`, `silt`, `ember`, `rust`,
  `cinder` in `public/icons.svg`), unchanged.
  why: the vault is the same family as Realness at a glance.
- Fill: each tile is filled or outlined in its own smalti color.
  why: outlined is stored, not on show; the vault holds things.
- Seam: every tile scales toward its own center.
  why: the gaps read as the seams of a closed door.
- Seed: bit `i` fills tile `i`, in the order above.
  why: any version is reproducible from its seed.

### Keepers

- Baseline, sheet 1 no. 7: seed 12 (middle row, `silt` and `ember`, filled),
  seam 0.86, stroke 6.
  why: a lit band across a closed door; still reads as Realness; strong at
  header size.

Generator: `artifacts/realness/vault-icon/generate.js`.
