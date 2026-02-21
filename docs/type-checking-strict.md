# Path to Strict Type Checking

Current setup uses `checkJs: true` with `strict: false` and `strictNullChecks: false`. This doc maps a phased approach to enabling strict mode.

## Why Strict

- Catches null/undefined misuse that causes runtime errors
- Eliminates implicit `any` (functions without return types, untyped params)
- Enforces exhaustive handling of optional/maybe-undefined values

## Phased Approach

### Phase 1: Prepare (done)

- [x] Fix nested JSDoc (Poster.trace, Sync_Index_Entry)
- [x] Add element types to Sync_Deps arrays
- [x] Narrow `get_id` param type
- [x] Add PropType to key Vue props
- [x] Replace `any` casts in poster.js

### Phase 2: Enable `strictNullChecks` only

Add to tsconfig.json:

```json
"strictNullChecks": true
```

Keep `strict: false` for now. This single flag surfaces most null/undefined bugs.

**Common fixes:**

- Optional chaining: `foo?.bar` instead of `foo.bar`
- Nullish coalescing: `foo ?? default` instead of `foo || default`
- Explicit checks: `if (x != null)` before use
- Non-null assertion (`!`) only where you've verified (use sparingly)

**Files likely to need fixes:** sync.js, itemid.js, Vue components with optional props, composables that return refs.

### Phase 3: Fix per-directory

Use `// @ts-check` and incremental adoption if preferred: add `checkJs` only to specific dirs via multiple tsconfigs, or fix errors file-by-file. Alternatively, fix all Phase 2 errors before proceeding.

### Phase 4: Enable full `strict`

```json
"strict": true
```

This enables:

- strictNullChecks
- strictFunctionTypes
- strictBindCallApply
- strictPropertyInitialization
- noImplicitAny
- noImplicitThis
- useUnknownInCatchVariables

**Extra focus areas:**

- `noImplicitAny`: Add `@param` and `@returns` to all exported functions
- `strictFunctionTypes`: Callback/emit signatures may need tightening
- Catch variables: `catch (e: unknown)` and narrow before use

### Phase 5: Scripts and workers

- Add `scripts/**/*.js` to tsconfig `include` if you want them type-checked
- Remove `// @ts-nocheck` from workers.config.js and fix any worker build types

## Verification

After each phase:

```bash
npm run type
```

## Rollback

If a phase introduces too many errors, revert the tsconfig change and tackle files incrementally. Consider enabling `strictNullChecks` in a branch and fixing in batches.

---

## Errors Revealed by strictNullChecks

Bugs surfaced when enabling `strictNullChecks`, grouped by file and severity.

### Fixed (would crash)

| File                   | Location                               | Bug                                                                     | Fix                                                           |
| ---------------------- | -------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| Cloud.js               | `to_network`                           | `del(directory.id)` when directory is null                              | Early return with response before del                         |
| Directory.js           | `as_directory`                         | `local_directory.items` when null                                       | Optional chaining `local_directory?.items ?? []`              |
| Directory.js           | `is_directory`                         | `'id' in maybe` when maybe is null                                      | Guard `maybe != null &&`                                      |
| Paged.js               | `optimize`                             | `hydrate(localStorage.getItem(...))` – getItem returns null             | Guard: stored ? hydrate(stored) : null; early return if !frag |
| Paged.js               | `optimize`                             | `current_user.value.phoneNumber` when undefined                         | Guard + type assertion                                        |
| Paged.js               | `sync`                                 | `get_item(offline_html, ...)` – getItem returns null                    | `?? ''` before passing to get_item                            |
| Paged.js               | `sync`                                 | `type_as_list(offline_item)` – offline_item can be null                 | Updated type_as_list param to accept null                     |
| Storage.js             | `Me.save`                              | `me.value.name` when me is undefined                                    | Guard with type assertion                                     |
| svg-to-psd.js          | multiple                               | `ctx.getImageData` when getContext returns null                         | `if (!ctx) throw new Error(...)`                              |
| svg-to-video.js        | multiple                               | Same ctx null                                                           | Same guard                                                    |
| workers/vector.js      | `make_gradient`                        | ctx possibly null                                                       | Same guard                                                    |
| workers/video-frame.js |                                        | ctx possibly null                                                       | Same guard                                                    |
| bitmap-processor.js    | `calculate_threshold`                  | `bitmap.histogram().auto_threshold()` – histogram can be null           | Optional chaining `?.` + nullish coalescing                   |
| Histogram.js           | multiple                               | `this.data`, `this.lookup_table_h`, `this.sorted_indexes` possibly null | Guards, early returns, type annotations                       |
| Bitmap.js              | `point_to_index`                       | `_y` possibly undefined                                                 | Default `?? 0`                                                |
| directory-processor.js |                                        | `completed_poster.value` possibly null                                  | Guard before optimize, final_poster check before toString     |
| directory-processor.js |                                        | Promise resolve() type                                                  | JSDoc `@param {(value?: void) => void}`                       |
| sorting.js             | `recent_id_first`, `recent_item_first` | `as_created_at(null)` → NaN when comparing                              | Nullish coalescing `?? 0`                                     |

