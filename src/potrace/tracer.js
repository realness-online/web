/**
 * Path tracing for Potrace algorithm
 * Handles boundary detection and path following
 */
import Point from '@/potrace/types/Point'
import Path from '@/potrace/types/Path'
import Bitmap from '@/potrace/types/Bitmap' // eslint-disable-line no-unused-vars

/**
 * Finds the next unprocessed point in the bitmap
 * @param {Bitmap} black_map - Binary bitmap (0=white, 1=black)
 * @param {Point} start_point - Point to start searching from
 * @returns {Point|false} Next point with value 1, or false if none found
 */
export const find_next_point = (black_map, start_point) => {
  let i = black_map.point_to_index(start_point)
  while (i < black_map.size && black_map.data[i] !== 1) i++
  return i < black_map.size && black_map.index_to_point(i)
}

/**
 * Determines majority pixel value in local neighborhood
 * @param {Bitmap} black_map - Binary bitmap
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {0|1} Majority value in neighborhood
 */
export const get_majority = (black_map, x, y) => {
  let ct
  for (let i = 2; i < 5; i++) {
    ct = 0
    for (let a = -i + 1; a <= i - 1; a++) {
      ct += black_map.get_value_at(x + a, y + i - 1) ? 1 : -1
      ct += black_map.get_value_at(x + i - 1, y + a - 1) ? 1 : -1
      ct += black_map.get_value_at(x + a - 1, y - i) ? 1 : -1
      ct += black_map.get_value_at(x - i, y + a) ? 1 : -1
    }
    if (ct > 0) return 1
    if (ct < 0) return 0
  }
  return 0
}

/**
 * Determines turn direction based on policy
 * @param {string} turn_policy - Turn policy name
 * @param {string} path_sign - Path sign ('+' or '-')
 * @param {Bitmap} black_map - Binary bitmap
 * @param {number} x - Current x coordinate
 * @param {number} y - Current y coordinate
 * @returns {boolean} True to turn right, false to turn left
 */
export const should_turn_right = (turn_policy, path_sign, black_map, x, y) => {
  if (turn_policy === 'right') return true
  if (turn_policy === 'left') return false
  if (turn_policy === 'black' && path_sign === '+') return true
  if (turn_policy === 'white' && path_sign === '-') return true
  if (turn_policy === 'majority') return get_majority(black_map, x, y) === 1
  if (turn_policy === 'minority') return get_majority(black_map, x, y) === 0
  return false
}

/**
 * Traces a complete path from starting point
 * @param {Bitmap} black_map - Binary bitmap
 * @param {Point} start_point - Starting point
 * @param {string} turn_policy - Turn policy for ambiguous cases
 * @returns {Path} Traced path
 */
export const trace_path = (black_map, start_point, turn_policy) => {
  const path = new Path()
  let { x } = start_point
  let { y } = start_point
  let dir_x = 0
  let dir_y = 1

  path.sign = black_map.get_value_at(start_point.x, start_point.y) ? '+' : '-'

  while (true) {
    path.points.push(new Point(x, y))
    path.max_x = Math.max(path.max_x, x)
    path.min_x = Math.min(path.min_x, x)
    path.max_y = Math.max(path.max_y, y)
    path.min_y = Math.min(path.min_y, y)
    path.len++

    x += dir_x
    y += dir_y
    path.area -= x * dir_y

    if (x === start_point.x && y === start_point.y) break

    const l = black_map.get_value_at(
      x + (dir_x + dir_y - 1) / 2,
      y + (dir_y - dir_x - 1) / 2
    )
    const r = black_map.get_value_at(
      x + (dir_x - dir_y - 1) / 2,
      y + (dir_y + dir_x - 1) / 2
    )

    if (r && !l)
      if (should_turn_right(turn_policy, path.sign, black_map, x, y)) {
        ;[dir_x, dir_y] = [-dir_y, dir_x]
      } else {
        ;[dir_x, dir_y] = [dir_y, -dir_x]
      }
    else if (r) {
      ;[dir_x, dir_y] = [-dir_y, dir_x]
    } else if (!l) {
      ;[dir_x, dir_y] = [dir_y, -dir_x]
    }
  }

  return path
}

/**
 * XORs path into bitmap to mark as processed
 * @param {Bitmap} black_map - Binary bitmap
 * @param {Path} path - Path to XOR
 * @returns {void}
 */
export const xor_path = (black_map, path) => {
  let y1 = path.points[0].y
  const { len } = path

  for (let i = 1; i < len; i++) {
    const { x } = path.points[i]
    const { y } = path.points[i]

    if (y !== y1) {
      const min_y = Math.min(y1, y)
      const { max_x } = path

      for (let j = x; j < max_x; j++) {
        const indx = black_map.point_to_index(j, min_y)
        black_map.data[indx] = black_map.data[indx] ? 0 : 1
      }
      y1 = y
    }
  }
}

/**
 * Traces all paths in a binary bitmap
 * @param {Bitmap} black_map - Binary bitmap
 * @param {string} turn_policy - Turn policy for ambiguous cases
 * @param {number} turd_size - Minimum area threshold
 * @returns {Path[]} Array of traced paths
 */
export const trace_all_paths = (black_map, turn_policy, turd_size) => {
  const paths = []
  let current_point = new Point(0, 0)

  while (true) {
    const next_point = find_next_point(black_map, current_point)
    if (!next_point) break
    current_point = next_point
    const path = trace_path(black_map, current_point, turn_policy)
    xor_path(black_map, path)

    if (path.area > turd_size) paths.push(path)
  }

  return paths
}
