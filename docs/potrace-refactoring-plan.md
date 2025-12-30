# Potrace Algorithm Refactoring Plan

## Overview

The potrace bitmap-to-vector tracing algorithm is currently implemented as a 1850+ line monolithic class that's difficult to understand, test, and maintain. This document outlines a phased approach to improve code quality while preserving algorithm correctness.

## Current State Analysis

### Problems Identified

1. **Monolithic Structure**
   - Single 1850+ line class with all private methods
   - High coupling between algorithm phases
   - No clear separation of concerns

2. **Poor Readability**
   - Cryptic variable names (`pt`, `k1`, `conv`, `dd`, `dpara`)
   - Minimal inline documentation
   - Complex nested loops and conditions
   - High cyclomatic complexity (e.g., `#calc_lon` = 35)

3. **Untestable**
   - All methods are private
   - Heavy reliance on class state
   - No way to unit test individual algorithm steps

4. **Code Quality Issues**
   - 69 magic number warnings
   - 52 linting errors (eqeqeq, no-param-reassign, etc.)
   - Unused constants
   - Inconsistent type coercion (== vs ===)

### Magic Numbers Requiring Explanation

- `-0.999847695156` - Tangent angle threshold
- `0.75` - Alpha scaling factors
- `0.55` - Minimum alpha threshold
- `0.3` - Penalty ratio
- `-0.5` - Curvature threshold
- `200` - Posterization brightness threshold
- `0.1` - Posterization step scale
- `255` - RGB max value (used throughout)
- `4` - RGBA components
- `0.5` - Half/midpoint calculations

## Refactoring Strategy

### Phase 1: Foundation & Safety (Low Risk)

**Goal:** Make code testable and fix critical bugs without changing algorithm structure.

#### 1.1 Extract Pure Math Utilities

Create `src/potrace/math.js` with pure geometric functions:

```javascript
// Distance calculations
export const distance = (p1, p2) => { ... }
export const distance_squared = (p1, p2) => { ... }

// Vector operations
export const cross_product = (p1, p2, p3, p4) => { ... }
export const dot_product = (p1, p2, p3, p4) => { ... }
export const dot_product_normalized = (p1, p2, p3, p4) => { ... }

// Geometric predicates
export const sign = (value) => { ... }
export const point_in_range = (point, min, max) => { ... }
```

**Benefits:**
- Testable in isolation
- Self-documenting function names
- Reusable across algorithm phases
- No risk to algorithm correctness

#### 1.2 Create Named Constants

Add to top of relevant files with explanatory comments:

```javascript
// RGB color space
const RGB_MAX = 255
const RGBA_COMPONENTS = 4

// Geometric calculations
const HALF = 0.5
const TANGENT_PARALLEL_THRESHOLD = -0.999847695156 // cos(angle) near 180°

// Corner detection thresholds
const CORNER_DETECTION_SCALE = 0.75
const MIN_CORNER_THRESHOLD = 0.55

// Curve optimization
const CURVATURE_THRESHOLD = -0.5
const OPTIMIZATION_PENALTY = 0.3

// Posterization
const POSTERIZE_BRIGHTNESS_THRESHOLD = 200
const POSTERIZE_STEP_SCALE = 0.1
```

#### 1.3 Fix Critical Bugs

1. **Type Coercion Issues** - Replace all `==` with `===` and `!=` with `!==`
   - Potential for subtle bugs with type coercion
   - 17 instances to fix

2. **Remove Unused Code**
   - Delete unused constants: `TANGENT_PRECISION`, `POSTERIZE_BRIGHTNESS_THRESHOLD`, `POSTERIZE_STEP_SCALE`
   - Remove unused private member: `#image_loading_identifier`

3. **Fix Hoisting Issues**
   - Move `Potrace` class definition before usage in `as_paths`, `as_path`, `as_path_data`

#### 1.4 Disable Appropriate Rules

For algorithmic code patterns that are idiomatic:

```javascript
/* eslint-disable no-param-reassign */ // Loop counters
/* eslint-disable no-nested-ternary */ // Mathematical expressions
/* eslint-disable complexity */ // Algorithm naturally complex
```

