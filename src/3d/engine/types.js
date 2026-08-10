/**
 * @typedef {Object} FrameState
 * @property {number} now_ms
 * @property {number} delta_s
 * @property {number} elapsed_s
 * @property {number} fps
 */

/**
 * @typedef {Object} InputState
 * @property {number} pointer_dx
 * @property {number} pointer_dy
 * @property {number} pan_wheel_x
 * @property {number} pan_wheel_y
 * @property {number} wheel_delta
 * @property {number} pointer_x_norm
 * @property {number} pointer_y_norm
 * @property {number} arrow_x
 * @property {number} arrow_y
 * @property {number} gyro_x
 * @property {number} gyro_y
 * @property {boolean} shift_held
 * @property {boolean} alt_held
 * @property {boolean} cmd_held
 * @property {boolean} touch_active
 */

/**
 * The scene's mutable settings. The setters on PosterSceneController write
 * here; the appliers below read it back onto the three.js objects.
 * @typedef {Object} PosterSceneState
 * @property {number} mosaic_spread
 * @property {number} mosaic_opacity
 * @property {number} shadow_spread
 * @property {number} shadow_opacity
 * @property {boolean} mosaic_visible
 * @property {boolean} shadow_visible
 * @property {boolean} stroke_visible
 * @property {number} group_gap
 * @property {number} tilt_amount
 * @property {number} gyro_amount
 * @property {boolean} atmosphere_enabled
 * @property {string} atmosphere_color
 * @property {number} atmosphere_density
 * @property {number} drift_amount
 * @property {number} drift_speed
 * @property {number} breathing_amount
 * @property {number} breathing_speed
 * @property {boolean} motion_enabled
 * @property {Record<string, boolean>} mosaic_layer_visible
 * @property {Record<string, boolean>} shadow_layer_visible
 */

/**
 * Pushes PosterSceneState onto the three.js objects it describes. Each is
 * idempotent, so a setter can call whichever ones its change affects.
 * @typedef {Object} PosterSceneAppliers
 * @property {() => void} apply_mosaic_spread
 * @property {() => void} apply_mosaic_opacity
 * @property {() => void} apply_mosaic_visibility
 * @property {() => void} apply_shadow_visibility
 * @property {() => void} apply_shadow_opacity
 * @property {() => void} apply_shadow_z
 * @property {() => void} apply_stroke_visibility
 * @property {() => void} apply_stroke_opacity
 * @property {() => void} apply_atmosphere
 */

/**
 * @typedef {{ x: number, y: number }} Vec2
 */

/**
 * One shadow layer's material. `pulse` carries the layer's fill-opacity
 * keyframes from the SVG, or null for the layers that hold still. `drift` is
 * the paint texture's UV offset, or null when the layer is not gradient-filled
 * and so has one baked texture rather than a paint/mask pair.
 * @typedef {Object} ShadowMaterialEntry
 * @property {import('three').MeshBasicMaterial} material
 * @property {number} base_opacity
 * @property {boolean} loaded
 * @property {{ at: number, value: number }[] | null} pulse
 * @property {import('three').Vector2 | null} drift
 */

/**
 * One rendered layer of the poster, in draw order.
 * @typedef {Object} PosterSceneLayerGroup
 * @property {import('three').Group} group
 * @property {'mosaic' | 'shadow' | 'stroke'} kind
 * @property {number} parallax_offset
 */

/**
 * Everything the per-frame update reads. The scene owns the objects; the
 * getters read PosterSceneState, so the update never writes settings.
 * @typedef {Object} PosterSceneRuntime
 * @property {import('three').Scene & { fog: import('three').FogExp2 }} scene
 * @property {import('three').Group} root
 * @property {PosterSceneLayerGroup[]} layer_groups
 * @property {number} plane_w
 * @property {number} plane_h
 * @property {() => import('three').PerspectiveCamera | null} get_camera
 * @property {() => number} get_mosaic_spread
 * @property {() => number} get_shadow_spread
 * @property {() => number} get_shadow_opacity
 * @property {() => boolean} get_motion_enabled
 * @property {() => number} get_drift_amount
 * @property {() => number} get_drift_speed
 * @property {() => number} get_breathing_amount
 * @property {() => number} get_breathing_speed
 * @property {() => number} get_tilt_amount
 * @property {() => number} get_gyro_amount
 * @property {() => boolean} get_atmosphere_enabled
 * @property {() => number} get_atmosphere_density
 * @property {() => boolean} get_stroke_visible
 * @property {ShadowMaterialEntry[]} shadow_materials
 * @property {{ material: import('three').MeshBasicMaterial, base_opacity: number, loaded: boolean, period: number }[]} stroke_materials
 * @property {PosterSceneAppliers} appliers
 * @property {Vec2} smooth
 * @property {{ target: Vec2, current: Vec2, prev: Vec2, velocity: Vec2 }} pan
 * @property {{ target: number, current: number }} zoom
 * @property {Vec2} tilt
 * @property {Vec2} pointer
 * @property {{ canvas_height: number }} camera
 * @property {{ cursor_before: import('three').Vector3, cursor_after: import('three').Vector3, world_cursor_at_z: (z: number, out: import('three').Vector3) => import('three').Vector3 | null }} raycast
 * @property {() => boolean} get_reduced_motion
 */

/**
 * @typedef {Object} PosterSceneController
 * @property {import('three').Scene} scene
 * @property {(options?: { camera?: import('three').PerspectiveCamera }) => void} mount
 * @property {(options?: { width?: number, height?: number }) => void} on_resize
 * @property {(frame_state: FrameState, input_state: InputState) => void} update
 * @property {(value: number) => void} set_mosaic_spread
 * @property {(value: number) => void} set_mosaic_opacity
 * @property {(value: number) => void} set_shadow_spread
 * @property {(value: number) => void} set_shadow_opacity
 * @property {(value: boolean) => void} set_mosaic_visible
 * @property {(value: boolean) => void} set_shadow_visible
 * @property {(value: boolean) => void} set_stroke_visible
 * @property {(value: number) => void} set_group_gap
 * @property {(value: number) => void} set_tilt_amount
 * @property {(value: number) => void} set_gyro_amount
 * @property {(value: boolean) => void} set_atmosphere_enabled
 * @property {(value: string) => void} set_atmosphere_color
 * @property {(value: number) => void} set_atmosphere_density
 * @property {(value: number) => void} set_drift_amount
 * @property {(value: number) => void} set_drift_speed
 * @property {(value: number) => void} set_breathing_amount
 * @property {(value: number) => void} set_breathing_speed
 * @property {(value: boolean) => void} set_motion_enabled
 * @property {(name: string, visible: boolean) => void} set_mosaic_layer_visible
 * @property {(child_id: string, visible: boolean) => void} set_shadow_layer_visible
 * @property {() => Record<string, unknown>} get_settings
 * @property {() => Promise<void>} wait_for_textures
 * @property {(filename?: string) => void} export_glb
 * @property {() => Promise<ArrayBuffer>} parse_glb
 * @property {() => void} dispose
 */

export {}