### Fixed (would misbehave)

| File                   | Location          | Bug                                                                   | Fix                                                               |
| ---------------------- | ----------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Paged.js               |                   | `as_created_at` returns null in template string → `"/+123/type/null"` | Guard `if (!type) return`; `created ?? 0` for numeric use         |
| svg-to-psd.js          |                   | `cutout_symbol_ids.has(symbol_id)` when symbol_id is null             | Guard `symbol_id &&`                                              |
| Histogram.js           |                   | `multilevel_thresholding` called with 1 arg, expects 3                | Default params `level_min = 0, level_max = 255`                   |
| Histogram.js           |                   | `stack.pop()` returns undefined                                       | Guard `if (!current) break` / early return                        |
| layer.js               | `settings_query`  | querySelector returns null, then .querySelector on null throws        | Optional chaining `settings?.querySelector(...) ?? null`          |
| optimize.js            | multiple          | optimizer ref null, element from getElementById null                  | Type ref as Worker \| null; guard before element.outerHTML        |
| directory-processor.js |                   | completed_poster ref typed as null, Promise resolve                   | Type ref as Poster \| null; resolve(undefined)                    |
| potrace/index.js       | multiple          | #luminance_data possibly null, histogram possibly null                | Guards in #bitmap_to_pathlist, #get_image_histogram, create_paths |
| potrace/Histogram.js   |                   | best_result.color_stops, get_stats early return shape                 | Type annotation; match return structure                           |
| itemid.js              | `as_created_at`   | Param Id doesn't accept null from sorting.js                          | Accept `Id \| null`, early return if !itemid                      |
| file.js                | `get_file_system` | showDirectoryPicker possibly undefined                                | Guard before calling                                              |
| image.js               | `size`            | ctx possibly null                                                     | `if (!ctx) throw new Error(...)`                                  |
| algorithms.js          | mutex             | queue typed as never[], next() callable                               | Type queue array                                                  |
| pattern.js             |                   | loaded_vector ref null, Item→Poster assign                            | Type ref as Poster \| null; type assertion for load result        |

### Pending (not yet fixed)

Remaining errors as of last run: ~185 across 15 files. Heaviest: statement.js (21), poster.js (27).

### Vectorize.js (fixed)

- sort_cutouts_into_layers: handle undefined cutout – normalize to []
- vectorize: early return when workers null – set working.value = false first
- vectorized: guard when current_item_id null – return before processing
- vectorize: Worker refs null check before postMessage
- All getContext('2d'): ctx null guard
- handle_tracer_complete: optimizer, element null guards
- optimized: id, vec null guard
- clear_vector_paths: Array.isArray check before cutout.length
- add_cutout_path: vec.cutout single vs array handling
- catch blocks: error instanceof Error narrow before .message

### Sync.js (fixed)

- sync_element.value?.querySelector – optional chaining
- get_my_itemid null guards in sync_statements, sync_relations, sync_events, sync_me
- visit: deps.me.value?.visited, guard before assigning
- Me().save: guard for querySelector null
- del(id): add missing await in sync_me
- local_html: typeof check before create_hash
- my_info: typeof check before create_hash
- current_instance(): null guard for emit
- relations: initialize as Ref<Relation[]>
- deps: type assertion for Sync_Deps

### Item.js (fixed)

- get_item: null check for hydrate result
- itemprop_value: (element.textContent ?? '').trim()

### People.js (fixed)

- load_person: guard before push when item null
- save: guard for querySelector null
- get_my_itemid: localStorage.me ?? null
- relations: ref([]) with Relation[] type
- catch: error instanceof Error narrow

### Serverless.js (fixed)

- Refs: JSDoc types for me, app, auth, storage, current_user
- location: guard for storage.value
- sign_off: guard for auth.value
- remove catch: e.code narrow
- init_serverless: auth guard before auth_changed, resolve(undefined), default_person cast, phone/me.value guards
