# Segmentation Masks for Post-Tracer Processing

## Overview

Run segmentation in parallel, convert masks to SVG using potrace, then apply over poster

## Architecture

Segmentation → Potrace Masks → Apply over Poster.

## Potrace Configuration for Masks

- `steps: 1` - Single layer (binary mask)
- `optTolerance: 0.55` - Higher tolerance = simpler paths
- `turdSize: 40` - Filter small speckles
- `blackOnWhite: true` - Trace white mask regions
- `optCurve: true` - Use curves for smoother boundaries
- Plus SVGO optimization

## Individual Item Masks

EdgeTAM supports instance segmentation, creating separate masks for each person/animal/object.

**Data structure:**

- Each item gets unique mask ID: `person-0-mask`, `person-1-mask`, `animal-0-mask`
- Items include: type, bbox, center, depth, confidence
- Enables per-object animations and interactions

## SVG Scaling

Masks must match viewBox coordinate system:

- Use `maskUnits="userSpaceOnUse"` - matches viewBox coordinates
- Use absolute pixel dimensions matching viewBox: `width="800" height="600"`
- Position at `x="0" y="0"` to align with viewBox origin
- Mask scales proportionally with SVG

## Animation Possibilities

With structured segmentation data (items list + depth layers), you can:

**Individual object animations:**

- Animate each person/animal/object independently
- Different timing, movement, effects per object

**Depth-based parallax:**

- Foreground moves faster than background
- 3D-like depth perception

**Subject-following Ken Burns:**

- Track specific people/animals
- Keep subjects centered during pan/zoom
- Portrait mode effects

**Staggered reveals:**

- Reveal objects in sequence (foreground → midground → background)
- Storytelling sequences

**Interactive selection:**

- Click/hover specific objects to animate them
- Highlight individual subjects

**Type-based animations:**

- People: gentle breathing
- Animals: more dynamic movement
- Objects: subtle shimmer

**Relationship-based:**

- Animate objects based on proximity
- Group interactions

**Attention-based:**

- More animation for larger/central objects

## Usage Patterns

**Filter by class:**

- Show only cutouts that overlap with people/animals
- Hide background cutouts

**Adjust layer assignment:**

- Use segmentation to reassign progress values
- Foreground → higher layers (rocks/boulders)
- Background → lower layers (sediment/sand)

**Style by class:**

- Different opacity/effects for people vs animals vs background

**Combine multiple masks:**

- Foreground cutouts with foreground mask
- Background cutouts with background mask
- Individual objects with their own masks

## Implementation Notes

**Segmentation worker:**

- Run in parellel to other workers
- Output structured item list with masks
- Convert masks to SVG paths using potrace

**Mask creation:**

- Convert segmentation mask to ImageData
- Potrace to SVG paths with optimized settings

**Applying masks:**

- Add mask elements to SVG `<defs>`
- Apply via `mask` attribute on paths or groups
- Can apply to individual paths or entire cutout groups

**Performance:**

- Potrace processing adds CPU time but significantly reduces file size
- Typical savings: 80-90% for simple masks, 50-70% for medium complexity

## Stretch Goals

On-device generation of alpha, depth, and roughness maps for enhanced poster effects.

### Depth Map

**Status:** ~80-90% achievable with segmentation

- EdgeTAM provides depth per segmented item
- Rasterize each item's mask region with its depth value
- Convert to grayscale ImageData → potrace to SVG mask
- Enables depth-based effects without monocular depth estimation

**Implementation:**

- Paint each segmented item's mask with normalized depth value (0-255)
- Combine all painted regions into full depth map ImageData
- Potrace depth map with appropriate settings
- Store as SVG mask element in poster

### Alpha Map

**Status:** ~50% achievable with segmentation

- Extract from original ImageData alpha channel (already available)
- Segmentation masks enable selective alpha application per object
- Full-image alpha map for transparency effects

**Implementation:**

- Extract alpha channel from source ImageData
- Optionally combine with segmentation masks for per-object alpha
- Convert to grayscale ImageData → potrace to SVG mask
- Apply via SVG `mask` or `opacity` attributes

### Roughness Map

**Status:** ~30% achievable with segmentation

- Segmentation enables per-object texture analysis
- Compute local variance/gradients within each segmented region
- More accurate than global analysis

**Implementation:**

- For each segmented item, compute texture statistics (variance, gradients)
- Map roughness values to grayscale (0-255)
- Combine per-object roughness into full map ImageData
- Potrace to SVG mask for material-based effects
