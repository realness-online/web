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
 */

export {}
