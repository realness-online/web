/** @typedef {import('@/types').Id} Id */
import { get_item } from '@/utils/item'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** @param {unknown} value */
const is_nullish = value => value === null || value === undefined

/**
 * @typedef {Object} PosterExif
 * @property {string} [dateCreated]
 * @property {string} [subSecTimeOriginal]
 * @property {string} [offsetTimeOriginal]
 * @property {string} [camera]
 * @property {string} [lens]
 * @property {string} [exposureTime]
 * @property {string} [fNumber]
 * @property {string} [iso]
 * @property {string} [focalLength]
 * @property {number} [focalLength35mm]
 * @property {number} [digitalZoomRatio]
 * @property {string} [orientation]
 * @property {string} [flash]
 * @property {string} [exposureProgram]
 * @property {string} [whiteBalance]
 * @property {string} [sceneCaptureType]
 * @property {string} [subjectDistanceRange]
 * @property {number} [subjectDistance]
 * @property {string} [subjectArea]
 * @property {string} [subjectLocation]
 * @property {number} [latitude]
 * @property {number} [longitude]
 * @property {number} [altitude]
 * @property {number} [imgDirection]
 * @property {number} [destBearing]
 * @property {number} [destDistance]
 * @property {number} [gpsSpeed]
 * @property {number} [gpsTrack]
 * @property {string} [gpsDateStamp]
 * @property {string} [gpsTimeStamp]
 * @property {number} [gpsAccuracy]
 * @property {string} [placeName]
 * @property {string} [keywords]
 * @property {string} [caption]
 * @property {string} [userComment]
 * @property {string} [imageDescription]
 * @property {string} [imageUniqueId]
 */

/** @type {(keyof PosterExif)[]} */
export const POSTER_EXIF_FIELDS = [
  'dateCreated',
  'subSecTimeOriginal',
  'offsetTimeOriginal',
  'camera',
  'lens',
  'exposureTime',
  'fNumber',
  'iso',
  'focalLength',
  'focalLength35mm',
  'digitalZoomRatio',
  'orientation',
  'flash',
  'exposureProgram',
  'whiteBalance',
  'sceneCaptureType',
  'subjectDistanceRange',
  'subjectDistance',
  'subjectArea',
  'subjectLocation',
  'latitude',
  'longitude',
  'altitude',
  'imgDirection',
  'destBearing',
  'destDistance',
  'gpsSpeed',
  'gpsTrack',
  'gpsDateStamp',
  'gpsTimeStamp',
  'gpsAccuracy',
  'placeName',
  'keywords',
  'caption',
  'userComment',
  'imageDescription',
  'imageUniqueId'
]

/** @type {(keyof PosterExif)[]} */
const POSTER_EXIF_NUMERIC_FIELDS = [
  'focalLength35mm',
  'digitalZoomRatio',
  'subjectDistance',
  'latitude',
  'longitude',
  'altitude',
  'imgDirection',
  'destBearing',
  'destDistance',
  'gpsSpeed',
  'gpsTrack',
  'gpsAccuracy'
]

/**
 * @param {unknown} tags
 * @returns {{ exif: Record<string, unknown>, iptc: Record<string, unknown>, gps: Record<string, unknown>, xmp: Record<string, unknown> }}
 */
const tag_groups = tags => {
  if (!tags || typeof tags !== 'object')
    return { exif: {}, iptc: {}, gps: {}, xmp: {} }

  const record = /** @type {Record<string, unknown>} */ (tags)
  const group = key => {
    const value = record[key]
    return typeof value === 'object' && value
      ? /** @type {Record<string, unknown>} */ (value)
      : null
  }

  const iptc = group('iptc') ?? {}
  const gps = group('gps') ?? {}
  const xmp = group('xmp') ?? {}
  const nested_exif = group('exif')

  if (nested_exif) return { exif: nested_exif, iptc, gps, xmp }

  const flat_exif = { ...record }
  delete flat_exif.exif
  delete flat_exif.iptc
  delete flat_exif.gps
  delete flat_exif.xmp
  return { exif: flat_exif, iptc, gps, xmp }
}

/**
 * @param {unknown} tag
 * @returns {string | number | null}
 */
const raw_tag = tag => {
  if (is_nullish(tag)) return null
  if (typeof tag === 'string' || typeof tag === 'number') return tag
  if (typeof tag !== 'object') return null
  if ('value' in tag && !is_nullish(tag.value))
    return /** @type {string | number} */ (tag.value)
  if ('description' in tag && !is_nullish(tag.description))
    return /** @type {string | number} */ (tag.description)
  return null
}

