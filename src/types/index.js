/** @typedef {string} Path_Data */

/** @typedef {'Poster'|'Statements'|'Events'|'Relations'|'Me'} Item_Type */

/** @typedef {string} Author_Id */
/** @typedef {number} Created_Id */

/** @typedef {`${Author_Id}/${Item_Type}/${Created_Id}`} Item_Id */

/**
 * @typedef {Object} rgba_color
 * @property {number} r
 * @property {number} g
 * @property {number} b
 * @property {number} a
 */

/**
 * @typedef {Object} Item
 * @property {Item_Id} id
 * @property {Item_Type} type
 */

/**
 * @typedef {Object} Vector
 * @property {Item_Id} id
 * @property {Path_Data} light
 * @property {Path_Data} regular
 * @property {Path_Data} medium
 * @property {Path_Data} bold
 * @property {number} width
 * @property {number} height
 * @property {string} viewbox
 */

export {}
