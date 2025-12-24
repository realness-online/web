import { country_list } from './country-list.js'
import { countryCodeEmoji as flag_emoji } from 'country-code-emoji'
import {
  findPhoneNumbersInText as phone_info,
  AsYouType as as_you_type,
  parsePhoneNumberFromString as parse_number
} from 'libphonenumber-js'

/**
 * @param {string} phone_string
 * @returns {string}
 */
export const phone_e64 = phone_string =>
  phone_info(phone_string)[0].number.number

export const format_phone = phone_string => {
  if (phone_string) {
    const phones = phone_info(phone_string)
    if (phones.length > 0) {
      const { country } = phones[0].number
      const number = phones[0].number.nationalNumber
      return new as_you_type(country).input(number)
    }
  } else return ''
}

export const default_country = 'US'
export const phone = {
  AL: 355,
  DZ: 213,
  AF: 93,
  AR: 54,
  AE: 971,
  AW: 297,
  AD: 376,
  AO: 244,
  AI: 1264,
  AG: 1268,
  AT: 43,
  AU: 61,
  AZ: 994,
  OM: 968,
  IE: 353,
  EE: 372,
  EG: 20,
  ET: 251,
  MO: 853,
  BB: 1246,
  PG: 675,
  BS: 1242,
  PK: 92,
  PY: 595,
  PS: 970,
  BH: 973,
  PA: 507,
  BR: 55,
  BY: 375,
  BM: 1441,
  BG: 359,
  MP: 1670,
  BJ: 229,
  BE: 32,
  IS: 354,
  PR: 1,
  PL: 48,
  BA: 387,
  BO: 591,
  BZ: 501,
  PW: 680,
  BW: 267,
  BT: 975,
  BF: 226,
  BI: 257,
  KP: 850,
  GQ: 240,
  DK: 45,
  DE: 49,
  TL: 670,
  TG: 228,
  DM: 1767,
  DO: 1809,
  RU: 7,
  EC: 593,
  ER: 291,
  FR: 33,
  FO: 298,
  PF: 689,
  GF: 594,
  PM: 508,
  VA: 39,
  PH: 63,
  FJ: 679,
  FI: 358,
  CV: 238,
  FK: 500,
  GM: 220,
  CG: 242,
  CD: 243,
  CO: 57,
  CR: 506,
  GD: 1473,
  GL: 299,
  GE: 995,
  GG: 44,
  CU: 53,
  GP: 590,
  GU: 1671,
  GY: 592,
  KZ: 7,
  HT: 509,
  KR: 82,
  NL: 31,
  BQ: 599,
  ME: 382,
  HN: 504,
  KI: 686,
  DJ: 253,
  KG: 996,
  GN: 224,
  GW: 245,
  CA: 1,
  GH: 233,
  GA: 241,
  KH: 855,
  CZ: 420,
  ZW: 263,
  CM: 237,
  QA: 974,
  KY: 1345,
  KM: 269,
  XK: 381,
  CI: 225,
  KW: 965,
  HR: 385,
  KE: 254,
  CK: 682,
  CW: 599,
  LV: 371,
  LS: 266,
  LA: 856,
  LB: 961,
  LT: 370,
  LR: 231,
  LY: 218,
  LI: 423,
  RE: 262,
  LU: 352,
  RW: 250,
  RO: 40,
  MG: 261,
  IM: 44,
  MV: 960,
  MT: 356,
  MW: 265,
  MY: 60,
  ML: 223,
  MK: 389,
  MH: 692,
  MQ: 596,
  YT: 262,
  MU: 230,
  MR: 222,
  US: 1,
  AS: 1684,
  VI: 1340,
  MN: 976,
  MS: 1664,
  BD: 880,
  PE: 51,
  FM: 691,
  MM: 95,
  MD: 373,
  MA: 212,
  MC: 377,
  MZ: 258,
  MX: 52,
  NA: 264,
  ZA: 27,
  SS: 211,
  NR: 674,
  NI: 505,
  NP: 977,
  NE: 227,
  NG: 234,
  NU: 683,
  NO: 47,
  NF: 672,
  PT: 351,
  JP: 81,
  SE: 46,
  CH: 41,
  SV: 503,
  WS: 685,
  RS: 381,
  SL: 232,
  SN: 221,
  CY: 357,
  SC: 248,
  SA: 966,
  BL: 590,
  ST: 239,
  SH: 290,
  KN: 1869,
  LC: 1758,
  MF: 590,
  SX: 599,
  SM: 378,
  VC: 1784,
  LK: 94,
  SK: 421,
  SI: 386,
  SZ: 268,
  SD: 249,
  SR: 597,
  SB: 677,
  SO: 252,
  TJ: 992,
  TW: 886,
  TH: 66,
  TZ: 255,
  TO: 676,
  TC: 1649,
  TT: 1868,
  TN: 216,
  TV: 688,
  TR: 90,
  TM: 993,
  TK: 690,
  WF: 681,
  VU: 678,
  GT: 502,
  VE: 58,
  BN: 673,
  UG: 256,
  UA: 380,
  UY: 598,
  UZ: 998,
  GR: 30,
  ES: 34,
  EH: 212,
  HK: 852,
  SG: 65,
  NC: 687,
  NZ: 64,
  HU: 36,
  SY: 963,
  JM: 1876,
  AM: 374,
  YE: 967,
  IQ: 964,
  IR: 98,
  IL: 972,
  IT: 39,
  IN: 91,
  ID: 62,
  GB: 44,
  VG: 1284,
  IO: 246,
  JO: 962,
  VN: 84,
  ZM: 260,
  JE: 44,
  TD: 235,
  GI: 350,
  CL: 56,
  CF: 236,
  CN: 86
}

/**
 * @param {string} country
 * @returns {number}
 */
export const phone_code = country => phone[country]

/**
 * @typedef {Object} Country_Phone
 * @property {string} code
 * @property {string} name
 * @property {string} emoji
 * @property {number} phone
 */
export const countries = Object.values(country_list).map(country => ({
  code: country.iso,
  name: country.name,
  emoji: flag_emoji(country.iso),
  phone: phone_code(country.iso)
}))

/**
 * @param {string} code
 * @returns {Country_Phone}
 */
export const country = code => countries.find(country => country.code === code)

/**
 * @param {string} full_phone
 * @param {string} country
 * @returns {boolean}
 */
export const valid_phone = (full_phone, country) => {
  if (!full_phone) return false
  const parsed = parse_number(full_phone, {
    defaultCountry: /** @type {any} */ (country)
  })
  return parsed ? parsed.isValid() : false
}

/**
 * @param {string} full_phone
 * @param {string} country
 * @returns {object}
 */
export const parse_phone = (full_phone, country) =>
  parse_number(full_phone, { defaultCountry: /** @type {any} */ (country) })

/**
 * @param {string} phone_string
 * @returns {string}
 */
export const get_country_from_phone = phone_string => {
  const parsed = parse_number(phone_string)
  return parsed?.country
}

export { as_you_type }