/**
 * @param {unknown} tag
 * @returns {string | null}
 */
const tag_description = tag => {
  if (!tag || typeof tag !== 'object' || !('description' in tag)) return null
  const { description } = tag
  if (is_nullish(description) || description === '') return null
  return String(description)
}

/**
 * @param {Record<string, unknown>} tags
 * @param {string[]} names
 * @returns {string | number | null}
 */
const first_tag = (tags, names) => {
  for (const name of names) {
    const value = raw_tag(tags[name])
    if (!is_nullish(value) && value !== '') return value
  }
  return null
}

/**
 * @param {Record<string, unknown>} tags
 * @param {string[]} names
 * @returns {string | null}
 */
const first_description = (tags, names) => {
  for (const name of names) {
    const description = tag_description(tags[name])
    if (description) return description
    const value = raw_tag(tags[name])
    if (!is_nullish(value) && value !== '') return String(value)
  }
  return null
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
const as_number = value => {
  if (is_nullish(value)) return null
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

/**
 * @param {unknown} tag
 * @returns {number | null}
 */
const rational_number = tag => {
  const raw = raw_tag(tag)
  if (Array.isArray(raw) && raw.length >= 2) {
    const num = as_number(raw[0])
    const den = as_number(raw[1])
    if (!is_nullish(num) && !is_nullish(den) && den !== 0) return num / den
  }
  return as_number(raw)
}

/**
 * @param {unknown} tag
 * @returns {string | null}
 */
const array_tag_csv = tag => {
  const raw = raw_tag(tag)
  const values = Array.isArray(raw) ? raw : null
  if (!values?.length) return null
  return values.map(value => String(as_number(value) ?? value)).join(',')
}

/**
 * @param {Record<string, unknown>} iptc
 * @param {Record<string, unknown>} xmp
 * @returns {string | null}
 */
const place_name = (iptc, xmp) => {
  const parts = [
    first_tag(iptc, ['Sub-location']),
    first_tag(iptc, ['Content Location Name']),
    first_tag(iptc, ['City']),
    first_tag(iptc, ['Province-State']),
    first_tag(iptc, ['Country/Primary Location Name']),
    first_tag(xmp, ['City', 'Location', 'Country'])
  ]
    .filter(Boolean)
    .map(part => String(part).trim())
    .filter(Boolean)

  if (!parts.length) return null
  return [...new Set(parts)].join(', ')
}

/**
 * @param {PosterExif} poster_exif
 * @param {keyof PosterExif} key
 * @param {unknown} value
 */
const set_string_field = (poster_exif, key, value) => {
  if (is_nullish(value)) return
  const text = String(value).trim()
  if (text)
    /** @type {Record<string, string | number>} */ (poster_exif)[key] = text
}

/**
 * @param {PosterExif} poster_exif
 * @param {keyof PosterExif} key
 * @param {unknown} tag
 */
const set_number_field = (poster_exif, key, tag) => {
  const value = rational_number(tag)
  if (!is_nullish(value))
    /** @type {Record<string, string | number>} */ (poster_exif)[key] = value
}

/**
 * @param {Record<string, unknown>} iptc
 * @param {Record<string, unknown>} xmp
 * @returns {string | null}
 */
const keywords_text = (iptc, xmp) => {
  const raw =
    first_description(iptc, ['Keywords']) ??
    first_tag(iptc, ['Keywords']) ??
    first_description(xmp, ['Keywords', 'Subject']) ??
    first_tag(xmp, ['Keywords', 'Subject'])
  if (is_nullish(raw)) return null
  return String(raw).trim() || null
}

/**
 * @param {Record<string, unknown>} iptc
 * @param {Record<string, unknown>} xmp
 * @param {Record<string, unknown>} exif
 * @returns {string | null}
 */
const caption_text = (iptc, xmp, exif) =>
  first_description(iptc, ['Caption/Abstract', 'Headline']) ??
  first_description(xmp, ['Description', 'Headline']) ??
  first_description(exif, ['ImageDescription']) ??
  null

/**
 * @param {unknown} tags - ExifReader.load result
 * @returns {PosterExif | null}
 */
// eslint-disable-next-line complexity -- field extraction is intentionally flat
export const extract_poster_exif = tags => {
  if (!tags || typeof tags !== 'object') return null

  const { exif, iptc, gps, xmp } = tag_groups(tags)

  /** @type {PosterExif} */
  const poster_exif = {}

  const date_created = first_tag(exif, [
    'DateTimeOriginal',
    'CreateDate',
    'ModifyDate'
  ])
  if (!is_nullish(date_created)) poster_exif.dateCreated = String(date_created)

  const sub_sec = first_tag(exif, ['SubSecTimeOriginal', 'SubSecTime'])
  if (!is_nullish(sub_sec)) poster_exif.subSecTimeOriginal = String(sub_sec)

  set_string_field(
    poster_exif,
    'offsetTimeOriginal',
    first_tag(exif, ['OffsetTimeOriginal', 'OffsetTimeDigitized'])
  )

  const make = first_tag(exif, ['Make'])
  const model = first_tag(exif, ['Model'])
  const camera = [make, model].filter(Boolean).join(' ').trim()
  if (camera) poster_exif.camera = camera

  const lens = first_tag(exif, ['LensModel', 'Lens'])
  if (!is_nullish(lens)) poster_exif.lens = String(lens)

  const exposure =
    first_description(exif, ['ExposureTime']) ??
    (() => {
      const value = first_tag(exif, ['ExposureTime'])
      return is_nullish(value) ? null : String(value)
    })()
  if (!is_nullish(exposure)) poster_exif.exposureTime = exposure

  const f_number =
    rational_number(exif.FNumber) ?? rational_number(exif.ApertureValue)
  if (!is_nullish(f_number)) poster_exif.fNumber = String(f_number)

  const iso = first_tag(exif, [
    'ISO',
    'PhotographicSensitivity',
    'ISOSpeedRatings'
  ])
  if (!is_nullish(iso)) poster_exif.iso = String(iso)

  const focal = rational_number(exif.FocalLength)
  if (!is_nullish(focal)) poster_exif.focalLength = String(focal)

  const focal_35 = rational_number(exif.FocalLengthIn35mmFilm)
  if (!is_nullish(focal_35)) poster_exif.focalLength35mm = focal_35

  set_number_field(poster_exif, 'digitalZoomRatio', exif.DigitalZoomRatio)

  const orientation = first_tag(exif, ['Orientation'])
  if (!is_nullish(orientation)) poster_exif.orientation = String(orientation)

  const flash = first_description(exif, ['Flash'])
  if (flash) poster_exif.flash = flash

  set_string_field(
    poster_exif,
    'exposureProgram',
    first_description(exif, ['ExposureProgram'])
  )
  set_string_field(
    poster_exif,
    'whiteBalance',
    first_description(exif, ['WhiteBalance'])
  )
  set_string_field(
    poster_exif,
    'sceneCaptureType',
    first_description(exif, ['SceneCaptureType'])
  )
  set_string_field(
    poster_exif,
    'subjectDistanceRange',
    first_description(exif, ['SubjectDistanceRange'])
  )

  const subject_distance = rational_number(exif.SubjectDistance)
  if (!is_nullish(subject_distance) && subject_distance > 0)
    poster_exif.subjectDistance = subject_distance

  const subject_area = array_tag_csv(exif.SubjectArea)
  if (subject_area) poster_exif.subjectArea = subject_area

  const subject_location = array_tag_csv(exif.SubjectLocation)
  if (subject_location) poster_exif.subjectLocation = subject_location

  const latitude =
    as_number(gps.Latitude) ??
    as_number(first_tag(exif, ['GPSLatitude', 'Latitude']))
  const longitude =
    as_number(gps.Longitude) ??
    as_number(first_tag(exif, ['GPSLongitude', 'Longitude']))
  const altitude =
    as_number(gps.Altitude) ??
    rational_number(exif.GPSAltitude) ??
    as_number(first_tag(exif, ['GPSAltitude', 'Altitude']))

  if (!is_nullish(latitude)) poster_exif.latitude = latitude
  if (!is_nullish(longitude)) poster_exif.longitude = longitude
  if (!is_nullish(altitude)) poster_exif.altitude = altitude

  const img_direction =
    rational_number(exif.GPSImgDirection) ?? as_number(gps.ImgDirection)
  if (!is_nullish(img_direction)) poster_exif.imgDirection = img_direction

  const gps_accuracy =
    rational_number(exif.GPSHPositioningError) ?? as_number(gps.Accuracy)
  if (!is_nullish(gps_accuracy)) poster_exif.gpsAccuracy = gps_accuracy

  set_number_field(poster_exif, 'destBearing', exif.GPSDestBearing)
  set_number_field(poster_exif, 'destDistance', exif.GPSDestDistance)
  set_number_field(poster_exif, 'gpsSpeed', exif.GPSSpeed)
  set_number_field(poster_exif, 'gpsTrack', exif.GPSTrack)

  set_string_field(
    poster_exif,
    'gpsDateStamp',
    first_tag(exif, ['GPSDateStamp'])
  )
  set_string_field(
    poster_exif,
    'gpsTimeStamp',
    first_description(exif, ['GPSTimeStamp'])
  )

  const named_place = place_name(iptc, xmp)
  if (named_place) poster_exif.placeName = named_place

  set_string_field(poster_exif, 'keywords', keywords_text(iptc, xmp))
  set_string_field(poster_exif, 'caption', caption_text(iptc, xmp, exif))
  set_string_field(
    poster_exif,
    'userComment',
    first_description(exif, ['UserComment'])
  )
  set_string_field(
    poster_exif,
    'imageDescription',
    first_description(exif, ['ImageDescription'])
  )
  set_string_field(
    poster_exif,
    'imageUniqueId',
    first_tag(exif, ['ImageUniqueID'])
  )

  return POSTER_EXIF_FIELDS.some(key => !is_nullish(poster_exif[key]))
    ? poster_exif
    : null
}

/**
 * @param {string} poster_html
 * @param {Id} itemid
 * @returns {PosterExif | null}
 */
export const read_poster_exif = (poster_html, itemid) => {
  const item = /** @type {Record<string, unknown> | null} */ (
    get_item(poster_html, itemid)
  )
  const raw = item?.exif
  if (!raw || typeof raw !== 'object') return null

  /** @type {PosterExif} */
  const poster_exif = {}
  /** @type {Record<string, string | number>} */
  const store = poster_exif
  for (const key of POSTER_EXIF_FIELDS) {
    const value = /** @type {Record<string, unknown>} */ (raw)[key]
    if (is_nullish(value) || value === '') continue
    if (POSTER_EXIF_NUMERIC_FIELDS.includes(key)) {
      const n = as_number(value)
      if (!is_nullish(n)) store[key] = n
      continue
    }
    store[key] = String(value)
  }

  return POSTER_EXIF_FIELDS.some(key => !is_nullish(poster_exif[key]))
    ? poster_exif
    : null
}

/**
 * @param {Element} poster_el
 * @returns {SVGMetadataElement}
 */
const metadata_for = poster_el => {
  let metadata = poster_el.querySelector(':scope > metadata')
  if (!metadata) {
    metadata = poster_el.ownerDocument.createElementNS(SVG_NS, 'metadata')
    poster_el.appendChild(metadata)
  }
  return /** @type {SVGMetadataElement} */ (metadata)
}

/**
 * @param {Document} doc
 * @param {keyof PosterExif} name
 * @param {string | number} value
 * @returns {Element}
 */
const exif_field_el = (doc, name, value) => {
  const el = doc.createElementNS(SVG_NS, 'desc')
  el.setAttribute('itemprop', name)
  if (name === 'dateCreated') el.setAttribute('datetime', String(value))
  else el.setAttribute('content', String(value))
  return el
}

/**
 * Write EXIF into poster index markup as SVG `<metadata>` microdata.
 * @param {Element | null | undefined} poster_el
 * @param {PosterExif | null | undefined} exif
 */
export const write_poster_exif = (poster_el, exif) => {
  if (!poster_el) return
  poster_el
    .querySelectorAll('[itemprop="exif"][itemtype="/exif"]')
    .forEach(node => node.remove())

  if (!exif) return

  const fields = POSTER_EXIF_FIELDS.filter(key => !is_nullish(exif[key]))
  if (!fields.length) return

  const doc = poster_el.ownerDocument
  const metadata = metadata_for(poster_el)
  const group = doc.createElementNS(SVG_NS, 'g')
  group.setAttribute('itemprop', 'exif')
  group.setAttribute('itemscope', '')
  group.setAttribute('itemtype', '/exif')

  for (const key of fields) {
    const value = exif[key]
    if (is_nullish(value)) continue
    group.appendChild(exif_field_el(doc, key, value))
  }

  metadata.appendChild(group)
}
