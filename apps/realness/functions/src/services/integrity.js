import twilio from 'twilio'

const blacklisted_carriers = [
  'Google (Grand Central) - SVR',
  'Bandwidth/13 - Bandwidth.com - SVR',
  'Bandwidth/15 - Bandwidth.com - SVR',
  'TextPlus - 360 Networks - SVR',
  'TextPlus - Inteliquent - SVR',
  'Sinch A2P - Sinch',
  'Onvoy Spectrum',
  'Onvoy Spectrum, LLC',
  'Twilio - SMS/MMS-SVR',
  'Telnyx/1 A2P - SVR',
  'Level 3 Communications, LLC',
  'Plivo - SVR',
  'Skype Communications SARL - Level3 - SVR',
  'Talktone P2P - Bandwidth - SVR',
  'TextNow Wireless - SVR',
  'TextNow - Neutral Tandem - SVR'
]

/**
 * @param {{ line_type_intelligence?: { type?: string, carrier_name?: string } }} integrity_data
 */
export const validate_phone_integrity = integrity_data => {
  if (!integrity_data?.line_type_intelligence) return false

  const { type, carrier_name } = integrity_data.line_type_intelligence

  if (type !== 'mobile') return false

  const carrier_lower = carrier_name?.toLowerCase()
  if (
    carrier_lower &&
    blacklisted_carriers.some(carrier => carrier.toLowerCase() === carrier_lower)
  )
    return false

  return true
}

const to_integrity_data = intelligence => ({
  type: intelligence?.type || 'unknown',
  carrier_name:
    intelligence?.carrierName ||
    intelligence?.carrier_name ||
    'unknown',
  country_code:
    intelligence?.mobileCountryCode ||
    intelligence?.mobile_country_code ||
    'unknown',
  network_code:
    intelligence?.mobileNetworkCode ||
    intelligence?.mobile_network_code ||
    'unknown'
})

/**
 * Twilio Lookup v2 — line_type_intelligence only (not SMS).
 * @param {string} phone E.164
 * @param {{ sid: string, token: string }} credentials
 */
export const lookup_phone_integrity = async (phone, credentials) => {
  const client = new twilio(credentials.sid, credentials.token)

  const result = await client.lookups.v2.phoneNumbers(phone).fetch({
    fields: ['line_type_intelligence']
  })

  const intelligence = result.lineTypeIntelligence

  if (!intelligence) {
    return {
      allowed: false,
      integrity_data: to_integrity_data(null)
    }
  }

  const integrity_data = to_integrity_data(intelligence)
  const allowed = validate_phone_integrity({
    line_type_intelligence: integrity_data
  })

  return { allowed, integrity_data }
}
