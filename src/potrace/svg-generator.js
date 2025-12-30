/**
 * SVG generation for Potrace algorithm
 * Converts traced paths to SVG format
 */
import utils from '@/potrace/utils'
import Path from '@/potrace/types/Path'

/**
 * @typedef {Object} PathData
 * @property {string} d - SVG path data string
 * @property {string} fillOpacity - Fill opacity value
 */

/**
 * Generates SVG path tag from pathlist
 * @param {Path[]} pathlist - Array of traced paths with curves
 * @returns {string} SVG path element
 */
export const generate_path_tag = pathlist => {
  let tag = '<path itemprop="path" d="'

  pathlist.forEach(path => {
    tag += utils.render_curve(path.curve, 1)
  })

  tag += '" style="fill-rule:evenodd"/>'

  return tag
}

/**
 * Generates array of path data objects
 * @param {Path[]} pathlist - Array of traced paths with curves
 * @param {string} fill_opacity - Fill opacity value
 * @returns {PathData[]} Array of path data objects
 */
export const generate_path_data = (pathlist, fill_opacity) => pathlist.map(path => ({
    d: utils.render_curve(path.curve, 1),
    fillOpacity: fill_opacity
  }))