**Deliverables:**
- [x] Named constants with documentation (RGB_MAX, RGBA_COMPONENTS, HALF, etc.)
- [x] All `==` → `===` conversions (most complete, 3 remaining)
- [x] Unused code removed (#image_loading_identifier, unused constants)
- [x] Major readability improvements:
  - Refactored `#adjust_vertices` from 200+ lines into 4 focused functions
  - Refactored `#opti_penalty` to use parameter object (7 params → 1)
  - Fixed all nested ternaries in Histogram.js
  - Added helper method `#calc_color_intensity_value`
- [x] Exported functions moved after class definition (no-use-before-define)
- [ ] `src/potrace/math.js` with pure functions and tests (deferred - inline methods work well)
- [ ] Zero critical linting errors (19 errors, 3 warnings remaining - mostly prefer-const in algorithmic code)

**Success Criteria:**
- [x] Tests pass
- [x] Algorithm produces identical output
- [ ] Math functions have unit tests (deferred)

---

### Phase 2: Readability (Medium Risk)

**Goal:** Make code easier to understand without changing structure.

#### 2.1 Meaningful Variable Names

Transform cryptic names to descriptive ones:

- `k1` → `next_vertex_index`
- `conv` → `convexity_sign`
- `dd` → `distance`
- `dpara` → `parallel_distance`
- `pt` → `points`
- `foundk` → `found_valid_vertex`

#### 2.2 Method Documentation

Add JSDoc comments explaining:
- What the method does (high level)
- Algorithm step it implements
- Key mathematical concepts
- Parameter meanings
- Return value semantics

Example:
```javascript
/**
 * Calculate longest optimal polygon segments for path smoothing
 *
 * This implements the "segment optimization" phase of Potrace where we
 * find the longest sequences of vertices that can be well-approximated
 * by Bezier curves.
 *
 * @private
 * @param {Path} path - Path with vertices to optimize
 * @returns {void} - Modifies path.lon in place
 */
#calc_lon = path => { ... }
```

#### 2.3 Break Down Complex Methods

Extract logical steps from high-complexity methods:

```javascript
// Instead of one 200-line #calc_lon:
#calc_lon = path => {
  this.#initialize_lon_data(path)
  this.#find_optimal_segments(path)
  this.#validate_constraints(path)
}
```

#### 2.4 Reduce Nesting

Use early returns and guard clauses:

```javascript
// Before:
if (condition) {
  if (other_condition) {
    // 50 lines
  }
}

// After:
if (!condition) return
if (!other_condition) return
// 50 lines at lower indentation
```

**Deliverables:**
- [ ] Variable names refactored in all methods
- [ ] JSDoc for all private methods
- [ ] Complex methods split into smaller pieces
- [ ] Reduced nesting where possible

**Success Criteria:**
- Tests still pass
- Complexity metrics improved
- Code review confirms readability improvement

---

### Phase 3: Structural (High Risk - Future)

**Goal:** Reorganize into maintainable architecture.

This phase would involve deeper restructuring and should only be attempted after Phase 1 and 2 are complete and stable.

#### 3.1 Pipeline Architecture

```
ImageData
  → Threshold/Bitmap
  → Path Tracing
  → Curve Smoothing
  → Optimization
  → SVG Generation
```

#### 3.2 Separate Concerns

- `potrace/bitmap.js` - Image thresholding and preprocessing
- `potrace/tracer.js` - Boundary tracing
- `potrace/smoother.js` - Curve smoothing
- `potrace/optimizer.js` - Path optimization
- `potrace/svg-generator.js` - SVG output

#### 3.3 Immutable Operations

Where possible, avoid mutation and return new data structures.

---

## Implementation Order

1. **Week 1: Math Utilities**
   - Extract and test pure functions
   - Add named constants
   - Fix eqeqeq bugs

2. **Week 2: Cleanup**
   - Remove unused code
   - Fix hoisting issues
   - Add eslint-disable for algorithmic patterns

3. **Week 3: Documentation**
   - Add JSDoc comments
   - Document algorithm phases
   - Explain mathematical concepts

4. **Week 4: Readability**
   - Rename variables
   - Extract helper methods
   - Reduce nesting

## Testing Strategy

### Unit Tests

- All extracted math functions must have tests
- Test edge cases: zero length, collinear points, etc.
- Property-based tests for geometric invariants

### Integration Tests

- Golden image tests: known input → expected SVG output
- Compare before/after refactoring outputs
- Test various threshold values and options

### Regression Prevention

- Snapshot tests for complex images
- Visual diff testing
- Performance benchmarks

## Success Metrics

- **Testability**: 80%+ code coverage on new modules
- **Readability**: Cyclomatic complexity < 20 per function
- **Quality**: Zero critical linting errors
- **Performance**: No regression (within 5%)
- **Correctness**: Identical output for all test cases

## Risk Mitigation

1. **Always Compare Output** - Every change must produce identical results
2. **Incremental Changes** - Small PRs, easy to review and revert
3. **Test Coverage First** - Add tests before refactoring
4. **Keep Original** - Maintain original implementation until confident
5. **Performance Monitoring** - Benchmark each phase

## Notes

- This is a port of the C Potrace algorithm
- Mathematical correctness is paramount
- Some algorithmic patterns (param reassignment, nested ternaries) are acceptable
- Focus on making intent clear, not fighting the algorithm's nature



