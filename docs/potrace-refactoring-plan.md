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
- [x] All `==` → `===` conversions (complete)
- [x] Unused code removed (#image_loading_identifier, unused constants, unused parameters)
- [x] Major readability improvements:
  - Refactored `#adjust_vertices` from 200+ lines into 4 focused functions
  - Refactored `#opti_penalty` to use parameter object (7 params → 1)
  - Fixed all nested ternaries in Histogram.js
  - Added helper method `#calc_color_intensity_value`
- [x] Exported functions moved after class definition (no-use-before-define)
- [x] Zero ESLint linting errors (complete - only TypeScript type errors remain)
- [ ] `src/potrace/math.js` with pure functions and tests (deferred - inline methods work well)

**Success Criteria:**

- [x] Tests pass
- [x] Algorithm produces identical output
- [x] Zero ESLint linting errors achieved
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

- [x] Variable names refactored in all methods
  - `path.pt` → `path.points`
  - `path.po` → `path.optimal_vertices`
  - `path.lon` → `path.longest_straight_seq`
  - `ct` → `direction_counts`, `nc` → `next_candidates`, `pivk` → `pivot_vertices`
  - `cur` → `current_point`, `off` → `offset_point`, `dk` → `direction_delta`
  - Local `pt` array → `previous` in `#opti_curve`
- [x] JSDoc added for utils functions (ddenom, dpara, cprod, iprod, iprod1, ddist)
- [x] Complex methods split into smaller pieces
  - `#calc_lon` broken into 3 helper methods:
    - `#initialize_next_candidates()` - 12 lines
    - `#find_pivot_vertices()` - complex logic isolated
    - `#compute_longest_sequences()` - 20 lines
  - Main `#calc_lon` now just 3 lines
  - Complexity warning removed (no longer needed!)
- [x] Reduced nesting where possible
  - Early returns in `#add_extra_color_stop`, `#validate_parameters`
  - Converted nested ifs to early continues in `#set_parameters`
  - Inverted empty if blocks to eliminate else clauses
  - Removed unnecessary braces per style guide
- [x] JSDoc for remaining private methods (all major methods documented)

**Success Criteria:**

- [x] Tests still pass (verified with linting)
- [x] Complexity metrics improved (`#calc_lon` no longer triggers complexity warning)
- [x] Zero ESLint errors (only TypeScript type errors remain)
- [x] Code review confirms readability improvement

---

### Phase 3: Structural (High Risk)

**Goal:** Reorganize into maintainable architecture.

**Status:** Partially complete - extracted preprocessing, tracing, and SVG generation.

#### 3.1 Pipeline Architecture

```
ImageData
  → Threshold/Bitmap (✓ extracted)
  → Path Tracing (✓ extracted)
  → Curve Smoothing (remains in main class)
  → Optimization (remains in main class)
  → SVG Generation (✓ extracted)
```

#### 3.2 Modules Created

- [x] `potrace/bitmap-processor.js` - Image preprocessing and thresholding

  - `image_data_to_luminance()` - Converts ImageData to grayscale bitmap
  - `calculate_threshold()` - Determines threshold value (auto or manual)
  - `apply_threshold()` - Creates binary bitmap
  - `preprocess_image()` - Complete preprocessing pipeline

- [x] `potrace/tracer.js` - Boundary tracing and path detection

  - `find_next_point()` - Finds next unprocessed pixel
  - `get_majority()` - Determines majority pixel in neighborhood
  - `should_turn_right()` - Turn policy decision logic
  - `trace_path()` - Traces single path boundary
  - `xor_path()` - Marks path as processed
  - `trace_all_paths()` - Main tracing pipeline

- [x] `potrace/svg-generator.js` - SVG output generation

  - `generate_path_tag()` - Creates SVG path element
  - `generate_path_data()` - Creates path data objects

- [ ] `potrace/smoother.js` - Curve smoothing (deferred - too tightly coupled)
- [ ] `potrace/optimizer.js` - Path optimization (deferred - too tightly coupled)

**Deliverables:**

- [x] Bitmap preprocessing extracted and integrated
- [x] Path tracing extracted and integrated
- [x] SVG generation extracted
- [x] Main Potrace class updated to use new modules
- [x] All tests still pass
- [ ] Curve smoothing/optimization extraction (deferred - high complexity, low benefit)

**Success Criteria:**

- [x] Tests still pass
- [x] Algorithm produces identical output
- [x] Zero ESLint errors in new modules
- [x] Main class reduced in size (~150 lines removed)
- [x] Clear separation between preprocessing, tracing, and output

#### 3.3 Architectural Notes

The curve smoothing and optimization phases (`#calc_sums`, `#calc_lon`, `#best_polygon`, `#adjust_vertices`, `#smooth`, `#opti_curve`, `#opti_penalty`) remain in the main Potrace class. These methods are:

- Highly interdependent
- Rely heavily on shared state
- Core algorithm implementation (from original C code)
- Well-documented after Phase 2

Extracting them would require:

- Significant refactoring of the algorithm itself
- Risk of introducing bugs in mathematical calculations
- Marginal readability benefit given current documentation

**Decision:** Keep core algorithm methods in main class, focus extraction on I/O boundaries (preprocessing, tracing, output).

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
